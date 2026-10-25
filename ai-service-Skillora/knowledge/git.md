# Git

## Les trois zones de Git
Git travaille avec trois zones : le répertoire de travail (fichiers modifiés), la zone de staging (index, fichiers préparés avec git add) et le dépôt local (commits enregistrés avec git commit). Le flux normal est : modifier, git add, git commit, git push vers le dépôt distant.

## Commandes de base
git init crée un dépôt, git clone copie un dépôt distant, git status montre l'état des fichiers, git diff affiche les modifications, git log affiche l'historique, git add prépare des fichiers, git commit -m "message" enregistre un commit.

## Branches
Une branche est un pointeur mobile vers un commit. Elle permet de développer une fonctionnalité sans toucher à la branche principale. Commandes : git branch (lister), git switch -c nom (créer et basculer), git branch -d nom (supprimer une branche fusionnée).

## Merge vs rebase
git merge fusionne deux branches en créant un commit de fusion et conserve l'historique tel quel. git rebase rejoue les commits d'une branche sur une nouvelle base et produit un historique linéaire. Règle d'or : ne jamais rebaser des commits déjà poussés et partagés avec d'autres.

## Conflits de fusion
Un conflit apparaît quand deux branches modifient la même ligne d'un fichier. Git insère les marqueurs <<<<<<<, ======= et >>>>>>>. Il faut éditer le fichier pour garder le contenu final voulu, supprimer les marqueurs, puis faire git add et git commit.

## Dépôt distant : fetch, pull, push
git fetch télécharge les nouveautés du dépôt distant sans modifier le travail local. git pull est l'équivalent de git fetch suivi de git merge. git push envoie les commits locaux au dépôt distant. Les pull requests servent à relire le code avant de fusionner.

## Annuler des changements
git restore annule les modifications d'un fichier non commité. git reset déplace la branche vers un ancien commit et peut réécrire l'historique. git revert crée un nouveau commit qui annule un commit précédent : c'est la méthode sûre sur une branche partagée. git stash met de côté des modifications en cours.

## Fichier .gitignore
Le fichier .gitignore liste les fichiers et dossiers que Git ne doit pas suivre : node_modules, dossiers de build, fichiers .env, secrets, fichiers générés par l'IDE.

## Erreurs fréquentes
- Confondre git fetch (télécharge seulement) et git pull (télécharge et fusionne).
- Utiliser git push --force sur une branche partagée, ce qui écrase le travail des autres.
- Committer des fichiers inutiles ou des secrets parce que le .gitignore est absent.
- Faire des commits énormes avec des messages vagues comme "fix".
- Travailler directement sur la branche principale.

## Questions d'entretien typiques
- Quelle est la différence entre merge et rebase ?
- Comment résoudre un conflit de fusion ?
- Quelle est la différence entre git fetch et git pull ?
- Comment annuler le dernier commit déjà poussé ?
- À quoi sert le .gitignore ?
- Quelle stratégie de branches utilises-tu en équipe ?
