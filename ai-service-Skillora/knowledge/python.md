# Python

## Typage et structures de données
Python est dynamiquement typé et interprété. Structures : list (mutable, ordonnée), tuple (immuable), dict (clé-valeur), set (éléments uniques). Les indentations définissent les blocs de code.

## Compréhensions de listes
[x * 2 for x in nombres if x > 0] construit une liste de façon concise. Il existe aussi des compréhensions de dictionnaires et d'ensembles.

## Fonctions
Arguments positionnels, nommés, valeurs par défaut, *args (arguments positionnels variables) et **kwargs (arguments nommés variables). Les annotations de type (def f(x: int) -> str) documentent le code et aident les outils, mais ne sont pas vérifiées à l'exécution.

## Programmation orientée objet
Classes avec __init__, héritage, méthodes spéciales (__str__, __repr__), @classmethod, @staticmethod et @property. Les dataclasses réduisent le code répétitif pour les classes de données.

## Décorateurs, générateurs et context managers
Un décorateur modifie le comportement d'une fonction (@decorateur). Un générateur (yield) produit des valeurs à la demande sans tout charger en mémoire. Le mot-clé with gère l'ouverture et la fermeture des ressources (fichiers, connexions).

## Gestion des erreurs
try, except, else, finally. On capture des exceptions précises plutôt qu'un except vide.

## Environnements et paquets
Un environnement virtuel (python -m venv) isole les dépendances d'un projet. pip installe les paquets, requirements.txt les liste. Il vaut mieux utiliser python -m pip pour garantir le bon interpréteur.

## Erreurs fréquentes
- Valeur par défaut mutable (def f(x=[])) : la liste est partagée entre les appels.
- Modifier une liste pendant qu'on la parcourt.
- Oublier d'activer l'environnement virtuel.
- Utiliser except sans préciser l'exception, ce qui masque les bugs.
- Confondre == (égalité) et is (identité).

## Questions d'entretien typiques
- Quelle est la différence entre list et tuple ?
- Qu'est-ce qu'un décorateur ?
- À quoi sert un générateur ?
- Pourquoi utiliser un environnement virtuel ?
- Que signifient *args et **kwargs ?
