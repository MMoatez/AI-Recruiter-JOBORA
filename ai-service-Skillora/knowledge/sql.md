# SQL

## Requêtes de base
SELECT choisit les colonnes, FROM la table, WHERE filtre les lignes, ORDER BY trie, LIMIT restreint le nombre de lignes. INSERT ajoute, UPDATE modifie, DELETE supprime.

## Agrégation
Fonctions COUNT, SUM, AVG, MIN, MAX avec GROUP BY. WHERE filtre les lignes avant le regroupement, HAVING filtre les groupes après le regroupement.

## Jointures
INNER JOIN garde les lignes qui ont une correspondance dans les deux tables. LEFT JOIN garde toutes les lignes de la table de gauche, avec NULL quand il n'y a pas de correspondance. RIGHT JOIN fait l'inverse et FULL JOIN garde tout.

## Clés
La clé primaire identifie une ligne de façon unique. La clé étrangère référence la clé primaire d'une autre table et garantit l'intégrité référentielle.

## Normalisation
Organiser les tables pour éviter la redondance : 1FN (valeurs atomiques), 2FN (pas de dépendance partielle à la clé), 3FN (pas de dépendance transitive). La dénormalisation est parfois utilisée pour accélérer les lectures.

## Index
Un index accélère les recherches et les tris sur une colonne, mais ralentit les écritures et occupe de l'espace. On indexe les colonnes souvent utilisées dans WHERE, JOIN et ORDER BY.

## Transactions et ACID
Une transaction regroupe des opérations qui réussissent ou échouent ensemble (COMMIT, ROLLBACK). ACID : Atomicité, Cohérence, Isolation, Durabilité.

## DELETE, TRUNCATE et DROP
DELETE supprime des lignes avec une condition et peut être annulé dans une transaction. TRUNCATE vide toute la table rapidement. DROP supprime la table elle-même.

## Erreurs fréquentes
- Oublier WHERE dans un UPDATE ou un DELETE et modifier toute la table.
- Utiliser SELECT * au lieu de choisir les colonnes.
- Construire les requêtes par concaténation de texte : risque d'injection SQL. Il faut utiliser des requêtes préparées.
- Le problème N+1 : exécuter une requête par ligne au lieu d'une jointure.

## Questions d'entretien typiques
- Quelle est la différence entre INNER JOIN et LEFT JOIN ?
- Quelle est la différence entre WHERE et HAVING ?
- Qu'est-ce qu'un index et quand l'utiliser ?
- Que signifie ACID ?
- Comment éviter l'injection SQL ?
