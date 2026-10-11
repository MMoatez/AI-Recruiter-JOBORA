# Configuration de Google Gemini

## Où placer la clé API ?

La clé doit être placée dans le fichier `backend/.env`, jamais dans le frontend Vite.

Structure utilisée :

```text
project/
  backend/
    .env
    .env.example
    src/
      modules/
        cv/
```

Contenu de `backend/.env` :

```text
GEMINI_API_KEY=la_vraie_cle_ici
```

Ne jamais écrire :

```text
VITE_GEMINI_API_KEY=...
```

Les variables commençant par `VITE_` peuvent être intégrées au bundle JavaScript et deviennent visibles dans le navigateur.

## Quand ajouter la clé ?

Le backend est maintenant prêt. Ajoute la clé après avoir copié `backend/.env.example` vers `backend/.env` et avant de tester la génération réelle.

Les éléments de sécurité suivants sont déjà présents :

1. un backend Node, NestJS, Express, Spring, Django ou équivalent ;
2. un endpoint authentifié de génération CV ;
3. un service Gemini exécuté uniquement sur le serveur ;
4. une validation stricte de la réponse JSON ;
5. un fichier `.gitignore` excluant `.env`.

Le frontend appellera alors le backend :

```text
Frontend → POST /api/cvs/:id/generate → Backend → Gemini
```

Le frontend ne doit jamais appeler Gemini directement.

## Obtenir une clé

Créer la clé depuis Google AI Studio, puis la copier dans `backend/.env`. La clé réelle ne doit pas être envoyée dans une conversation, ajoutée à la documentation ou commitée dans Git.

## Configuration serveur

Le serveur doit vérifier la présence de la variable au démarrage :

```ts
const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) throw new Error("GEMINI_API_KEY is not configured")
```

Le helper `geminiContract.ts` contient déjà une fonction testée pour cette validation ainsi qu’un parseur défensif de la réponse JSON.

## Fichier d’exemple

Le fichier [`gemini.env.example`](./gemini.env.example) peut être copié vers le futur dossier backend et renommé `.env`. Il ne contient aucune vraie clé.
