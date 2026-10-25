# MongoDB

## Principe
MongoDB est une base de données NoSQL orientée documents. Les données sont stockées en documents au format BSON (proche du JSON) regroupés en collections. Le schéma est flexible : deux documents d'une même collection peuvent avoir des champs différents.

## Opérations CRUD
insertOne et insertMany créent, find et findOne lisent, updateOne et updateMany modifient (avec des opérateurs comme $set, $inc, $push), deleteOne et deleteMany suppriment. Opérateurs de filtre : $gt, $lt, $in, $and, $or.

## Embedding vs referencing
On imbrique (embed) des documents quand les données sont lues ensemble et appartiennent à un parent. On utilise des références (stockage d'un identifiant) quand les données sont partagées, volumineuses ou changent souvent. Le choix dépend des motifs d'accès.

## Index
Un index accélère les lectures sur un champ mais ralentit un peu les écritures et consomme de la mémoire. Sans index, MongoDB parcourt toute la collection. Index composés et uniques possibles. explain() montre le plan d'exécution d'une requête.

## Pipeline d'agrégation
Enchaîne des étapes de traitement : $match (filtrer), $group (regrouper et calculer), $sort, $project, $lookup (jointure entre collections), $limit. Sert aux statistiques et rapports.

## Mongoose
Bibliothèque Node.js qui définit des schémas, valide les données et simplifie les requêtes. Elle apporte des modèles, des validations et des hooks.

## SQL vs NoSQL
Une base relationnelle impose un schéma strict et des jointures, avec des transactions ACID complètes. MongoDB offre un schéma flexible et une mise à l'échelle horizontale (sharding). MongoDB supporte aussi les transactions multi-documents sur un replica set.

## Erreurs fréquentes
- Ne pas créer d'index sur les champs utilisés dans les recherches.
- Imbriquer des tableaux qui grandissent sans limite (un document est limité à 16 Mo).
- Utiliser $lookup partout comme des jointures SQL au lieu de bien modéliser.
- Ne pas valider les données faute de schéma.

## Questions d'entretien typiques
- Quelle est la différence entre SQL et NoSQL ?
- Quand imbriquer des documents et quand utiliser des références ?
- À quoi servent les index ?
- Qu'est-ce que le pipeline d'agrégation ?
- À quoi sert Mongoose ?
