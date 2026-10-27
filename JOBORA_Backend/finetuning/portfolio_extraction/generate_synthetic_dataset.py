"""Génère un corpus synthétique reproductible pour l'extraction Portfolio.

Les identités, entreprises, emails et téléphones sont fictifs. Le corpus sert à
amorcer une démonstration de fine-tuning ; il ne remplace pas un corpus réel,
consenti, anonymisé et relu par un humain.
"""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
SECTIONS = ("identity", "experiences", "projects", "skills")

FIRST_NAMES = [
    "Amira", "Sami", "Lina", "Youssef", "Nour", "Adam", "Inès", "Malek", "Aya", "Mehdi",
    "Sarah", "Omar", "Rim", "Aziz", "Mariem", "Elyes", "Syrine", "Rayen", "Farah", "Walid",
]
LAST_NAMES = [
    "Ben Salem", "Trabelsi", "Mansouri", "Gharbi", "Ayari", "Jaziri", "Khelifi", "Saidi",
    "Haddad", "Bouazizi", "Hamdi", "Karray", "Mejri", "Dridi", "Abid", "Chaabane",
]
LOCATIONS = ["Tunis", "Sfax", "Sousse", "Ariana", "Monastir", "Nabeul", "Bizerte", "Gabès"]
SCHOOLS = [
    "Université Exemple de Tunis", "Institut Numérique de Sfax", "École Supérieure des Technologies",
    "Faculté des Sciences Informatiques", "Institut Méditerranéen d'Ingénierie",
]
DEGREES = [
    ("Licence", "Informatique"), ("Master", "Génie logiciel"),
    ("Diplôme d'ingénieur", "Informatique"), ("Licence", "Systèmes d'information"),
]
ROLE_CONFIGS: list[dict[str, Any]] = [
    {
        "title": "Développeur frontend junior",
        "languages": ["TypeScript", "JavaScript"],
        "frameworks": ["React"], "tools": ["Git", "Figma"],
        "databases": ["Firebase"], "other": ["REST API"],
    },
    {
        "title": "Développeuse backend",
        "languages": ["TypeScript"], "frameworks": ["NestJS"],
        "tools": ["Git", "Docker", "Postman"],
        "databases": ["PostgreSQL", "MongoDB"], "other": ["REST API"],
    },
    {
        "title": "Ingénieur Java",
        "languages": ["Java"], "frameworks": ["Spring Boot"],
        "tools": ["Git", "Docker"], "databases": ["MySQL"], "other": ["CI/CD"],
    },
    {
        "title": "Développeuse Python",
        "languages": ["Python"], "frameworks": ["FastAPI"],
        "tools": ["Git", "Docker"], "databases": ["PostgreSQL"], "other": ["Linux"],
    },
    {
        "title": "Développeur mobile Flutter",
        "languages": ["Dart"], "frameworks": ["Flutter"],
        "tools": ["Git", "Figma"], "databases": ["Firebase"], "other": ["Agile"],
    },
    {
        "title": "Développeuse full-stack",
        "languages": ["TypeScript", "JavaScript"],
        "frameworks": ["React", "NestJS"], "tools": ["Git", "Docker"],
        "databases": ["MongoDB"], "other": ["REST API", "CI/CD"],
    },
    {
        "title": "Data analyst junior",
        "languages": ["Python"], "frameworks": [],
        "tools": ["Git"], "databases": ["PostgreSQL"], "other": ["Power BI"],
    },
    {
        "title": "Développeur PHP",
        "languages": ["PHP", "JavaScript"], "frameworks": ["Laravel", "Vue.js"],
        "tools": ["Git", "Docker"], "databases": ["MySQL"], "other": ["REST API"],
    },
]
CERTIFICATIONS = [
    ("Cloud Fundamentals", "Example Cloud Academy"),
    ("Git Essentials", "Example Dev Institute"),
    ("Agile Foundation", "Example Agile Board"),
    ("Database Fundamentals", "Example Data Academy"),
]


def compact(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def build_profile(index: int, split: str, rng: random.Random) -> tuple[str, dict[str, Any]]:
    first = FIRST_NAMES[index % len(FIRST_NAMES)]
    last = LAST_NAMES[(index * 3) % len(LAST_NAMES)]
    full_name = f"{first} {last}"
    slug = f"{first.lower()}.{last.lower().replace(' ', '')}.{split}{index:03d}"
    location = LOCATIONS[(index * 5) % len(LOCATIONS)]
    config = ROLE_CONFIGS[index % len(ROLE_CONFIGS)]
    degree, field = DEGREES[(index * 7) % len(DEGREES)]
    school = SCHOOLS[(index * 11) % len(SCHOOLS)]
    graduation = 2023 + index % 5
    start_year = graduation - (5 if degree == "Diplôme d'ingénieur" else 3)
    has_experience = index % 6 != 0
    has_certification = index % 3 != 0
    has_phone = index % 4 != 0
    has_website = index % 5 == 0
    company = f"{['Novatek', 'BlueSoft', 'DataNova', 'WebCraft', 'CloudLine'][index % 5]} {split.upper()}{index:03d}"
    project_name = f"{['JobTrack', 'SmartCampus', 'EcoMarket', 'TaskFlow', 'DataView'][index % 5]} {split.upper()}{index:03d}"
    experience_technologies = (config["languages"] + config["frameworks"] + config["databases"])[:3]
    project_technologies = (config["frameworks"] + config["languages"] + config["tools"])[:3]
    start_date = f"février {2022 + index % 3}"
    end_date = f"juin {2023 + index % 3}"
    role = config["title"].replace(" junior", "")
    experience_description = "Développement et maintenance de fonctionnalités applicatives"
    project_description = "Application de gestion avec authentification et tableau de bord"
    about = "Profil orienté développement logiciel et réalisation de projets numériques." if index % 2 == 0 else ""
    spoken_languages = [
        {"name": "Français", "level": "courant"},
        {"name": "Anglais", "level": ["A2", "B1", "B2", "C1"][index % 4]},
    ]
    certification_name, certification_issuer = CERTIFICATIONS[index % len(CERTIFICATIONS)]
    certifications = ([{
        "name": certification_name,
        "issuer": certification_issuer,
        "year": str(2023 + index % 4),
    }] if has_certification else [])
    education = [{
        "school": school, "degree": degree, "field": field,
        "startYear": str(start_year), "endYear": str(graduation),
    }]
    experiences = ([{
        "company": company, "role": role, "startDate": start_date, "endDate": end_date,
        "description": experience_description, "technologies": experience_technologies,
    }] if has_experience else [])
    projects = [{
        "name": project_name, "year": str(2024 + index % 3),
        "description": project_description, "technologies": project_technologies,
    }]
    links = {
        "linkedin": f"linkedin.com/in/{slug}" if index % 3 == 0 else "",
        "github": f"github.com/{slug.replace('.', '-')}" if index % 3 != 0 else "",
        "website": f"https://{slug}.example.test" if has_website else "",
    }
    identity = {
        "fullName": full_name, "title": config["title"],
        "email": f"{slug}@example.test",
        "phone": f"+216 2{index % 10} {100 + index:03d} {200 + index:03d}" if has_phone else "",
        "location": location, "links": links, "about": about, "education": education,
    }
    skills = {
        "languages": list(config["languages"]), "frameworks": list(config["frameworks"]),
        "tools": list(config["tools"]), "databases": list(config["databases"]),
        "other": list(config["other"]),
    }

    identity_lines = [
        full_name, f"{config['title']} — {location}", f"Email : {identity['email']}",
        *( [f"Téléphone : {identity['phone']}"] if identity["phone"] else [] ),
        *( [f"LinkedIn : {links['linkedin']}"] if links["linkedin"] else [] ),
        *( [f"GitHub : {links['github']}"] if links["github"] else [] ),
        *( [f"Site : {links['website']}"] if links["website"] else [] ),
        *( [f"Profil : {about}"] if about else [] ),
        f"FORMATION\n{degree} en {field}, {school}, {start_year}-{graduation}.",
    ]
    experience_lines = []
    if experiences:
        technologies = ", ".join(experience_technologies)
        experience_lines.append(
            f"EXPÉRIENCE\n{role} chez {company}, {start_date} à {end_date}. "
            f"{experience_description}. Technologies : {technologies}."
        )
    project_lines = [
        f"PROJET\n{project_name}, {projects[0]['year']} : {project_description}. "
        f"Technologies : {', '.join(project_technologies)}."
    ]
    skills_lines = [
        "COMPÉTENCES\n"
        f"Langages : {', '.join(skills['languages']) or 'aucun'}. "
        f"Frameworks : {', '.join(skills['frameworks']) or 'aucun'}. "
        f"Outils : {', '.join(skills['tools']) or 'aucun'}. "
        f"Bases de données : {', '.join(skills['databases']) or 'aucune'}. "
        f"Autres : {', '.join(skills['other']) or 'aucune'}."
    ]
    language_lines = [f"LANGUES PARLÉES\nFrançais courant, anglais {spoken_languages[1]['level']}."]
    certification_lines = []
    if certifications:
        certification_lines.append(
            f"CERTIFICATION\n{certification_name}, {certification_issuer}, {certifications[0]['year']}."
        )
    blocks = identity_lines + experience_lines + project_lines + skills_lines + language_lines + certification_lines
    if index % 2:
        blocks = blocks[:1] + blocks[2:4] + blocks[1:2] + blocks[4:]
    separator = "\n\n" if index % 3 else "\n• "
    cv_text = separator.join(blocks)
    output = {
        "identity": identity,
        "experiences": {"experiences": experiences},
        "projects": {"projects": projects},
        "skills": {"skills": skills, "languages": spoken_languages, "certifications": certifications},
    }
    return cv_text, output


def rows_for(count: int, split: str, seed: int) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    offset = 0 if split == "train" else 10_000
    rows: list[dict[str, Any]] = []
    for local_index in range(count):
        index = offset + local_index
        cv_text, outputs = build_profile(index, split, rng)
        cv_id = f"synthetic-{split}-{local_index + 1:03d}"
        for section in SECTIONS:
            rows.append({"cv_id": cv_id, "section": section, "cv_text": cv_text, "output": outputs[section]})
    return rows


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(compact(row) + "\n" for row in rows), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Génère le corpus synthétique Portfolio.")
    parser.add_argument("--train-cvs", type=int, default=80)
    parser.add_argument("--test-cvs", type=int, default=20)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "data")
    parser.add_argument("--seed", type=int, default=2026)
    args = parser.parse_args()
    if args.train_cvs < 2 or args.test_cvs < 1:
        raise ValueError("Il faut au moins 2 CV d'entraînement et 1 CV de test")
    train_rows = rows_for(args.train_cvs, "train", args.seed)
    test_rows = rows_for(args.test_cvs, "test", args.seed + 1)
    write_jsonl(args.output_dir / "train.annotations.jsonl", train_rows)
    write_jsonl(args.output_dir / "test.annotations.jsonl", test_rows)
    manifest = {
        "synthetic": True,
        "seed": args.seed,
        "train_cvs": args.train_cvs,
        "test_cvs": args.test_cvs,
        "train_examples": len(train_rows),
        "test_examples": len(test_rows),
        "sections": list(SECTIONS),
    }
    (args.output_dir / "dataset-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
