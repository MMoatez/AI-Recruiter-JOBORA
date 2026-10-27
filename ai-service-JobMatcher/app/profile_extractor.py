"""Candidate profile extraction: deterministic skill detection + provider merge.

Deterministic detection is a safety net grounded in the document; the provider
adds structure (experience, seniority, titles, education). Missing information
stays unknown - the merge never invents values.
"""

from __future__ import annotations

import re

from .cv_parser import normalize_text, redact_contact
from .prompts import PROFILE_SYSTEM, profile_user_text
from .providers.base import Provider
from .schemas import CandidateProfile, ProfileModelOutput, Seniority

# Canonical skill -> regex that matches it as a whole token. Special characters
# (C++, C#, Node.js, CI/CD) are escaped explicitly.
_SKILL_PATTERNS: list[tuple[str, str]] = [
    ("Python", r"python"),
    ("JavaScript", r"java\s*script"),
    ("TypeScript", r"type\s*script"),
    ("Java", r"\bjava\b"),
    ("C#", r"c\s*#"),
    ("C++", r"c\s*\+\+"),
    ("PHP", r"\bphp\b"),
    ("Ruby", r"\bruby\b"),
    ("Go", r"\bgolang\b|\bgo\s*lang\b"),
    ("Rust", r"\brust\b"),
    ("Kotlin", r"\bkotlin\b"),
    ("Swift", r"\bswift\b"),
    ("HTML", r"html"),
    ("CSS", r"\bcss\b|s?css\b"),
    ("React", r"\breact(\.js)?\b"),
    ("Angular", r"\bangular\b"),
    ("Vue", r"\bvue(\.js)?\b"),
    ("Node.js", r"node(\.js|js)?"),
    ("Express", r"\bexpress(\.js)?\b"),
    ("NestJS", r"nestjs"),
    ("Next.js", r"next(\.js|js)"),
    ("Django", r"\bdjango\b"),
    ("Flask", r"\bflask\b"),
    ("FastAPI", r"fast\s*api"),
    ("Spring", r"\bspring(\s*boot)?\b"),
    ("Laravel", r"\blaravel\b"),
    (".NET", r"\b\.?net\b|\bdotnet\b|asp\.net"),
    ("SQL", r"\bsql\b"),
    ("PostgreSQL", r"postgre\s?sql|\bpostgres\b"),
    ("MySQL", r"my\s*sql"),
    ("MongoDB", r"mongo\s?db"),
    ("SQLite", r"sqlite"),
    ("Redis", r"\bredis\b"),
    ("GraphQL", r"graph\s?ql"),
    ("REST", r"\brest(ful)?\b|api\s+rest"),
    ("Docker", r"\bdocker\b"),
    ("Kubernetes", r"kubernetes|\bk8s\b"),
    ("Git", r"\bgit\b"),
    ("GitHub", r"github"),
    ("GitLab", r"gitlab"),
    ("Jenkins", r"\bjenkins\b"),
    ("CI/CD", r"ci\s*/\s*cd|\bci\s*cd\b|continuous\s+integration"),
    ("AWS", r"\baws\b|amazon\s+web\s+services"),
    ("Azure", r"\bazure\b"),
    ("Google Cloud", r"google\s+cloud|\bgcp\b"),
    ("Linux", r"linux"),
    ("Bash", r"\bbash\b|shell\s*script"),
    ("TensorFlow", r"tensor\s*flow"),
    ("PyTorch", r"py\s*torch"),
    ("scikit-learn", r"scikit\s*learn|sklearn"),
    ("Pandas", r"\bpandas\b"),
    ("NumPy", r"numpy"),
    ("Machine Learning", r"machine\s+learning|apprentissage\s+automatique"),
    ("Data Analysis", r"data\s+analysis|analyse\s+de\s+donn[ée]es"),
    ("Excel", r"excel"),
    ("Power BI", r"power\s*bi"),
    ("Tableau", r"\btableau\b"),
    ("SAP", r"\bsap\b"),
    ("Salesforce", r"salesforce"),
    ("Jira", r"\bjira\b"),
    ("Figma", r"\bfigma\b"),
    ("Photoshop", r"photoshop"),
    ("Premiere Pro", r"premiere\s*pro"),
    ("SEO", r"\bseo\b"),
    ("Google Analytics", r"google\s+analytics"),
    ("Agile", r"\bagile\b"),
    ("Scrum", r"\bscrum\b"),
    ("Kanban", r"\bkanban\b"),
    ("Project Management", r"gestion\s+de\s+projet|project\s+management"),
    ("Leadership", r"\bleadership\b"),
    ("Team Management", r"management\s+d'?[ée]quipe|team\s+management"),
    ("Communication", r"\bcommunication\b"),
    ("Problem Solving", r"r[ée]solution\s+de\s+probl[èe]mes|problem\s+solving"),
    ("UX/UI", r"ux\s*/?\s*ui|user\s+experience"),
    ("Sales", r"\bvente\b|\bsales\b"),
    ("Customer Service", r"service\s+client|customer\s+service"),
]

_COMPILED = [(name, re.compile(pattern, re.IGNORECASE)) for name, pattern in _SKILL_PATTERNS]

_ALIAS = {
    "js": "JavaScript",
    "ts": "TypeScript",
    "tsql": "SQL",
    "postgres": "PostgreSQL",
    "mongo": "MongoDB",
    "k8s": "Kubernetes",
    "node": "Node.js",
    "nodejs": "Node.js",
    "reactjs": "React",
    "vuejs": "Vue",
    "nextjs": "Next.js",
    "amazon web services": "AWS",
    "gcp": "Google Cloud",
    "scikit learn": "scikit-learn",
    "sklearn": "scikit-learn",
    "ms excel": "Excel",
    "power-bi": "Power BI",
    "ci cd": "CI/CD",
    "cicd": "CI/CD",
}


def normalize_skill(raw: str) -> str:
    cleaned = re.sub(r"\s+", " ", raw).strip().strip(",;:.")
    if not cleaned:
        return ""
    return _ALIAS.get(cleaned.lower(), cleaned)


def _dedupe_key(skill: str) -> str:
    return re.sub(r"[\s./#-]+", "", skill.lower())


def merge_skills(*groups: list[str], limit: int = 150) -> list[str]:
    """Case-insensitive union of skill lists, first spelling wins, capped."""
    merged: list[str] = []
    seen: set[str] = set()
    for group in groups:
        for item in group:
            skill = normalize_skill(str(item))
            if not skill:
                continue
            key = _dedupe_key(skill)
            if key in seen:
                continue
            seen.add(key)
            merged.append(skill)
            if len(merged) >= limit:
                return merged
    return merged


def detect_skills(text: str) -> list[str]:
    found: list[str] = []
    for name, pattern in _COMPILED:
        if pattern.search(text):
            found.append(name)
    return found


def extract_profile(cv_text: str, provider: Provider) -> CandidateProfile:
    """Build an evidence-based candidate profile from CV text.

    Contact details are redacted locally before the text is sent to the
    provider. Deterministic detection and provider output are merged; unknown
    fields remain None/empty instead of being guessed.
    """
    normalized = normalize_text(cv_text)
    redacted = redact_contact(normalized)
    deterministic_skills = detect_skills(redacted)

    output = provider.complete_json(
        PROFILE_SYSTEM,
        profile_user_text(redacted),
        ProfileModelOutput,
    )

    try:
        seniority = Seniority(output.seniority.lower())
    except (ValueError, AttributeError):
        seniority = Seniority.unknown

    return CandidateProfile(
        skills=merge_skills(deterministic_skills, list(output.skills)),
        experience_years=output.experience_years,
        seniority=seniority,
        job_titles=[t.strip() for t in output.job_titles if t.strip()][:30],
        languages=[t.strip() for t in output.languages if t.strip()][:20],
        education=[t.strip() for t in output.education if t.strip()][:30],
        certifications=[t.strip() for t in output.certifications if t.strip()][:30],
        preferred_locations=[t.strip() for t in output.preferred_locations if t.strip()][:20],
        work_preferences=[t.strip() for t in output.work_preferences if t.strip()][:20],
    )
