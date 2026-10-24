# FastAPI

## Principe
FastAPI est un framework web Python moderne et rapide pour construire des API. Il repose sur Starlette (partie web) et Pydantic (validation des données), et fonctionne sur un serveur ASGI comme uvicorn.

## Typage et validation avec Pydantic
Les paramètres et les corps de requête sont décrits avec des annotations de type et des modèles Pydantic. FastAPI valide automatiquement les entrées et renvoie une erreur 422 détaillée si les données sont invalides. response_model définit et filtre le format de la réponse.

## Documentation automatique
FastAPI génère la spécification OpenAPI et deux interfaces : Swagger UI sur /docs et ReDoc sur /redoc. Elles permettent de tester l'API directement dans le navigateur.

## def vs async def
async def convient aux opérations asynchrones avec await (appels réseau, base de données asynchrone). Un appel bloquant long dans une fonction async def bloque la boucle d'événements ; dans ce cas on utilise une fonction def normale, que FastAPI exécute dans un pool de threads.

## Injection de dépendances
Depends permet de factoriser du code réutilisable (connexion base de données, authentification, paramètres communs) et de l'injecter dans les routes.

## Erreurs HTTP et fichiers
HTTPException(status_code=404, detail="...") renvoie une erreur HTTP propre. UploadFile reçoit des fichiers (par exemple un PDF) et nécessite le paquet python-multipart.

## CORS
Pour qu'un frontend sur une autre origine puisse appeler l'API, il faut ajouter CORSMiddleware avec les origines autorisées.

## Lancement
uvicorn main:app --reload lance le serveur en développement avec rechargement automatique. En production, on retire --reload.

## Erreurs fréquentes
- Bloquer la boucle d'événements avec un appel synchrone long dans async def.
- Oublier de configurer CORS pour le frontend.
- Ne pas typer les entrées et les sorties, ce qui perd la validation.
- Oublier python-multipart pour les formulaires et fichiers.

## Questions d'entretien typiques
- Pourquoi FastAPI génère-t-il une documentation automatique ?
- Quel est le rôle de Pydantic ?
- Quelle est la différence entre def et async def dans une route ?
- Comment fonctionne Depends ?
- Comment gérer CORS ?
