"""Module 4 - Lettre de motivation : logique déterministe (sans LLM).

Ce fichier ne dépend ni d'Ollama ni de spaCy afin d'être testable seul.
Il gère :
  1. la transformation du CV (anonymisé) en faits numérotés [E1], [P1]... ;
  2. la sélection des faits les plus pertinents pour l'offre (score explicable) ;
  3. la validation de la lettre produite par le LLM (chiffres inventés,
     compétences absentes du CV, données personnelles, Markdown...).
"""
from __future__ import annotations

import re
import unicodedata
from typing import Callable, Iterable

ROLES = ("introduction", "experience", "fit", "motivation")

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
URL_RE = re.compile(r"(https?://\S+|www\.\S+|\b(?:linkedin|github)\.com/\S*)", re.IGNORECASE)
PHONE_RE = re.compile(r"(?<!\w)(?:\+?\d[\d .-]{7,}\d)(?!\w)")
NUMBER_RE = re.compile(r"\d+(?:[.,]\d+)?")
PLACEHOLDER_RE = re.compile(r"\[[^\]]{2,60}\]")
MARKDOWN_RE = re.compile(r"(\*\*|__|^#+\s*|`)", re.MULTILINE)

STOPWORDS = {
    "avec", "pour", "dans", "votre", "notre", "vous", "nous", "sont", "être", "avoir",
    "will", "with", "your", "from", "that", "this", "have", "about", "their",
    "poste", "profil", "mission", "missions", "entreprise", "équipe", "equipe",
    "candidat", "recherchons", "rejoindre", "plus", "ainsi", "afin", "selon",
}


def norm(text: str) -> str:
    """Minuscules sans accents, pour comparer des compétences de façon robuste."""
    text = unicodedata.normalize("NFKD", text or "")
    return "".join(c for c in text if not unicodedata.combining(c)).lower().strip()


def scrub(text: str) -> str:
    """Retire emails, URLs et numéros de téléphone (défense en profondeur)."""
    text = EMAIL_RE.sub("", text or "")
    text = URL_RE.sub("", text)
    text = PHONE_RE.sub("", text)
    return re.sub(r"[ \t]{2,}", " ", text).strip()


def _flatten(value) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (list, tuple)):
        return ", ".join(p for p in (_flatten(v) for v in value) if p)
    if isinstance(value, dict):
        return " ; ".join(p for p in (_flatten(v) for k, v in value.items() if k not in ("link", "url", "id")) if p)
    return ""


def _first(item: dict, *keys: str) -> str:
    for key in keys:
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _dates(item: dict) -> str:
    start = _first(item, "startDate", "start_date", "start")
    end = _first(item, "endDate", "end_date", "end")
    return f" ({start} - {end})" if start and end else f" ({start or end})" if (start or end) else ""


def _experience_fact(item: dict) -> tuple[str, str]:
    title = _first(item, "jobTitle", "title", "position", "role")
    company = _first(item, "company", "organization", "employer")
    label = " chez ".join(p for p in (title, company) if p) or "Expérience"
    details = _flatten({k: v for k, v in item.items() if k not in (
        "jobTitle", "title", "position", "role", "company", "organization", "employer",
        "startDate", "endDate", "start_date", "end_date", "start", "end", "location")})
    return label, f"{label}{_dates(item)} : {details}".strip(" :")


def _project_fact(item: dict) -> tuple[str, str]:
    name = _first(item, "name", "title") or "Projet"
    details = _flatten({k: v for k, v in item.items() if k not in ("name", "title")})
    return name, f"Projet {name}{_dates(item)} : {details}".strip(" :")


def _education_fact(item: dict) -> tuple[str, str]:
    degree = _first(item, "degree", "diploma", "title")
    school = _first(item, "institution", "school")
    label = " - ".join(p for p in (degree, school) if p) or "Formation"
    extra = _first(item, "description", "field", "speciality", "specialty")
    return label, f"{label}{_dates(item)}{' : ' + extra if extra else ''}"


def _chunks(text: str, size: int = 420) -> list[str]:
    blocks = [b.strip() for b in re.split(r"\n\s*\n|\n(?=[A-ZÉÈ•\-])", text or "") if b.strip()]
    chunks, current = [], ""
    for block in blocks:
        if len(current) + len(block) > size and current:
            chunks.append(current)
            current = block
        else:
            current = f"{current}\n{block}".strip()
    if current:
        chunks.append(current)
    return chunks


def offer_keywords(offer_text: str, offer_skills: Iterable[str]) -> tuple[set[str], set[str]]:
    skills = {norm(s) for s in offer_skills if s and s.strip()}
    words = {w for w in re.findall(r"[a-z0-9+#.]{5,}", norm(offer_text)) if w not in STOPWORDS}
    return skills, words


def relevance(text: str, skills: set[str], words: set[str]) -> int:
    """Score explicable : 3 points par compétence de l'offre citée, 1 point par mot-clé (max 5)."""
    t = norm(text)
    skill_hits = sum(1 for s in skills if re.search(rf"(?<![a-z0-9]){re.escape(s)}(?![a-z0-9])", t))
    word_hits = min(5, sum(1 for w in words if w in t))
    return 3 * skill_hits + word_hits


def build_facts(cv: dict, offer_text: str, offer_skills: list[str], cv_skills: list[str],
                max_experiences: int = 2, max_projects: int = 2) -> dict:
    """Transforme le CV en faits numérotés et ne garde que les plus pertinents pour l'offre."""
    skills, words = offer_keywords(offer_text, offer_skills)
    facts: list[dict] = []

    def pick(items: list, maker, prefix: str, kind: str, limit: int):
        scored = []
        for index, item in enumerate(items or []):
            if not isinstance(item, dict):
                continue
            label, text = maker(item)
            text = scrub(text)
            if len(text) < 3:
                continue
            scored.append((relevance(text, skills, words), -index, label, text))
        scored.sort(reverse=True)
        chosen = [s for s in scored if s[0] > 0][:limit] or scored[:1]
        for n, (score, _, label, text) in enumerate(chosen, start=1):
            facts.append({"id": f"{prefix}{n}", "kind": kind, "label": label, "text": text[:600], "score": score})

    pick(cv.get("experiences", []), _experience_fact, "E", "experience", max_experiences)
    pick(cv.get("projects", []), _project_fact, "P", "project", max_projects)
    pick(cv.get("education", [])[:1], _education_fact, "F", "education", 1)

    raw = scrub(cv.get("raw_text", ""))
    if raw:
        scored = sorted(((relevance(c, skills, words), -i, c) for i, c in enumerate(_chunks(raw))), reverse=True)
        for n, (score, _, chunk) in enumerate(scored[:4], start=1):
            facts.append({"id": f"T{n}", "kind": "cv_text", "label": f"Extrait du CV {n}", "text": chunk[:600], "score": score})

    objective = scrub(_first(cv, "career_objective", "summary", "target_job"))
    if objective:
        facts.append({"id": "O", "kind": "objective", "label": "Objectif professionnel", "text": objective[:400], "score": 0})

    declared = {norm(s): s for s in cv_skills if s and s.strip()}
    matched = sorted({declared[s] for s in declared if s in skills}, key=str.lower)
    missing = sorted({s for s in offer_skills if norm(s) not in declared}, key=str.lower)
    soft = [s for s in cv.get("soft_skills", []) if isinstance(s, str)]
    languages = _flatten(cv.get("languages", []))
    skill_text = "Compétences déclarées : " + ", ".join(list(declared.values())[:30])
    if soft:
        skill_text += " | Savoir-être : " + ", ".join(soft[:10])
    if languages:
        skill_text += " | Langues : " + languages
    if declared or soft or languages:
        facts.append({"id": "S", "kind": "skills", "label": "Compétences", "text": skill_text[:700], "score": len(matched)})

    return {"facts": facts, "matched_skills": matched, "missing_skills": missing}


def facts_block(facts: list[dict]) -> str:
    return "\n".join(f"[{f['id']}] {f['text']}" for f in facts)


def clean_text(text: str) -> str:
    text = MARKDOWN_RE.sub("", text or "")
    text = scrub(text)
    return re.sub(r"\s+", " ", text).strip()


def validate_letter(paragraphs: dict[str, dict], facts: list[dict], cv_corpus: str, offer_text: str,
                    extract_skills: Callable[[str], list[str]], cv_skills: list[str]) -> tuple[list[dict], list[str]]:
    """Nettoie la sortie du LLM et produit des avertissements explicables.

    Retourne (paragraphes validés, avertissements). Lève ValueError si un paragraphe est vide.
    """
    valid_ids = {f["id"] for f in facts}
    known_numbers = set(NUMBER_RE.findall(cv_corpus)) | set(NUMBER_RE.findall(offer_text))
    declared = {norm(s) for s in cv_skills}
    corpus_norm = norm(cv_corpus)
    warnings: list[str] = []
    result: list[dict] = []

    for role in ROLES:
        item = paragraphs.get(role) or {}
        text = clean_text(item.get("text", ""))
        if len(text) < 20:
            raise ValueError(f"Paragraphe '{role}' vide ou trop court.")
        sources = [s for s in dict.fromkeys(item.get("sources", [])) if s in valid_ids]
        result.append({"role": role, "text": text, "sources": sources})

    full = " ".join(p["text"] for p in result)
    for number in sorted(set(NUMBER_RE.findall(full)) - known_numbers):
        warnings.append(f"Le chiffre « {number} » n'apparaît pas dans tes données : vérifie-le ou supprime-le.")
    for skill in sorted(set(extract_skills(full)), key=str.lower):
        n = norm(skill)
        if n not in declared and n not in corpus_norm:
            warnings.append(f"« {skill} » est cité mais absent de ton CV : il ne doit pas être présenté comme acquis.")
    for placeholder in sorted(set(PLACEHOLDER_RE.findall(full))):
        warnings.append(f"Champ à compléter détecté : {placeholder}.")
    return result, warnings


def formulas(language: str, tone: str) -> dict[str, str]:
    """Formules d'appel et de politesse : écrites par le code, jamais par le LLM."""
    if language == "en":
        return {"salutation": "Dear Hiring Manager,",
                "closing": "Yours sincerely," if tone == "formel" else "Kind regards,"}
    if tone == "formel":
        return {"salutation": "Madame, Monsieur,",
                "closing": "Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées."}
    return {"salutation": "Madame, Monsieur,",
            "closing": "Dans l'attente de votre retour, je vous adresse mes sincères salutations."}
