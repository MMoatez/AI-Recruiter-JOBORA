import re

from .llm import ask
from .prompts import SYSTEM_Q, SYSTEM_VERIFY, build_question_prompt, build_verify_prompt
from .schemas import LLMQuestion, OfferAnalysis, Question, Verdict

_META = re.compile(r"documentation|mentionn|le texte|ci-dessus", re.IGNORECASE)
_FIRST_PERSON = re.compile(r"^\s*(j['’]|je\s)", re.IGNORECASE)

# Un thème par question RH, pour que le passage récupéré corresponde à la question
RH_THEMES = [
    "se présenter en deux minutes",
    "conflit dans une équipe et gestion des conflits",
    "échec et apprentissage",
    "pourquoi ce poste et cette entreprise",
    "forces et faiblesses",
    "gestion du stress et des délais",
    "projection dans cinq ans et motivation",
    "questions à poser au recruteur",
]


def unique_skills(offer: OfferAnalysis) -> list[str]:
    seen, out = set(), []
    for s in offer.skills + offer.technologies:
        k = s.strip().lower()
        if k and k not in seen:
            seen.add(k)
            out.append(s.strip())
    return out


def plan_slots(skills: list[str], qtype: str, count: int) -> list[tuple[str, str]]:
    """Décide, AVANT d'appeler le LLM, la compétence et le type de chaque question."""
    cycle = ["qcm", "ouverte", "technique", "rh"] if qtype == "mixte" else [qtype]
    slots, i = [], 0
    for n in range(count):
        t = cycle[n % len(cycle)]
        if t == "rh":
            slots.append(("RH", "rh"))
        else:
            slots.append((skills[i % len(skills)] if skills else "Général", t))
            i += 1
    return slots


def _words(s: str) -> set[str]:
    return set(re.findall(r"\w+", s.lower()))


def _bad_options(opts: list[str]) -> bool:
    """Options trop longues, ou quasi identiques entre elles (ex. deux phrases aux mots permutés)."""
    if any(len(o.split()) > 20 for o in opts):
        return True
    for i in range(len(opts)):
        for j in range(i + 1, len(opts)):
            a, b = _words(opts[i]), _words(opts[j])
            if a and b and len(a & b) / len(a | b) >= 0.6:
                return True
    return False


def _is_supported(doc, question, answer) -> bool:
    """2e passage du LLM : la réponse est-elle appuyée par la fiche ? (relire est plus fiable qu'écrire)"""
    try:
        v = ask(SYSTEM_VERIFY, build_verify_prompt(doc, question, answer), Verdict, temperature=0.0)
    except RuntimeError:
        return False
    return v.supported


def _try_once(offer, cv, skill, qtype, level, doc, asked, verify, answer_type="qcm"):
    try:
        r = ask(SYSTEM_Q,
                build_question_prompt(offer, cv, skill, "qcm", level, doc, asked, answer_type, category=qtype),
                LLMQuestion, temperature=0.3)
    except RuntimeError:
        return None
    question = r.question.strip()
    explanation = r.explanation.strip()
    if len(question) < 10 or len(explanation) < 10 or _META.search(question):
        return None
    source = f"{doc['source']} / {doc['title']}" if doc else None

    if answer_type == "qcm":
        opts = [o.strip() for o in r.options]
        if len(opts) != 4 or len({o.lower() for o in opts}) != 4 or _bad_options(opts):
            return None
        if r.correct_index not in (0, 1, 2, 3):
            return None
        answer, options, idx = opts[r.correct_index], opts, r.correct_index
    else:
        answer, options, idx = r.expected_answer.strip(), [], None
        if len(answer) < 10 or answer.isdigit() or _FIRST_PERSON.match(answer):
            return None

    verified = None
    if verify and doc and qtype != "rh":
        if not _is_supported(doc, question, answer):
            return None
        verified = True

    return Question(skill=skill, type=qtype, question=question, options=options,
                    correct_index=idx, expected_answer=answer, explanation=explanation,
                    difficulty=level, source=source, verified=verified)


def generate_one(offer, cv, skill, qtype, level, docs, asked, tries_per_doc=2, verify=True, answer_type="qcm"):
    """Génère une question avec une seconde tentative uniquement si la première est invalide."""
    for doc in (docs or [None]):
        for _ in range(tries_per_doc):
            q = _try_once(offer, cv, skill, qtype, level, doc, asked, verify, answer_type)
            if q:
                q.type = answer_type
                return q
    return None


def user_turn_count(history: list[dict]) -> int:
    return sum(1 for message in history if message.get("role") == "user")


def mock_finished(history: list[dict], max_turns: int) -> bool:
    return user_turn_count(history) >= max(1, max_turns)