# Node.js

## Principe
Node.js est un environnement d'exécution JavaScript côté serveur, basé sur le moteur V8. Il utilise un modèle mono-thread avec une boucle d'événements et des entrées-sorties non bloquantes (libuv), ce qui le rend efficace pour les applications avec beaucoup d'I/O comme les API.

## Boucle d'événements
Les opérations lentes (fichiers, réseau, base de données) sont déléguées au système et leurs callbacks sont exécutés quand le résultat est prêt. Tant qu'un traitement synchrone long occupe le thread principal, tout le reste est bloqué.

## npm et package.json
npm installe les dépendances. package.json décrit le projet, les dépendances (dependencies, devDependencies) et les scripts (npm run). package-lock.json fige les versions exactes. node_modules ne doit pas être versionné.

## Modules : CommonJS et ES Modules
CommonJS utilise require et module.exports. Les ES Modules utilisent import et export, et s'activent avec "type": "module" dans package.json ou l'extension .mjs.

## Express
Framework web minimaliste : routes (app.get, app.post), middlewares (fonctions exécutées avant le handler), parsing du JSON avec express.json(), gestion d'erreurs avec un middleware à quatre paramètres.

## Asynchronisme
Callbacks, Promises et async/await. Il faut toujours gérer les rejets de promesses, sinon une unhandledRejection peut faire planter le processus.

## Configuration
Les variables d'environnement (process.env, fichier .env avec dotenv) contiennent les secrets et réglages. Le fichier .env ne doit jamais être commité.

## Erreurs fréquentes
- Bloquer la boucle d'événements avec un calcul lourd ou des fonctions synchrones (readFileSync) dans un serveur.
- Oublier de gérer les erreurs asynchrones.
- Commiter node_modules ou le fichier .env.
- Callback hell au lieu d'utiliser async/await.

## Questions d'entretien typiques
- Pourquoi Node.js est-il dit non bloquant ?
- Explique la boucle d'événements.
- Quelle est la différence entre CommonJS et ES Modules ?
- Qu'est-ce qu'un middleware dans Express ?
- Comment gérer les variables d'environnement ?
