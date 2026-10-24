# JavaScript

## var, let et const
var a une portée de fonction et est remonté (hoisting) avec la valeur undefined. let et const ont une portée de bloc et ne sont pas utilisables avant leur déclaration. const interdit la réaffectation mais un objet const reste modifiable en interne. On utilise const par défaut, let si la valeur change, et on évite var.

## == vs ===
== compare avec conversion de type (0 == "0" est vrai), === compare sans conversion et exige le même type (0 === "0" est faux). On préfère toujours ===.

## Closures
Une closure est une fonction qui garde l'accès aux variables de sa portée d'origine, même après la fin de cette portée. Elle sert à encapsuler des données privées, fabriquer des fonctions configurables et mémoriser des valeurs.

## this et fonctions fléchées
La valeur de this dépend de la façon dont la fonction est appelée. Une fonction fléchée n'a pas son propre this : elle utilise celui de son contexte englobant, ce qui évite de nombreux pièges dans les callbacks.

## Asynchronisme : callbacks, Promises, async/await
JavaScript est mono-thread et utilise une boucle d'événements (event loop). Les callbacks mènent au "callback hell". Les Promises représentent un résultat futur (then, catch, finally). async/await écrit du code asynchrone lisible, avec try/catch pour les erreurs. Promise.all lance plusieurs promesses en parallèle.

## ES6 et plus
Déstructuration, opérateur spread et rest, template literals, modules import/export, chaînage optionnel (?.) et coalescence nulle (??). Méthodes de tableau : map, filter, reduce, find, some, every.

## Erreurs fréquentes
- Oublier await et utiliser une Promise comme si c'était sa valeur.
- Utiliser == au lieu de ===.
- Modifier directement des objets ou tableaux au lieu de créer des copies.
- Utiliser var dans une boucle avec des callbacks.
- Ne pas gérer les promesses rejetées.

## Questions d'entretien typiques
- Quelle est la différence entre var, let et const ?
- Qu'est-ce qu'une closure ?
- Comment fonctionne la boucle d'événements ?
- Quelle est la différence entre == et === ?
- Explique async/await par rapport aux Promises.
