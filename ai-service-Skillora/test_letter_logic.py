"""Tests du module Lettre de motivation (sans Ollama ni spaCy).

Lancement : python -m unittest test_letter_logic -v   (depuis ai-service-Skillora)
"""
import unittest

from app.letter_logic import build_facts, formulas, scrub, validate_letter

OFFER = """Développeur Flutter Junior chez Novalys. Missions : développer des applications mobiles
avec Flutter et Dart, intégrer Firebase, gérer le code avec Git. Docker est un plus."""

CV = {
    "career_objective": "Développeur mobile junior",
    "experiences": [
        {"jobTitle": "Stagiaire comptable", "company": "Cabinet X", "startDate": "2023", "endDate": "2023",
         "bulletPoints": ["Saisie des factures"]},
        {"jobTitle": "Stagiaire développeur", "company": "TechCorp", "startDate": "2025", "endDate": "2025",
         "bulletPoints": ["Application Flutter avec Firebase", "Gestion du code avec Git"]},
    ],
    "projects": [{"name": "Smart Parking", "description": "Réservation de places", "technologies": ["Flutter", "Firebase"],
                  "link": "https://github.com/moi/parking"}],
    "education": [{"degree": "Ingénieur informatique", "institution": "ESPRIT", "endDate": "2027"}],
    "technical_skills": ["Flutter", "Dart", "Firebase", "Git"],
    "soft_skills": ["Rigueur"],
}
OFFER_SKILLS = ["Flutter", "Dart", "Firebase", "Git", "Docker"]
CV_SKILLS = ["Flutter", "Dart", "Firebase", "Git"]


def fake_extract(text):
    known = ["Flutter", "Dart", "Firebase", "Git", "Docker", "Kubernetes"]
    return [k for k in known if k.lower() in text.lower()]


class BuildFactsTest(unittest.TestCase):
    def test_most_relevant_experience_comes_first(self):
        result = build_facts(CV, OFFER, OFFER_SKILLS, CV_SKILLS)
        e1 = next(f for f in result["facts"] if f["id"] == "E1")
        self.assertIn("TechCorp", e1["text"])
        self.assertFalse(any("Cabinet X" in f["text"] for f in result["facts"]))

    def test_matched_and_missing_skills(self):
        result = build_facts(CV, OFFER, OFFER_SKILLS, CV_SKILLS)
        self.assertEqual(result["missing_skills"], ["Docker"])
        self.assertIn("Flutter", result["matched_skills"])

    def test_links_are_not_sent_to_llm(self):
        result = build_facts(CV, OFFER, OFFER_SKILLS, CV_SKILLS)
        self.assertFalse(any("github.com" in f["text"] for f in result["facts"]))

    def test_raw_pdf_text_is_scrubbed(self):
        cv = {"raw_text": "Contact : ali@mail.com +216 22 333 444\n\nStage Flutter chez TechCorp avec Firebase"}
        result = build_facts(cv, OFFER, OFFER_SKILLS, [])
        text = " ".join(f["text"] for f in result["facts"])
        self.assertNotIn("ali@mail.com", text)
        self.assertNotIn("333", text)
        self.assertIn("Flutter", text)


class ValidateLetterTest(unittest.TestCase):
    def setUp(self):
        self.facts = build_facts(CV, OFFER, OFFER_SKILLS, CV_SKILLS)["facts"]
        self.corpus = str(CV)

    def paragraphs(self, experience_text):
        return {
            "introduction": {"text": "Étudiant ingénieur, je candidate au poste de développeur Flutter.", "sources": ["F1", "ZZ"]},
            "experience": {"text": experience_text, "sources": ["E1"]},
            "fit": {"text": "Ma maîtrise de Flutter et de Git répond à vos besoins.", "sources": ["S"]},
            "motivation": {"text": "Je serais ravi d'échanger avec vous lors d'un entretien.", "sources": []},
        }

    def test_invented_number_and_skill_are_flagged(self):
        _, warnings = validate_letter(
            self.paragraphs("Chez TechCorp, j'ai livré une app Flutter utilisée par 5000 clients et maîtrisé Kubernetes."),
            self.facts, self.corpus, OFFER, fake_extract, CV_SKILLS)
        self.assertTrue(any("5000" in w for w in warnings))
        self.assertTrue(any("Kubernetes" in w for w in warnings))

    def test_clean_letter_has_no_warning_and_unknown_sources_removed(self):
        paragraphs, warnings = validate_letter(
            self.paragraphs("Chez TechCorp en 2025, j'ai développé une application **Flutter** avec Firebase."),
            self.facts, self.corpus, OFFER, fake_extract, CV_SKILLS)
        self.assertEqual(warnings, [])
        self.assertEqual(paragraphs[0]["sources"], ["F1"])
        self.assertNotIn("**", paragraphs[1]["text"])

    def test_empty_paragraph_is_rejected(self):
        with self.assertRaises(ValueError):
            validate_letter(self.paragraphs(""), self.facts, self.corpus, OFFER, fake_extract, CV_SKILLS)


class MiscTest(unittest.TestCase):
    def test_scrub(self):
        self.assertEqual(scrub("Écris-moi : a.b@c.tn ou www.site.com"), "Écris-moi : ou")

    def test_formulas_written_by_code(self):
        self.assertTrue(formulas("fr", "formel")["closing"].startswith("Je vous prie"))
        self.assertEqual(formulas("en", "dynamique")["salutation"], "Dear Hiring Manager,")


if __name__ == "__main__":
    unittest.main()
