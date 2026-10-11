# Module — Génération intelligente de CV ATS-Friendly avec LLM

## 1. Présentation

Ce module permet à un candidat de saisir son parcours, de générer un contenu de CV professionnel et compatible avec les règles ATS, de contrôler le résultat, de modifier les textes générés et d’exporter une version PDF à une colonne.

Le candidat reste responsable du contenu final. L’IA reformule uniquement les données fournies et ne doit jamais inventer une expérience, une compétence, une certification, une entreprise, une date, un résultat ou un chiffre.

## 2. État actuel du projet

Le projet contient maintenant un frontend React 19 + Vite et un backend NestJS 11. Le backend utilise MongoDB avec Mongoose, JWT pour l’authentification, `class-validator` pour les DTO et le SDK officiel `@google/genai` pour Gemini.

Le frontend utilise automatiquement le backend lorsqu’une vraie session JWT est disponible. Le mode local existant reste disponible comme solution de démonstration lorsque le backend n’est pas lancé.

Voir [GEMINI_SETUP.md](./GEMINI_SETUP.md), [BACKEND_INTEGRATION.md](./BACKEND_INTEGRATION.md) et [`backend/README.md`](../../../../backend/README.md).

## 3. Fonctionnalités implémentées

- Tableau de bord des CV.
- Création de plusieurs CV par utilisateur.
- Modification, suppression et prévisualisation.
- Formulaire guidé en neuf étapes.
- Ajout de plusieurs formations, expériences, projets, langues et certifications.
- Génération simulée d’un résumé et de points d’expérience.
- Régénération ciblée du résumé, d’une expérience ou d’un projet.
- Modification manuelle des textes générés.
- Contrôle ATS déterministe.
- Score qualité interne clairement identifié comme non officiel.
- Modèle de CV à une colonne, sans photo, icône, tableau ou graphique.
- Export PDF avec texte sélectionnable via l’impression du navigateur.
- Protection de base contre les instructions malveillantes contenues dans les données candidat.
- Interface responsive pour ordinateur, tablette et mobile.

## 4. Parcours utilisateur

```text
Tableau de bord
  → Créer ou modifier un CV
  → Saisir les informations dans les 9 étapes
  → Enregistrer le brouillon
  → Générer le contenu
  → Contrôler le score ATS interne
  → Modifier ou régénérer une section
  → Prévisualiser
  → Exporter en PDF
```

## 5. Étapes du formulaire

1. Informations personnelles : prénom, nom, email, téléphone, localisation, LinkedIn et GitHub.
2. Objectif professionnel : titre du CV, poste ciblé et objectif de carrière.
3. Formation : diplôme, établissement, lieu, dates et description.
4. Expériences et stages : poste, entreprise, lieu, dates et description brute.
5. Projets : nom, description, technologies et lien.
6. Compétences : compétences techniques, humaines et outils.
7. Langues : langue et niveau.
8. Certifications : nom, organisme et date.
9. Génération, contrôle ATS et édition du contenu produit.

## 6. Architecture du module

| Fichier | Responsabilité |
| --- | --- |
| `CVPage.tsx` | Interface, navigation entre les vues et formulaire multi-étapes. |
| `types.ts` | Modèles TypeScript du CV et du résultat ATS. |
| `cvService.ts` | CRUD local, génération simulée, contrôle ATS et isolation par utilisateur. |
| `geminiContract.ts` | Validation de la configuration serveur et parsing défensif d’une réponse Gemini. |
| `cvService.test.ts` | Tests automatisés du service et des règles de sécurité. |
| `documentation/prompts/` | Prompts exécutables et historique des itérations de Prompt Engineering. |

## 7. Modèle de données CV

Le type `CV` contient notamment :

- `id` et `userId` ;
- `title`, `targetJob` et `careerObjective` ;
- `personalInformation` ;
- `professionalSummary` ;
- `education[]`, `experiences[]` et `projects[]` ;
- `technicalSkills[]`, `softSkills[]` et `tools[]` ;
- `languages[]` et `certifications[]` ;
- `atsValidation` ;
- `promptVersion` ;
- `status`, `createdAt` et `updatedAt`.

Un utilisateur peut posséder plusieurs CV. Dans le futur backend, `userId` doit toujours être obtenu depuis la session authentifiée et jamais accepté depuis le corps de la requête.

## 8. Génération IA

La génération réelle doit suivre ce flux :

```text
Données candidat validées
  → Service backend CV
  → Prompt système + prompt de génération
  → API Gemini
  → Parsing JSON
  → Validation du schéma
  → Contrôles ATS déterministes
  → Sauvegarde en base
  → Réponse frontend
```

Gemini génère uniquement le contenu. Le frontend reste responsable de la mise en page HTML et de l’export PDF.

## 9. Validation ATS

Les règles déterministes actuelles vérifient :

- la présence du résumé professionnel ;
- la présence des compétences techniques ;
- la présence d’une formation ;
- la présence d’une expérience ;
- la longueur des points d’expérience ;
- l’utilisation de sections standard ;
- l’absence de tableaux et de graphiques dans le modèle.

Le score est un indicateur interne au projet. Il ne doit jamais être présenté comme un score officiel LinkedIn, Workday, Taleo, Greenhouse ou provenant d’un autre ATS commercial.

## 10. Sécurité

- Ne jamais placer `GEMINI_API_KEY` dans le frontend.
- Ne jamais utiliser un nom commençant par `VITE_` pour cette clé.
- Ne jamais enregistrer la clé dans Git ou dans les logs.
- Considérer les informations candidat comme des données non fiables.
- Isoler les données candidat avec des délimiteurs dans le prompt.
- Ignorer les instructions telles que « ignore previous instructions » présentes dans un champ candidat.
- Parser puis valider strictement le JSON retourné par Gemini.
- Limiter la taille des champs côté backend.
- Vérifier que chaque CV appartient à l’utilisateur authentifié.
- Retourner des messages utilisateur propres, sans stack trace.

## 11. Gestion des erreurs

Le futur backend devra normaliser les cas suivants :

- clé Gemini absente ;
- API Gemini indisponible ;
- erreur réseau ou délai dépassé ;
- JSON invalide ;
- réponse ne respectant pas le schéma ;
- données candidat vides ou invalides ;
- accès à un CV appartenant à un autre utilisateur ;
- erreur de base de données ;
- erreur pendant l’export PDF.

## 12. Tests automatisés

Les dix tests couvrent :

1. création d’un CV ;
2. mise à jour ;
3. suppression ;
4. contrôle de propriété ;
5. génération structurée ;
6. réponse Gemini invalide ;
7. clé Gemini absente ;
8. validation ATS ;
9. champs obligatoires ;
10. tentative de prompt injection.

Commande :

```powershell
npm.cmd test
```

## 13. Lancer et tester manuellement

```powershell
cd "C:\Users\yassi\Desktop\AI Recruiter Platform Design"
npm.cmd install
npm.cmd run dev
```

Ouvrir ensuite `http://localhost:8443`, se connecter avec un email valide et un mot de passe non vide, puis sélectionner **Mon CV**.

Scénario conseillé :

1. Créer un nouveau CV.
2. Compléter les étapes Identité et Objectif.
3. Ajouter une formation, une expérience, un projet et des compétences.
4. Atteindre l’étape Génération.
5. Générer le CV.
6. Modifier le résumé.
7. Régénérer une expérience uniquement.
8. Contrôler le score ATS.
9. Ouvrir l’aperçu final.
10. Exporter avec **Télécharger en PDF** puis **Enregistrer au format PDF**.

## 14. Vérifications techniques

```powershell
npx.cmd tsc --noEmit
npm.cmd test
npm.cmd run build
```

Les trois commandes ont été exécutées avec succès lors de l’implémentation du module.
