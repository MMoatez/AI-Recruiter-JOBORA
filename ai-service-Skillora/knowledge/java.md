# Java

## JVM, JRE et JDK
Le JDK contient les outils de développement (compilateur javac). Le JRE contient ce qu'il faut pour exécuter. La JVM exécute le bytecode, ce qui rend Java portable : "write once, run anywhere".

## Programmation orientée objet
Quatre piliers : encapsulation (attributs privés, accès par getters et setters), héritage (extends), polymorphisme (une même méthode se comporte différemment selon l'objet) et abstraction (classes abstraites et interfaces).

## Interface vs classe abstraite
Une interface définit un contrat et une classe peut en implémenter plusieurs. Une classe abstraite peut contenir de l'état et du code partagé, mais une classe n'en hérite que d'une seule. Depuis Java 8, les interfaces peuvent avoir des méthodes par défaut.

## Collections
List (ordonnée, doublons permis : ArrayList, LinkedList), Set (sans doublons : HashSet, TreeSet), Map (clé-valeur : HashMap, TreeMap). ArrayList est rapide pour l'accès par index, LinkedList pour les insertions fréquentes au milieu. HashMap n'est pas thread-safe, ConcurrentHashMap l'est.

## Exceptions
Les exceptions vérifiées (checked, comme IOException) doivent être déclarées ou capturées. Les exceptions non vérifiées (RuntimeException, comme NullPointerException) ne l'exigent pas. try-catch-finally et try-with-resources gèrent la libération des ressources.

## == vs equals
== compare les références pour les objets, equals compare le contenu quand il est redéfini. Si on redéfinit equals, il faut aussi redéfinir hashCode, sinon les collections hachées se comportent mal.

## Lambdas et Streams
Depuis Java 8, les expressions lambda et l'API Stream permettent un style fonctionnel : filter, map, collect, reduce. Optional évite de manipuler directement null.

## Mémoire et ramasse-miettes
La pile (stack) contient les variables locales et les appels, le tas (heap) contient les objets. Le ramasse-miettes (Garbage Collector) libère automatiquement les objets inaccessibles. Les String sont immuables.

## Erreurs fréquentes
- NullPointerException faute de vérification de null.
- Comparer des String avec == au lieu de equals.
- Modifier une collection pendant son itération : ConcurrentModificationException.
- Redéfinir equals sans hashCode.
- Capturer Exception de façon trop large et ignorer l'erreur.

## Questions d'entretien typiques
- Quelle est la différence entre interface et classe abstraite ?
- Quelle est la différence entre == et equals ?
- Quelle est la différence entre ArrayList et LinkedList ?
- Explique les exceptions checked et unchecked.
- Qu'est-ce que le polymorphisme ?
