# NestJS

## Principe
NestJS est un framework Node.js en TypeScript pour construire des API côté serveur. Son architecture modulaire et ses décorateurs sont inspirés d'Angular. Il s'appuie par défaut sur Express.

## Modules, controllers et providers
Un module (@Module) regroupe des fonctionnalités liées. Un controller (@Controller) reçoit les requêtes HTTP et définit les routes (@Get, @Post, @Put, @Delete). Un provider, typiquement un service (@Injectable), contient la logique métier. Le controller délègue au service.

## Injection de dépendances
Nest instancie et injecte les providers par le constructeur. Un provider utilisé dans un autre module doit être exporté par son module (exports), et ce module doit être importé (imports). Si un provider n'est pas déclaré, Nest renvoie une erreur de dépendance non résolue.

## Pipes, guards, interceptors et filters
Les pipes transforment et valident les données (ValidationPipe avec class-validator et class-transformer). Les guards décident si une requête est autorisée (authentification, rôles). Les interceptors ajoutent une logique avant et après le handler (logs, transformation de réponse). Les exception filters formatent les erreurs. Ordre : middleware, guards, interceptors, pipes, handler, interceptors, exception filters.

## DTO et validation
Un DTO décrit le format des données entrantes. Avec class-validator (@IsEmail, @IsString, @MinLength) et un ValidationPipe global, les entrées invalides sont rejetées automatiquement avec une erreur 400.

## MongoDB avec Mongoose
Le package @nestjs/mongoose fournit MongooseModule. On définit un schéma avec @Schema et @Prop, puis on injecte le modèle avec @InjectModel dans un service.

## Authentification JWT
@nestjs/jwt et Passport permettent de signer et de vérifier les jetons. Le login vérifie les identifiants et renvoie un jeton. Un guard protège les routes en vérifiant l'en-tête Authorization: Bearer. Les mots de passe sont hachés avec bcrypt.

## Appel d'un service externe
HttpModule (@nestjs/axios) permet d'appeler une autre API, par exemple un service Python d'IA. Il faut prévoir un timeout adapté et gérer les erreurs.

## Erreurs fréquentes
- Oublier d'importer ou d'exporter un module, d'où une erreur de dépendance.
- Mettre la logique métier dans le controller.
- Ne pas activer le ValidationPipe.
- Secrets en dur dans le code au lieu de ConfigModule et variables d'environnement.
- Ne pas gérer les erreurs des appels à des services externes.

## Questions d'entretien typiques
- Quel est le rôle d'un module, d'un controller et d'un provider ?
- Quelle est la différence entre un guard et un interceptor ?
- Comment valider les données d'une requête ?
- Comment protéger une route avec JWT ?
- Comment fonctionne l'injection de dépendances dans NestJS ?
