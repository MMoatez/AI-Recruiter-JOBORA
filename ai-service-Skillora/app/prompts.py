SYSTEM_Q = """Tu es un recruteur technique qui prépare un candidat à un entretien. Tu écris UNE seule question à la fois, en français, en tutoyant le candidat.
RÈGLES STRICTES :
- Les termes techniques restent tels quels, ne les traduis jamais (ex. StatelessWidget, StatefulWidget, git fetch, async/await, setState).
- La bonne réponse doit figurer explicitement dans la DOCUMENTATION fournie. Si tu n'es pas sûr d'un fait, pose une question plus simple sur une notion clairement écrite dans la documentation. N'invente aucune syntaxe, aucun mot-clé, aucune commande.
- La question doit être autonome : ne mentionne jamais la documentation, "le texte" ni ce qui est "mentionné".
- "expected_answer" : la réponse attendue, en 1 à 3 phrases, à la troisième personne ou de façon neutre (jamais à la première personne "j'ai", "je"), et jamais un numéro.
- "explanation" : explication pédagogique de 2 à 4 phrases adressée au candidat en le tutoyant, jamais une consigne au recruteur.
- Quelle que soit la catégorie demandée (ouverte, technique, RH ou mixte), la réponse doit toujours être un QCM avec exactement 4 options COURTES (moins de 15 mots chacune), nettement différentes les unes des autres (jamais deux reformulations d'une même phrase), dont une seule est correcte ; "correct_index" est la position (0 à 3) de la bonne option.
- Pour la catégorie RH, reste général, sans citer de technologie ni supposer une expérience précise du candidat ; les 4 options QCM restent obligatoires.
- Réponds uniquement en JSON."""

TYPE_HINT = {
    "qcm": "un QCM : une question avec 4 options dont une seule est correcte",
    "ouverte": "une question ouverte qui demande une explication avec ses propres mots",
    "technique": "une question technique précise (concept, comparaison ou petit cas pratique)",
    "rh": ("une question comportementale classique d'entretien RH (conflit, échec, motivation, "
           "travail en équipe, présentation...). La réponse attendue décrit ce qu'une bonne réponse "
           "doit contenir (par exemple la méthode STAR), sans inventer d'expérience du candidat."),
}


def build_question_prompt(offer, cv, skill, qtype, level, doc, asked, answer_format="qcm", category=None):
    if doc:
        docs = f"DOCUMENTATION DE RÉFÉRENCE ({doc['source']} / {doc['title']}) :\n{doc['text']}"
    else:
        docs = "DOCUMENTATION : aucune. Reste sur des notions de base, sûres et courantes."
    asked_txt = "\n".join(f"- {q}" for q in asked) or "aucune"
    profil = "" if qtype == "rh" else f"PROFIL DU CANDIDAT (pour personnaliser, ne rien inventer) :\n{cv[:1500]}\n\n"
    return f"""POSTE : {offer.job_title} (niveau {offer.level})
COMPÉTENCE VISÉE : {skill}
TYPE : {qtype} - {TYPE_HINT[qtype]}
CATÉGORIE DEMANDÉE : {category or qtype}
NIVEAU : {level}

{profil}{docs}

QUESTIONS DÉJÀ POSÉES (ne pas répéter) :
{asked_txt}

FORMAT DE RÉPONSE OBLIGATOIRE : {answer_format.upper()}. Même si la catégorie est « {qtype} », produis exactement 4 options et un correct_index entre 0 et 3.

Écris UNE question."""


SYSTEM_VERIFY = """Tu es un relecteur strict. On te donne une DOCUMENTATION, une QUESTION et sa RÉPONSE ATTENDUE.
"supported" vaut true UNIQUEMENT si la réponse attendue est écrite dans la documentation ou s'en déduit directement, sans rien ajouter d'extérieur (aucune syntaxe, aucun mot-clé, aucun fait absent du texte). Si la réponse est vague, ambiguë ou ne reprend pas un fait précis du texte, "supported" vaut false.
Réponds uniquement en JSON : {"supported": true ou false, "reason": "une phrase"}"""


def build_verify_prompt(doc, question, answer):
    return f"""DOCUMENTATION :
{doc['text']}

QUESTION : {question}
RÉPONSE ATTENDUE : {answer}"""