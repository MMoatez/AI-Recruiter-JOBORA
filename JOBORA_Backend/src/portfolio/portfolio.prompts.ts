const EXTRACTION_RULES =
  "Utilise UNIQUEMENT ce qui est écrit dans le texte. N’invente rien. Si une info est absente, mets une chaîne vide ou un tableau vide. Réponds uniquement en JSON valide."

export const PORTFOLIO_SYSTEM_PROMPTS = {
  identity: `${EXTRACTION_RULES}
Extrais uniquement l’identité, les contacts, les liens, la présentation et les études.
Schéma JSON exact :
{"fullName":"string","title":"string","email":"string","phone":"string","location":"string","links":{"linkedin":"string","github":"string","website":"string"},"about":"string","education":[{"school":"string","degree":"string","field":"string","startYear":"string","endYear":"string"}]}
Les années sont des chaînes. N’ajoute aucune clé.
Mini CV :
Ada Lovelace — Ingénieure logiciel
ada@example.com, Londres
Études : BSc Mathématiques, University of London, 1830-1832
Sortie attendue :
{"fullName":"Ada Lovelace","title":"Ingénieure logiciel","email":"ada@example.com","phone":"","location":"Londres","links":{"linkedin":"","github":"","website":""},"about":"","education":[{"school":"University of London","degree":"BSc","field":"Mathématiques","startYear":"1830","endYear":"1832"}]}`,

  experiences: `${EXTRACTION_RULES}
Extrais uniquement les expériences professionnelles.
Schéma JSON exact :
{"experiences":[{"company":"string","role":"string","startDate":"string","endDate":"string","description":"string","technologies":["string"]}]}
Conserve les dates telles qu’écrites. Si aucune expérience n’est fournie, retourne un tableau vide. N’ajoute aucune clé.
Mini CV :
Développeuse chez Example Ltd, janvier 2022 à mars 2024. Création d’API avec NestJS et PostgreSQL.
Sortie attendue :
{"experiences":[{"company":"Example Ltd","role":"Développeuse","startDate":"janvier 2022","endDate":"mars 2024","description":"Création d’API","technologies":["NestJS","PostgreSQL"]}]}`,

  projects: `${EXTRACTION_RULES}
Extrais uniquement les projets.
Schéma JSON exact :
{"projects":[{"name":"string","year":"string","description":"string","technologies":["string"]}]}
L’année est une chaîne. Si aucune année n’est écrite, utilise une chaîne vide. Si aucun projet n’est fourni, retourne un tableau vide. N’ajoute aucune clé.
Mini CV :
2023 — Site météo : application web de prévisions avec React et TypeScript.
Sortie attendue :
{"projects":[{"name":"Site météo","year":"2023","description":"Application web de prévisions","technologies":["React","TypeScript"]}]}`,

  skills: `${EXTRACTION_RULES}
Extrais uniquement les compétences, langues et certifications.
Schéma JSON exact :
{"skills":{"languages":["string"],"frameworks":["string"],"tools":["string"],"databases":["string"],"other":["string"]},"languages":[{"name":"string","level":"string"}],"certifications":[{"name":"string","issuer":"string","year":"string"}]}
Les langues de programmation vont dans skills.languages; les langues parlées vont dans languages. Les années sont des chaînes. N’ajoute aucune clé.
Mini CV :
Compétences : JavaScript, React, Git, PostgreSQL. Français courant.
Certification AWS Cloud Practitioner, AWS, 2024.
Sortie attendue :
{"skills":{"languages":["JavaScript"],"frameworks":["React"],"tools":["Git"],"databases":["PostgreSQL"],"other":[]},"languages":[{"name":"Français","level":"courant"}],"certifications":[{"name":"AWS Cloud Practitioner","issuer":"AWS","year":"2024"}]}`,
} as const

export const PORTFOLIO_GENERATION_PROMPTS = {
headline: `Réponds toujours en français.
Rédige une phrase d’accroche de 8 à 12 mots maximum à partir uniquement du titre et des compétences fournis. N’invente aucune compétence, spécialité, expérience, qualité ou résultat. Retourne uniquement un objet JSON valide selon ce schéma exact : {"headline":"string"}.
`,
about: `Réponds toujours en français.
Rédige une présentation de 3 à 4 phrases à la première personne, basée uniquement sur les études, compétences et projets fournis. N’ajoute aucun fait, chiffre, durée, résultat ou niveau qui n’est pas dans ces données. Retourne uniquement un objet JSON valide selon ce schéma exact : {"about":"string"}.
`,
project: `Réponds toujours en français.
Reformule la description du projet fourni en 1 à 2 phrases claires. N’ajoute aucun fait, chiffre, résultat ou affirmation absent des données. Recopie exactement la liste technologies fournie, dans le même ordre. Retourne uniquement un objet JSON valide selon ce schéma exact : {"description":"string","technologies":["string"]}.
`,
} as const
