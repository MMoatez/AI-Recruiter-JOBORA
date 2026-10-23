# JWT

## Principe
JWT (JSON Web Token) est un jeton compact qui prouve l'identité d'un utilisateur. Il a trois parties encodées en base64url et séparées par des points : header (algorithme), payload (les données, appelées claims) et signature. Le serveur n'a pas besoin de stocker de session : l'authentification est sans état (stateless).

## Signature et confidentialité
La signature garantit l'intégrité : si quelqu'un modifie le payload, la signature n'est plus valide. Le payload est seulement encodé, pas chiffré : n'importe qui peut le lire. Il ne faut donc jamais y mettre de mot de passe ni de donnée sensible.

## Claims courants
sub (identifiant de l'utilisateur), iat (date d'émission), exp (date d'expiration), plus des données utiles comme le rôle. La vérification contrôle la signature et l'expiration.

## Flux d'authentification
1. L'utilisateur envoie ses identifiants. 2. Le serveur les vérifie et renvoie un jeton signé. 3. Le client envoie le jeton dans l'en-tête Authorization: Bearer à chaque requête. 4. Le serveur vérifie la signature et l'expiration avant de répondre.

## Access token et refresh token
L'access token a une durée de vie courte (par exemple 15 minutes), ce qui limite les dégâts s'il est volé. Le refresh token, à durée plus longue, sert à obtenir un nouvel access token sans se reconnecter. Il peut être révoqué côté serveur.

## Algorithmes
HS256 utilise un secret partagé entre émetteur et vérificateur. RS256 utilise une paire de clés : clé privée pour signer, clé publique pour vérifier, ce qui convient aux architectures avec plusieurs services.

## Stockage côté client
Un cookie httpOnly est inaccessible au JavaScript, donc protégé contre le vol par XSS, mais demande une protection CSRF. Le localStorage est simple mais vulnérable au XSS.

## Erreurs fréquentes
- Mettre des données sensibles dans le payload.
- Jeton sans expiration, ou durée trop longue.
- Secret faible ou écrit en dur dans le code.
- Ne pas vérifier la signature, ou accepter l'algorithme "none".
- Stocker le jeton dans le localStorage sans se protéger du XSS.

## Questions d'entretien typiques
- Comment est structuré un JWT ?
- Le payload d'un JWT est-il chiffré ?
- Quelle est la différence entre access token et refresh token ?
- Quelle est la différence entre HS256 et RS256 ?
- Où stocker un JWT côté client ?
