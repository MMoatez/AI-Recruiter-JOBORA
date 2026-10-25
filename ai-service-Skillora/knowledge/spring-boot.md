# Spring Boot

## Principe
Spring Boot simplifie la création d'applications Spring grâce à l'auto-configuration, aux starters (dépendances regroupées comme spring-boot-starter-web) et à un serveur intégré (Tomcat). Une application démarre avec une classe annotée @SpringBootApplication.

## Inversion de contrôle et injection de dépendances
Le conteneur Spring crée et gère les objets (beans) et les injecte là où ils sont nécessaires. Annotations de stéréotype : @Component, @Service, @Repository, @Controller. L'injection par constructeur est préférée à l'injection par champ avec @Autowired, car elle facilite les tests et rend les dépendances explicites.

## Architecture en couches
Controller (reçoit les requêtes HTTP), Service (logique métier), Repository (accès aux données). Chaque couche a une responsabilité unique. Les contrôleurs ne doivent pas contenir de logique métier.

## API REST
@RestController combine @Controller et @ResponseBody. Mappings : @GetMapping, @PostMapping, @PutMapping, @DeleteMapping. @PathVariable lit une variable d'URL, @RequestParam un paramètre de requête, @RequestBody le corps JSON. ResponseEntity permet de contrôler le code de statut.

## Accès aux données
Spring Data JPA pour les bases relationnelles et Spring Data MongoDB pour MongoDB. Une interface qui étend JpaRepository ou MongoRepository fournit le CRUD sans code. Les méthodes dérivées du nom (findByEmail) génèrent la requête.

## Configuration et profils
application.properties ou application.yml contiennent la configuration. Les profils (dev, prod) permettent des paramètres différents selon l'environnement. Les secrets doivent venir de variables d'environnement.

## Validation et gestion d'erreurs
@Valid avec les annotations de validation (@NotBlank, @Email, @Size) vérifie les entrées. @ControllerAdvice avec @ExceptionHandler centralise la gestion des erreurs et renvoie des réponses cohérentes.

## Sécurité
Spring Security gère l'authentification et l'autorisation. Avec JWT, un filtre vérifie le jeton à chaque requête. Les mots de passe sont hachés (BCrypt), jamais stockés en clair.

## Erreurs fréquentes
- Mettre la logique métier dans le contrôleur.
- Exposer directement les entités au lieu d'utiliser des DTO.
- Injection par champ qui complique les tests.
- Secrets et mots de passe en clair dans application.properties.
- Oublier la validation des entrées.

## Questions d'entretien typiques
- Qu'est-ce que l'injection de dépendances ?
- Quelle est la différence entre @Component, @Service et @Repository ?
- Qu'est-ce que l'auto-configuration ?
- Comment sécuriser une API avec JWT dans Spring Boot ?
- Pourquoi utiliser des DTO ?
