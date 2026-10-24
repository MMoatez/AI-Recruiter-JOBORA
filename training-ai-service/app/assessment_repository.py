from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from uuid import uuid4

from .bkt import BKTParameters, recommendation_for, update_mastery
from .db import Database
from .schemas import (
    AdaptiveRecommendation, AssessmentAnswerResult, AssessmentCreateRequest,
    AssessmentQuestionPublic, AssessmentResultResponse, AssessmentSessionResponse,
    AssessmentSubmitRequest, GeneratedQuestionKey, MasteryPoint, PendingQuestionResponse, QuestionGenerationRequest,
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:60]


# Reviewed seed bank. Generated questions must be stored pending_review and are never scored.
CURATED_BANK = {
    "git": [
        ("history", "Que fait `git commit` ?", ["Télécharge sur GitHub", "Enregistre un instantané local", "Supprime une branche", "Fusionne deux dépôts"], 1, "Un commit enregistre un instantané dans l'historique local."),
        ("branches", "Quelle commande crée une branche et s'y déplace ?", ["git branch -d feature", "git merge feature", "git switch -c feature", "git pull feature"], 2, "`git switch -c` crée la branche puis la rend active."),
        ("collaboration", "Avant de partager un commit, où faut-il éviter de placer un secret ?", ["Dans le message du commit", "Dans le fichier README", "Dans n'importe quel fichier suivi", "Uniquement dans un tag"], 2, "Un secret ne doit jamais être ajouté à un fichier suivi par Git."),
    ],
    "docker": [
        ("images", "Quel fichier décrit généralement la construction d'une image Docker ?", ["compose.lock", "Dockerfile", "container.json", "image.yml"], 1, "Le Dockerfile contient les instructions de construction d'une image."),
        ("containers", "Quelle relation est correcte ?", ["Une image est une instance en cours", "Un conteneur est une instance d'image", "Une image dépend toujours de Kubernetes", "Un conteneur remplace le code source"], 1, "Un conteneur est une instance exécutable créée à partir d'une image."),
        ("reproducibility", "Pourquoi épingler les versions des dépendances dans une image ?", ["Pour agrandir l'image", "Pour rendre les builds reproductibles", "Pour désactiver le cache", "Pour exposer plus de ports"], 1, "Les versions épinglées limitent les variations entre constructions."),
    ],
    "flutter": [
        ("widgets", "Dans Flutter, l'interface est principalement composée de quoi ?", ["Widgets", "Fragments XML", "Storyboards", "Servlets"], 0, "Flutter compose l'interface avec des widgets."),
        ("state", "Quand utiliser un StatefulWidget ?", ["Quand l'UI peut changer durant sa vie", "Pour chaque texte statique", "Uniquement pour HTTP", "Pour compiler Android"], 0, "StatefulWidget convient à un état mutable qui déclenche une reconstruction."),
        ("async", "Quel type Dart représente généralement une valeur asynchrone unique ?", ["Stream uniquement", "Future", "WidgetRef", "IterableSync"], 1, "Future représente une valeur ou erreur disponible ultérieurement."),
    ],
    "firebase": [
        ("security", "Où les autorisations Firestore doivent-elles être imposées ?", ["Seulement dans l'UI", "Dans les règles de sécurité côté service", "Dans le CSS", "Dans le nom de collection"], 1, "Les règles de sécurité appliquent l'autorisation indépendamment du client."),
        ("auth", "Après authentification, quelle donnée identifie habituellement l'utilisateur Firebase ?", ["UID", "Port TCP", "Nom du widget", "Clé CSS"], 0, "Firebase Authentication associe un UID stable au compte."),
        ("data", "Firestore est principalement quel type de base ?", ["Relationnelle SQL", "Document NoSQL", "Graphe RDF uniquement", "Fichier CSV"], 1, "Cloud Firestore est une base orientée documents NoSQL."),
    ],
    "ci-cd": [
        ("pipeline", "Quel contrôle doit échouer avant un déploiement si les tests sont rouges ?", ["Le pipeline CI", "Le thème de l'éditeur", "Le cache navigateur", "Le README"], 0, "Le pipeline CI doit bloquer la progression quand les contrôles requis échouent."),
        ("artifacts", "Pourquoi conserver un artefact de build immuable ?", ["Pour déployer exactement ce qui a été testé", "Pour modifier le code en production", "Pour éviter tout test", "Pour masquer les journaux"], 0, "Promouvoir le même artefact relie le déploiement au build testé."),
        ("secrets", "Comment fournir un secret à un pipeline ?", ["Le committer dans Git", "Via le gestionnaire de secrets CI", "Dans une capture d'écran", "Dans le nom de branche"], 1, "Le gestionnaire de secrets limite l'exposition et contrôle l'accès."),
    ],
}


class AssessmentRepository:
    def __init__(self, database: Database, params: BKTParameters | None = None) -> None:
        self.database, self.params = database, params or BKTParameters()

    def create(self, request: AssessmentCreateRequest) -> AssessmentSessionResponse | None:
        key = _slug(request.skill)
        bank = CURATED_BANK.get(key)
        if not bank:
            return None
        session_id, now = f"assessment_{uuid4().hex}", _now()
        public = []
        with self.database.connect() as connection:
            if request.plan_id and not connection.execute("SELECT 1 FROM learning_plans WHERE id = ?", (request.plan_id,)).fetchone():
                raise LookupError("Learning plan not found")
            connection.execute("INSERT INTO assessment_sessions VALUES (?, ?, ?, ?, 'active', ?, NULL)", (session_id, request.plan_id, request.user_reference, request.skill, now))
            for position, (subskill, prompt, choices, correct, explanation) in enumerate(bank):
                concept_id = f"{key}:{subskill}"
                question_id = f"q_{key}_{subskill}_v1"
                connection.execute("""INSERT OR IGNORE INTO assessment_questions
                    (id, concept_id, skill, prompt, choices_json, correct_choice, explanation, difficulty,
                     review_status, source, reviewed_by, reviewed_at, review_decision, question_bank_version)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'beginner', 'approved', 'curated', 'curated-bank-maintainers', ?, 'approved', 1)""",
                    (question_id, concept_id, request.skill, prompt, json.dumps(choices, ensure_ascii=False), correct, explanation, now))
                connection.execute("INSERT INTO assessment_session_questions VALUES (?, ?, ?)", (session_id, question_id, position))
                public.append(AssessmentQuestionPublic(id=question_id, concept_id=concept_id, prompt=prompt, choices=choices, difficulty="beginner"))
        return AssessmentSessionResponse(id=session_id, skill=request.skill, status="active", questions=public, created_at=now)

    def submit(self, session_id: str, request: AssessmentSubmitRequest) -> AssessmentResultResponse:
        now = _now()
        with self.database.connect() as connection:
            session = connection.execute("SELECT * FROM assessment_sessions WHERE id = ?", (session_id,)).fetchone()
            if not session:
                raise LookupError("Assessment not found")
            if session["user_reference"] != request.user_reference:
                raise PermissionError("Assessment belongs to another development user reference")
            if session["status"] == "submitted":
                raise FileExistsError("Assessment has already been submitted")
            rows = connection.execute("""SELECT q.* FROM assessment_questions q JOIN assessment_session_questions sq
                ON sq.question_id=q.id WHERE sq.session_id=? ORDER BY sq.position""", (session_id,)).fetchall()
            if not rows:
                raise ValueError("Assessment contains no questions")
            unapproved = [row["id"] for row in rows if row["review_status"] != "approved"]
            if unapproved:
                raise PermissionError("Assessment contains an unapproved question and cannot be scored")
            answers = {item.question_id: item.selected_choice for item in request.answers}
            if set(answers) != {row["id"] for row in rows}:
                raise ValueError("Submit exactly one answer for every assessment question")
            results, score = [], 0
            for row in rows:
                selected = answers[row["id"]]
                choices = json.loads(row["choices_json"])
                if selected >= len(choices):
                    raise ValueError(f"Choice is out of range for {row['id']}")
                correct = selected == row["correct_choice"]
                score += int(correct)
                previous = connection.execute("""SELECT next_prior FROM mastery_history
                    WHERE user_reference=? AND concept_id=? ORDER BY id DESC LIMIT 1""", (request.user_reference, row["concept_id"])).fetchone()
                prior = previous["next_prior"] if previous else self.params.initial_mastery
                update = update_mastery(prior, correct, self.params)
                connection.execute("INSERT INTO assessment_answers VALUES (?, ?, ?, ?, ?)", (session_id, row["id"], selected, int(correct), now))
                connection.execute("""INSERT INTO mastery_history
                    (user_reference, concept_id, session_id, question_id, prior, observation_posterior, next_prior, correct, parameter_version, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", (request.user_reference, row["concept_id"], session_id, row["id"], update.prior, update.observation_posterior, update.next_prior, int(correct), self.params.version, now))
                results.append(AssessmentAnswerResult(question_id=row["id"], concept_id=row["concept_id"], selected_choice=selected, correct_choice=row["correct_choice"], correct=correct, explanation=row["explanation"], observation_posterior=update.observation_posterior, mastery=update.next_prior))
            connection.execute("UPDATE assessment_sessions SET status='submitted', submitted_at=? WHERE id=?", (now, session_id))
        return AssessmentResultResponse(session_id=session_id, score=score, total=len(rows), results=results, submitted_at=now)

    def history(self, user_reference: str) -> list[MasteryPoint]:
        with self.database.connect() as connection:
            rows = connection.execute("""SELECT h.*, q.skill FROM mastery_history h JOIN assessment_questions q ON q.id=h.question_id
                WHERE h.user_reference=? ORDER BY h.id""", (user_reference,)).fetchall()
        return [MasteryPoint(concept_id=r["concept_id"], skill=r["skill"], mastery=r["next_prior"], observation_posterior=r["observation_posterior"], correct=bool(r["correct"]), parameter_version=r["parameter_version"], recorded_at=r["created_at"]) for r in rows]

    def recommendations(self, user_reference: str) -> list[AdaptiveRecommendation]:
        points = self.history(user_reference)
        latest = {point.concept_id: point for point in points}
        result = []
        for point in latest.values():
            concept_history = [p for p in points if p.concept_id == point.concept_id]
            streak = 0
            for item in reversed(concept_history):
                if not item.correct: break
                streak += 1
            action, rationale = recommendation_for(point.mastery, streak)
            result.append(AdaptiveRecommendation(concept_id=point.concept_id, skill=point.skill, mastery=point.mastery, action=action, rationale=rationale))
        return sorted(result, key=lambda item: item.mastery)

    def store_pending(self, request: QuestionGenerationRequest, question: GeneratedQuestionKey) -> PendingQuestionResponse:
        digest = hashlib.sha256(f"{request.concept_id}|{question.prompt}".encode()).hexdigest()[:24]
        question_id = f"q_groq_{digest}"
        with self.database.connect() as connection:
            connection.execute("""INSERT OR IGNORE INTO assessment_questions
                (id, concept_id, skill, prompt, choices_json, correct_choice, explanation, difficulty,
                 review_status, source, reviewed_by, reviewed_at, review_decision, question_bank_version)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', 'groq', NULL, NULL, NULL, 1)""", (question_id, request.concept_id,
                request.skill, question.prompt, json.dumps(question.choices, ensure_ascii=False), question.correct_choice,
                question.explanation, request.difficulty))
        return PendingQuestionResponse(id=question_id, concept_id=request.concept_id, skill=request.skill,
            prompt=question.prompt, choices=question.choices, difficulty=request.difficulty)

    def review_question(self, question_id: str, decision: str, reviewer: str) -> bool:
        if decision not in {"approved", "rejected"}:
            raise ValueError("decision must be approved or rejected")
        now = _now()
        with self.database.connect() as connection:
            row = connection.execute("SELECT review_status, question_bank_version FROM assessment_questions WHERE id=? AND source='groq'", (question_id,)).fetchone()
            if row is None:
                return False
            if row["review_status"] != "pending_review":
                raise ValueError("only pending questions may be reviewed")
            connection.execute("""UPDATE assessment_questions SET review_status=?, reviewed_by=?, reviewed_at=?,
                review_decision=?, question_bank_version=? WHERE id=?""",
                (decision, reviewer, now, decision, row["question_bank_version"] + 1, question_id))
        return True

    def pending_questions(self) -> list[dict[str, object]]:
        with self.database.connect() as connection:
            rows = connection.execute("""SELECT id, concept_id, skill, prompt, choices_json, correct_choice,
                explanation, difficulty, question_bank_version FROM assessment_questions
                WHERE review_status='pending_review' ORDER BY id""").fetchall()
        return [{**dict(row), "choices": json.loads(row["choices_json"])} for row in rows]
