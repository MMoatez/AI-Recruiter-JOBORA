# Module 4 — Lettre de motivation (JOBORA)

Génère une lettre de motivation personnalisée à partir d'un CV (CV JOBORA existant ou PDF importé) et d'une offre d'emploi, avec un LLM local (Ollama + `qwen2.5:7b`), sans API payante.

## 1. Intégration dans le dépôt (3 modifications)

Copier les fichiers de ce dossier aux mêmes chemins dans le dépôt, puis :

**a) `JOBORA_Backend/src/app.module.ts`** — ajouter le module :

```ts
import { LettreModule } from "./lettre/lettre.module"
// ...
  imports: [ /* ... */, CvModule, EntretienModule, LettreModule ],
```

**b) `ai-service-Skillora/app/main.py`** — brancher le routeur (après `app = FastAPI()`) :

```python
from .letter import router as letter_router
app.include_router(letter_router)
```

**c) Frontend** — rien à ajouter : `LetterPage.tsx` remplace la maquette existante (même nom, même export par défaut), la page déjà branchée dans la navigation devient fonctionnelle ; `letterService.ts` est un nouveau fichier à côté.

Aucune nouvelle dépendance : le module réutilise FastAPI, Ollama, pdfplumber, spaCy (`extract_skills`) et NestJS/Mongoose déjà présents. La variable facultative `LETTER_NUM_PREDICT` (défaut 1000) règle la longueur maximale générée.

## 2. Architecture

```
React (LetterPage)
  │  POST /api/lettres  (JWT)
  ▼
NestJS LettreModule ── lit le CV dans MongoDB (id + userId)
  │  anonymisation : personalInformation retiré, emails / téléphones / liens / nom effacés
  │  POST http://127.0.0.1:8000/letter/generate
  ▼
FastAPI ai-service-Skillora
  1. spaCy : compétences de l'offre et du CV
  2. sélection déterministe des faits pertinents ([E1], [P1], [F1], [S]…)
  3. Ollama qwen2.5:7b : JSON imposé (4 paragraphes + sources)
  4. validation : chiffres inventés, compétences absentes du CV, Markdown, données perso
  ▼
NestJS enregistre dans MongoDB (collection cover_letters) → React affiche, édite, exporte
```

| Fonction IA | Où | Type |
|---|---|---|
| Extraction des compétences de l'offre et du CV | `skills.py` (spaCy, existant) | NLP déterministe |
| Sélection des expériences / projets pertinents | `letter_logic.build_facts` | Score explicable : 3 pts par compétence de l'offre citée + 1 pt par mot-clé (max 5) |
| Rédaction de la lettre | `letter.py` → Ollama | LLM local, sortie JSON forcée |
| Réécriture d'un paragraphe (régénérer, raccourcir, plus formel, plus dynamique) | `letter.py` `/letter/rewrite` | LLM local |
| Contrôle anti-hallucination | `letter_logic.validate_letter` | Règles déterministes |

Les formules d'appel et de politesse et la signature sont écrites par le code, jamais par le LLM : le nom du candidat n'est donc jamais envoyé au modèle.

## 3. API

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/lettres/cvs` | CV de l'utilisateur utilisables comme source |
| POST | `/api/lettres` | Générer une lettre `{ cvId \| cvText, offerText, language, tone, company? }` |
| GET | `/api/lettres` | Lister mes lettres |
| GET | `/api/lettres/:id` | Lire une lettre possédée |
| PATCH | `/api/lettres/:id` | Enregistrer les modifications (l'état précédent devient une version) |
| POST | `/api/lettres/:id/paragraphes/:index/reecrire` | Réécrire un paragraphe `{ action }` |
| DELETE | `/api/lettres/:id` | Supprimer |

Service IA : `POST /letter/generate`, `POST /letter/rewrite`. Le PDF est lu par la route existante `POST /api/entretien/cv`.

## 4. Respect du cahier des charges

| Exigence | Réalisation |
|---|---|
| Pas de données personnelles brutes au LLM | `personalInformation` jamais transmis ; emails, téléphones, liens et nom effacés (`lettre.privacy.ts` puis `letter_logic.scrub`) ; le modèle reçoit l'ordre de n'écrire aucune identité |
| Sortie validée avant affichage | Schéma JSON Pydantic imposé à Ollama, 2 tentatives, paragraphes vides rejetés, sources filtrées, Markdown retiré, avertissements affichés |
| Erreurs d'appel (timeout, service absent) | `AbortController` + `AI_SERVICE_TIMEOUT_MS` ; 503 / 504 / 502 avec messages clairs, comme le module Entretien |
| Prompts présentés | Section 5 |

## 5. Prompts (version `LETTER_GENERATE_001_V1`)

Source exécutable : `ai-service-Skillora/app/letter.py`.

**Prompt système** — rôle d'expert RH ; contenu des balises `<offre>` et `<faits_candidat>` déclaré comme donnée non fiable (défense contre la prompt injection) ; règles : n'utiliser que les faits numérotés, ne jamais revendiquer une compétence absente des faits, aucune identité, pas de formule d'appel ni de politesse, pas de Markdown, JSON uniquement.

**Prompt de génération** — langue, ton, entreprise, compétences de l'offre présentes / absentes du profil, offre et faits entre délimiteurs ; tâche structurée en 4 paragraphes (introduction, expérience, adéquation, motivation), sources par paragraphe, 220 à 330 mots ; exemple few-shot positif et négatif (chiffre inventé, compétence non acquise).

**Prompt de réécriture** — même contexte + paragraphe actuel et autres paragraphes ; consigne selon l'action (régénérer, raccourcir de 40 %, plus formel, plus dynamique).

Techniques : role prompting, délimiteurs, contraintes de non-invention, sortie structurée (JSON Schema via Ollama `format`), few-shot positif/négatif, citation des sources ([E1], [P1]…), validation post-génération.

## 6. Tests

```bash
# Service IA (sans Ollama)
cd ai-service-Skillora
python -m unittest test_letter_logic -v      # 9 tests

# Backend
cd JOBORA_Backend
npm test -- lettre                            # lettre.privacy.spec.ts, 4 tests
```

Les tests couvrent : sélection de l'expérience la plus pertinente, compétences couvertes / manquantes, suppression des liens et coordonnées, détection d'un chiffre inventé et d'une compétence absente du CV, rejet d'un paragraphe vide, anonymisation côté NestJS.

## 7. Scénario de démonstration

1. Lancer Ollama, le service IA, le backend et le frontend.
2. Ouvrir « Lettre de motivation », choisir un CV JOBORA (ou importer un PDF).
3. Coller une offre contenant une compétence absente du CV (ex. Docker), choisir le ton.
4. Générer : montrer les sources [E1], [P1] utilisées, les exigences couvertes et la compétence absente non revendiquée.
5. Cliquer sur un paragraphe → « Raccourcir » ; modifier un mot à la main → Enregistrer ; ouvrir « Versions ».
6. Exporter en PDF (impression navigateur, seule la lettre est imprimée).

## 8. Limites

- Le modèle local 7B peut produire une formulation imparfaite ; les avertissements signalent les risques mais ne garantissent pas zéro hallucination.
- La détection des compétences dépend du dictionnaire `skills.json` du service.
- Génération plus lente qu'une API cloud (environ 30 s à 2 min selon le PC).
