# REST API

## Principes
REST est un style d'architecture pour les API web. Les données sont des ressources identifiées par des URL (/users/12), manipulées avec les verbes HTTP. Le serveur est sans état (stateless) : chaque requête contient tout ce qu'il faut pour être traitée. Le format d'échange courant est le JSON.

## Verbes HTTP
GET lit une ressource, POST en crée une, PUT remplace entièrement une ressource, PATCH la modifie partiellement, DELETE la supprime. GET, PUT et DELETE sont idempotents : les répéter donne le même résultat. POST ne l'est pas.

## Codes de statut
200 OK, 201 Created, 204 No Content, 400 Bad Request (requête invalide), 401 Unauthorized (non authentifié), 403 Forbidden (authentifié mais non autorisé), 404 Not Found, 409 Conflict (par exemple email déjà utilisé), 422 Unprocessable Entity (données invalides), 500 Internal Server Error.

## Conception des URL
Utiliser des noms au pluriel, pas des verbes : /users et non /getUsers. Les relations s'expriment par imbrication (/users/12/orders). Les filtres, tris et pagination passent par des paramètres de requête (?page=2&limit=20).

## Authentification
Les API protégées utilisent souvent un jeton JWT envoyé dans l'en-tête Authorization: Bearer. Le HTTPS est indispensable pour protéger les échanges.

## Pagination et versionnage
La pagination évite de renvoyer de trop gros volumes. Le versionnage (/api/v1/...) permet de faire évoluer l'API sans casser les clients existants.

## CORS
Un navigateur bloque par défaut les appels vers une autre origine. Le serveur doit autoriser l'origine du frontend avec les bons en-têtes CORS.

## Erreurs fréquentes
- Mettre des verbes dans les URL.
- Renvoyer toujours 200, même en cas d'erreur.
- Confondre 401 (non identifié) et 403 (identifié mais interdit).
- Ne pas paginer les listes volumineuses.
- Renvoyer des messages d'erreur peu clairs ou révélant des détails internes.

## Questions d'entretien typiques
- Quelle est la différence entre PUT et PATCH ?
- Que signifie qu'une API est stateless ?
- Quelle est la différence entre 401 et 403 ?
- Qu'est-ce qu'une opération idempotente ?
- Comment concevoir les URL d'une API REST ?
