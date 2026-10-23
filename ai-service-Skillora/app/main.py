import json
import os

from fastapi import FastAPI, HTTPException, UploadFile
from .llm import ask
from .interview_schemas import Evaluation, MockFeedback, MockQuestion, MockResponse
from .schemas import OfferAnalysis
from .skills import extract_skills
from .rag import retrieve_for_skill, kb_sources, slug
from .generation import mock_finished, plan_slots, unique_skills, generate_one, RH_THEMES
import pdfplumber


app = FastAPI()
GENERATION_MAX_COUNT = int(os.getenv("GENERATION_MAX_COUNT", "20"))


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/ollama")
def ollama_health():
    from .llm import MODEL, OLLAMA_HOST, health_client

    try:
        result = health_client.list()
        models = result.get("models", []) if isinstance(result, dict) else getattr(result, "models", [])
        available = {
            item.get("name") if isinstance(item, dict) else getattr(item, "model", getattr(item, "name", None))
            for item in models
        }
        if MODEL not in available:
            return {"status": "unavailable", "model": MODEL}
        return {"status": "ok", "model": MODEL, "host": OLLAMA_HOST}
    except Exception:
        return {"status": "unavailable", "model": MODEL}

@app.post("/analyze-offer")
def analyze_offer(body: dict):
    text = body["offer_text"]
    found = extract_skills(text)  # spaCy
    llm = ask("Analyse cette offre d'emploi. Réponds en JSON.", text, OfferAnalysis)
    llm.skills = sorted(set(llm.skills) | set(found))  # fusion
    return llm

@app.post("/parse-cv")
async def parse_cv(file: UploadFile):
    with pdfplumber.open(file.file) as pdf:
        text = "\n".join(p.extract_text() or "" for p in pdf.pages)
    return {"text": text, "skills": extract_skills(text)}




@app.post("/generate-session")
def generate(body: dict):
    offer = OfferAnalysis(**body["offer"])
    level = body["level"] if body["level"] in ("junior", "intermediaire", "senior") else "junior"
    qtype, count = body["type"], min(int(body["count"]), GENERATION_MAX_COUNT)
    cv_text = body.get("cv_text", "")
    use_rag = body.get("use_rag", True)
    verify = body.get("verify", False)

    # Compétences absentes du CV en premier : ce sont les points faibles probables
    skills = unique_skills(offer)
    in_cv = {s.lower() for s in extract_skills(cv_text)}
    skills = [s for s in skills if s.lower() not in in_cv] + [s for s in skills if s.lower() in in_cv]

    questions, asked, used, missing = [], [], set(), []
    rh_i = 0
    for skill, t in plan_slots(skills, qtype, count):
        if t == "rh":
            query = RH_THEMES[rh_i % len(RH_THEMES)]
            rh_i += 1
        else:
            query = f"{skill} {level}"
        docs = retrieve_for_skill(skill, query, used, n=1) if use_rag else []
        q = generate_one(offer, cv_text, skill, t, level, docs, asked, verify=verify, answer_type="qcm")
        if q:
            questions.append(q)
            asked.append(q.question)
            if q.source:
                used.add(tuple(q.source.split(" / ", 1)))
        else:
            missing.append({"skill": skill, "type": t})

    known = kb_sources()
    if not questions:
        raise HTTPException(status_code=502, detail="Le service IA n'a pas généré de question valide.")
    return {
        "questions": questions,
        "requested": count,
        "missing": missing,
        "sources": [q.source for q in questions if q.source],
        "uncovered_skills": [s for s in skills if slug(s) not in known],
    }


@app.post("/evaluate", response_model=Evaluation)
def evaluate(body: dict):
    result = ask(
        "Tu évalues une réponse d'entretien en français et en tutoyant le candidat. "
        "N'invente aucun fait absent de la réponse attendue. "
        "correct signifie que l'essentiel est présent, partiel qu'il manque des points, sinon incorrect. "
        "Donne un feedback constructif et uniquement du JSON.",
        json.dumps(body, ensure_ascii=False),
        Evaluation,
        temperature=0.0,
    )
    result.score = max(0, min(100, result.score))
    return result


@app.post("/followup")
def followup(body: dict):
    offer = OfferAnalysis(**body["offer"])
    skill = str(body.get("skill", "Général"))
    docs = retrieve_for_skill(skill, f"{skill} {body.get('level', 'junior')}", n=2)
    question = generate_one(offer, "", skill, "qcm", body.get("level", "junior"), docs, body.get("asked", []), verify=False, answer_type="qcm")
    return {"question": question}


@app.post("/mock-interview", response_model=MockResponse)
def mock_interview(body: dict):
    history = body.get("history", [])
    max_turns = int(body.get("max_turns", 5))
    if mock_finished(history, max_turns):
        feedback = ask(
            "Analyse cet historique d'entretien en français, tutoie le candidat. "
            "Réponds uniquement avec strengths, improvements et summary en JSON.",
            json.dumps(history, ensure_ascii=False),
            MockFeedback,
            temperature=0.0,
        )
        return {"message": "L'entretien blanc est terminé.", "finished": True, "feedback": feedback}
    result = ask(
        "Tu es un recruteur qui mène un entretien blanc en français. Tutoie le candidat, "
        "pose UNE seule question à la fois et n'invente aucune expérience. Réponds uniquement avec message.",
        json.dumps({"offer": body.get("offer"), "cv": body.get("cv_text", "")[:4000], "history": history}, ensure_ascii=False),
        MockQuestion,
        temperature=0.2,
    )
    return {"message": result.message, "finished": False, "feedback": None}