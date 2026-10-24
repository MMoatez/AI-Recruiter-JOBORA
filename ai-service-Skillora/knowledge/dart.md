# Dart

## Typage et null safety
Dart est un langage typé statiquement. Avec la null safety, un type non nullable (String) ne peut jamais valoir null, alors qu'un type nullable (String?) le peut. Opérateurs utiles : ?. (accès sécurisé), ?? (valeur par défaut si null), ! (affirme que la valeur n'est pas null, risqué), late (initialisation différée d'une variable non nullable).

## var, final et const
var déclare une variable dont le type est inféré et dont la valeur peut changer. final ne peut être affecté qu'une seule fois, avec une valeur connue à l'exécution. const est une constante connue dès la compilation et profondément immuable. Dans Flutter, const sur les widgets évite des reconstructions inutiles.

## Programmation asynchrone : Future, async, await
Un Future représente une valeur disponible plus tard. Une fonction marquée async retourne un Future. await suspend la fonction jusqu'au résultat sans bloquer l'interface. Les erreurs se gèrent avec try/catch autour de await. Future.wait lance plusieurs opérations en parallèle. Un Stream est une suite de valeurs asynchrones, consommée avec listen ou await for.

## Classes, constructeurs et mixins
Dart est orienté objet : classes, héritage simple avec extends, interfaces implicites avec implements, classes abstraites. Un constructeur nommé n'utilise aucun mot-clé spécial : il s'écrit NomClasse.nom(). Exemple : class Point { final double x, y; Point(this.x, this.y); Point.origin() : x = 0, y = 0; } s'utilise avec Point.origin(). Un factory constructor se déclare avec le mot-clé factory et peut renvoyer une instance existante. Un mixin (mot-clé with) permet de réutiliser du code dans plusieurs classes sans héritage multiple.

## Paramètres de fonctions
Paramètres positionnels, paramètres nommés entre accolades { }, mot-clé required pour rendre un paramètre nommé obligatoire, et valeurs par défaut. Les fonctions sont des objets de première classe et supportent les fonctions anonymes et les flèches (=>).

## Collections
List (ordonnée), Set (éléments uniques), Map (clé-valeur). Méthodes fonctionnelles : map, where, fold, any, every. Opérateur de décomposition (...) et collection if/for pour construire des listes dynamiquement.

## Erreurs fréquentes
- Oublier await et manipuler un Future au lieu de sa valeur.
- Abuser de l'opérateur ! et provoquer des erreurs à l'exécution.
- Confondre final (valeur à l'exécution) et const (valeur à la compilation).
- Ne pas gérer les exceptions des opérations asynchrones.

## Questions d'entretien typiques
- Quelle est la différence entre final et const ?
- Comment fonctionnent async et await en Dart ?
- Qu'est-ce que la null safety ?
- Quelle est la différence entre Future et Stream ?
- À quoi servent les mixins ?
