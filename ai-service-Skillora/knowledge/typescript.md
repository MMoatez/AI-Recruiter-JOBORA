# TypeScript

## Principe
TypeScript est un sur-ensemble typé de JavaScript, compilé en JavaScript. Le typage statique détecte des erreurs avant l'exécution et améliore l'autocomplétion et la maintenance. Les types disparaissent à la compilation.

## Types de base et inférence
string, number, boolean, array (string[] ou Array<string>), tuple, enum, null, undefined. TypeScript infère souvent le type à partir de la valeur, donc il n'est pas toujours nécessaire de l'écrire.

## interface vs type
Les deux décrivent la forme d'un objet. interface peut être étendue (extends) et fusionnée par déclaration multiple, ce qui convient aux contrats d'objets et de classes. type est plus flexible : unions, intersections, alias de types primitifs et types calculés.

## any, unknown et never
any désactive la vérification de type et doit être évité. unknown force à vérifier le type avant utilisation, donc il est plus sûr. never représente une valeur qui ne se produit jamais.

## Unions, intersections et narrowing
Un type union (string | number) accepte plusieurs types. Le narrowing affine le type avec typeof, instanceof ou une propriété discriminante. Une intersection (A & B) combine plusieurs types.

## Génériques et types utilitaires
Les génériques (function identity<T>(x: T): T) rendent le code réutilisable tout en gardant le typage. Types utilitaires : Partial, Required, Pick, Omit, Record, Readonly.

## Configuration
tsconfig.json configure le compilateur. Le mode strict active les vérifications importantes (strictNullChecks, noImplicitAny) et est recommandé.

## Erreurs fréquentes
- Abuser de any, ce qui supprime l'intérêt de TypeScript.
- Forcer les types avec as sans vérification.
- Désactiver le mode strict.
- Croire que les types existent à l'exécution : ils ne valident pas les données reçues d'une API.

## Questions d'entretien typiques
- Quelle est la différence entre interface et type ?
- Quelle est la différence entre any et unknown ?
- À quoi servent les génériques ?
- Qu'est-ce que le narrowing ?
- Quels types utilitaires connais-tu ?
