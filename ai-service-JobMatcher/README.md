# JOBORA — Service IA Job Matcher

Service FastAPI interne qui transforme un CV en profil structuré, analyse des offres et renvoie un classement explicable. Il n'est jamais appelé par le navigateur : seul le backend NestJS l'interroge, avec un jeton interne partagé.

```
React (JOBORA_Frontend) → NestJS (/api/job-matcher) → FastAPI (127.0.0.1:8010) → Groq API
```

## Ports

| Service | Port |
| --- | ---: |
| Skillora AI (Ollama) | 8000 |
| RAG | 8001 |
| Training AI (SBERT) | 8002 |
| **Job Matcher AI** | **8010** |
| API NestJS | 3000 |
| Frontend Vite | 8443 |

Le port est configurable via `JOB_MATCHER_PORT`. `8010` a été vérifié libre avant l'implémentation.

## Structure

```
app/
  main.py              # routes FastAPI, jeton interne, mapping des erreurs
  config.py            # variables d'environnement, poids et seuils
  schemas.py           # contrats Pydantic (requêtes, réponses, sorties Groq)
  cv_parser.py         # extraction PDF locale, normalisation, anonymisation
  profile_extractor.py # profil candidat (Groq + signaux déterministes)
  job_analyzer.py      # exigences d'une offre (Groq + champs structurés)
  matching_engine.py   # règles d'éligibilité et score pondéré
  ranking.py           # shortlist et tri stable
  prompts.py           # prompts + garde anti-injection
  providers/base.py    # interface Provider et erreurs typées
  providers/groq_provider.py
tests/                 # pytest, Groq toujours simulé
```

## Endpoints

Tous les endpoints métier exigent l'en-tête `x-job-matcher-internal-token`. `GET /health` reste ouvert mais n'expose que le statut, le modèle et la configuration du fournisseur (jamais la clé).

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/health` | Statut opérationnel |
| POST | `/parse-cv` | `cv_text` (form) ou `file` PDF → profil structuré |
| POST | `/analyze-job` | `job` → exigences normalisées |
| POST | `/match-jobs` | `profile` + `jobs[]` → résultats classés, écarts, explications |

Le service reçoit des offres complètes et fiables depuis NestJS ; il ne lit aucun identifiant fourni par le navigateur.

## Pipeline

1. **Extraction locale** du PDF (`pdfplumber`), normalisation des espaces et césures, suppression des e-mails et téléphones.
2. **Profil candidat** : Groq structure les informations, complété par un dictionnaire de compétences et des motifs d'expérience. Une information absente reste inconnue.
3. **Analyse des offres** : les champs structurés envoyés par NestJS (skills requis, expérience minimale, séniorité, lieu, organisation) sont autoritaires ; Groq et l'analyse déterministe ajoutent ce que le texte contient réellement.
4. **Éligibilité transparente** : une offre est écartée uniquement si l'expérience connue du candidat est inférieure à l'exigence (tolérance configurable, 1 an par défaut). Aucune caractéristique protégée n'est utilisée.
5. **Score pondéré** (0–100) : compétences requises 40 %, appréciées 15 %, expérience 20 %, séniorité 10 %, proximité sémantique 15 %. Les poids sont renormalisés sur les seuls critères connus : une donnée inconnue est exclue du dénominateur, pas comptée comme un échec. Une offre sans aucun signal connu n'obtient aucun score et n'est pas inventée.
6. **Explications** : Groq compare le profil aux meilleures offres et propose des raisons et recommandations courtes. Le score, l'ordre et l'éligibilité viennent uniquement du calcul déterministe ; le texte du modèle ne peut pas les modifier.

Le tri est stable : score décroissant puis `job_id` croissant.

## Fournisseur Groq

- Modèle dédié `GROQ_MODEL_JOB_MATCHER` (le modèle du service Training n'est pas modifié).
- Sortie JSON forcée puis validée par Pydantic ; toute réponse non conforme est rejetée.
- Retry borné (`GROQ_MAX_RETRIES`) uniquement sur 429, 5xx, timeouts et erreurs réseau, avec backoff.
- 400/422, JSON invalide, schéma invalide et 401 ne sont pas rejoués.
- Les erreurs sont renvoyées comme `502`/`503`/`504` avec un message générique ; aucun score n'est fabriqué.
- Aucun log ne contient la clé, le prompt, le CV ou les coordonnées.

## Configuration

Copier `.env.example` vers `.env` et renseigner les valeurs locales. Les variables d'environnement du processus restent prioritaires.

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `JOB_MATCHER_PORT` | `8010` | Port d'écoute |
| `JOB_MATCHER_HOST` | `127.0.0.1` | Interface d'écoute |
| `JOB_MATCHER_INTERNAL_TOKEN` | — | Jeton partagé ; repli sur `TRAINING_AI_INTERNAL_TOKEN` |
| `GROQ_API_KEY` | — | Clé Groq, côté serveur uniquement |
| `GROQ_MODEL_JOB_MATCHER` | `openai/gpt-oss-20b` | Modèle dédié |
| `GROQ_TIMEOUT_SECONDS` | `60` | Timeout HTTP fournisseur |
| `GROQ_MAX_RETRIES` | `2` | Tentatives totales |
| `JOB_MATCHER_EXPLAIN_TOP_N` | `10` | Offres expliquées par Groq |
| `JOB_MATCHER_MAX_JOBS` | `200` | Limite par requête |
| `JOB_MATCHER_WEIGHT_*` | voir ci-dessus | Pondération |
| `JOB_MATCHER_EXPERIENCE_TOLERANCE` | `1` | Tolérance en années |

Ne jamais commiter `.env` ni une clé réelle.

## Installation et lancement (Windows)

```powershell
cd "C:\Users\HP\JOBORA"
npm run job-matcher-ai:setup:windows
# Créer ai-service-JobMatcher\.env à partir de .env.example (clé Groq + jeton)
npm run job-matcher-ai:dev
```

Sans passer par npm :

```powershell
cd ai-service-JobMatcher
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```

Vérification : `Invoke-RestMethod http://127.0.0.1:8010/health`.

## Tests

```powershell
cd ai-service-JobMatcher
.venv\Scripts\python.exe -m pytest -q
```

Les tests simulent Groq : aucune clé ni appel payant n'est nécessaire. Ils couvrent le parsing PDF, l'extraction de profil et d'exigences, le score et ses poids, les données inconnues, le tri, la validation d'entrée, l'injection de prompt, les erreurs fournisseur (timeout, réseau, 429, 5xx, JSON invalide, schéma invalide), le jeton interne et toutes les routes.

## Données et confidentialité

- Les coordonnées (e-mail, téléphone) sont retirées avant tout appel Groq.
- Seuls le profil structuré et les champs utiles des offres sont envoyés, pas le PDF brut.
- Les offres et CV sont traités comme des données non fiables : les consignes qu'ils contiennent ne sont jamais exécutées.
- Les résultats sont conservés par NestJS dans SQLite, jamais par ce service (sans état).
- Le score est indicatif et explicable ; il ne constitue ni une décision de recrutement ni une garantie.

## Limites connues

- Extraction PDF texte uniquement ; un CV scanné sans couche texte est rejeté.
- Dictionnaire de compétences volontairement borné : les compétences rares peuvent manquer et sont alors inconnues plutôt que devinées.
- L'analyse sémantique s'appuie sur le profil structuré et les exigences, pas sur le CV brut.
- Le service est prévu pour un usage local mono-utilisateur derrière NestJS ; il ne gère ni file d'attente ni multi-tenant.
- Aucune base d'offres réelle n'existe dans JOBORA : les offres de démonstration sont fictives et signalées comme telles.

## Dépannage

| Symptôme | Cause probable | Action |
| --- | --- | --- |
| `403` sur un endpoint | Jeton absent ou différent de NestJS | Aligner `JOB_MATCHER_INTERNAL_TOKEN` |
| `503` | Groq indisponible, clé absente ou 429 | Vérifier `GROQ_API_KEY` et les quotas |
| `504` | Timeout fournisseur | Augmenter `GROQ_TIMEOUT_SECONDS` ou relancer |
| `502` | Réponse JSON non conforme | Inspecter les logs (sans données personnelles) |
| Port occupé | Instance déjà lancée | Choisir un port libre entre 8010 et 8019 et l'appliquer partout |
