# Docker

## Principe
Docker empaquette une application avec ses dépendances dans un conteneur, qui s'exécute de la même façon sur toutes les machines. Un conteneur partage le noyau du système hôte, alors qu'une machine virtuelle embarque un système complet : le conteneur est donc plus léger et démarre plus vite.

## Image vs conteneur
Une image est un modèle en lecture seule, composé de couches. Un conteneur est une instance en cours d'exécution d'une image. On peut lancer plusieurs conteneurs à partir de la même image.

## Dockerfile
Fichier de recette pour construire une image. Instructions courantes : FROM (image de base), WORKDIR, COPY, RUN (commande exécutée à la construction), ENV, EXPOSE, CMD et ENTRYPOINT (commande exécutée au démarrage). L'ordre compte : mettre les instructions qui changent rarement en premier profite du cache des couches.

## Commandes essentielles
docker build -t nom . construit une image. docker run -p 8080:80 nom lance un conteneur et publie un port. docker ps liste les conteneurs, docker logs affiche les journaux, docker exec -it ouvre un shell dedans, docker stop arrête.

## Volumes et réseaux
Les données d'un conteneur disparaissent avec lui. Un volume persiste les données (bases de données, fichiers). Les conteneurs d'un même réseau communiquent par leur nom de service.

## Docker Compose
Décrit et lance plusieurs conteneurs (API, base de données, frontend) avec un fichier docker-compose.yml et la commande docker compose up.

## .dockerignore
Exclut des fichiers du contexte de build (node_modules, .git, .env), ce qui accélère la construction et évite d'embarquer des secrets.

## Erreurs fréquentes
- Ne pas utiliser de volume pour une base de données, et perdre les données.
- Mettre des secrets dans l'image ou le Dockerfile.
- Oublier le .dockerignore et obtenir une image énorme.
- Utiliser le tag latest, qui rend les builds non reproductibles.
- Exécuter l'application en root dans le conteneur.

## Questions d'entretien typiques
- Quelle est la différence entre un conteneur et une machine virtuelle ?
- Quelle est la différence entre une image et un conteneur ?
- À quoi sert Docker Compose ?
- Comment persister les données d'un conteneur ?
- Quelle est la différence entre CMD et ENTRYPOINT ?
