"""Contrats d'extraction appris par le modèle Portfolio."""

from __future__ import annotations

import json


SECTIONS = ("identity", "experiences", "projects", "skills")

SCHEMAS: dict[str, dict] = {
    "identity": {
        "fullName": "string",
        "title": "string",
        "email": "string",
        "phone": "string",
        "location": "string",
        "links": {"linkedin": "string", "github": "string", "website": "string"},
        "about": "string",
        "education": [{
            "school": "string", "degree": "string", "field": "string",
            "startYear": "string", "endYear": "string",
        }],
    },
    "experiences": {"experiences": [{
        "company": "string", "role": "string", "startDate": "string",
        "endDate": "string", "description": "string", "technologies": ["string"],
    }]},
    "projects": {"projects": [{
        "name": "string", "year": "string", "description": "string",
        "technologies": ["string"],
    }]},
    "skills": {
        "skills": {
            "languages": ["string"], "frameworks": ["string"],
            "tools": ["string"], "databases": ["string"], "other": ["string"],
        },
        "languages": [{"name": "string", "level": "string"}],
        "certifications": [{"name": "string", "issuer": "string", "year": "string"}],
    },
}

SECTION_TASKS = {
    "identity": "Extrais uniquement l'identité, les contacts, les liens, la présentation et les études.",
    "experiences": "Extrais uniquement les expériences professionnelles.",
    "projects": "Extrais uniquement les projets.",
    "skills": "Extrais uniquement les compétences, les langues parlées et les certifications.",
}


def system_prompt(section: str) -> str:
    if section not in SCHEMAS:
        raise ValueError(f"Section inconnue : {section}")
    schema = json.dumps(SCHEMAS[section], ensure_ascii=False, separators=(",", ":"))
    return (
        "[TASK:portfolio_extraction] Utilise UNIQUEMENT ce qui est écrit dans le texte. "
        "N'invente rien. Si une information est absente, utilise une chaîne vide ou un tableau vide. "
        "Réponds uniquement en JSON valide et n'ajoute aucune clé.\n"
        f"[SECTION:{section}]\n{SECTION_TASKS[section]}\nSchéma JSON exact :\n{schema}"
    )
