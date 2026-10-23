# Firebase

## Vue d'ensemble
Firebase est une plateforme Backend-as-a-Service de Google. Services principaux : Authentication, Cloud Firestore, Realtime Database, Cloud Storage, Cloud Functions, Cloud Messaging (notifications push) et Hosting. Elle permet de se passer d'un serveur pour des applications simples.

## Firebase Authentication
Gère l'inscription et la connexion par email et mot de passe, Google, téléphone et autres fournisseurs. Méthodes courantes en Flutter : createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut. Le flux authStateChanges() notifie l'application des changements de connexion. L'utilisateur reçoit un jeton ID (JWT) vérifiable côté serveur.

## Cloud Firestore
Base NoSQL organisée en collections et documents. Elle supporte les requêtes filtrées et triées, la synchronisation en temps réel avec les snapshots, et le mode hors ligne. Un document a une taille limitée (environ 1 Mio) et les requêtes complexes nécessitent des index.

## Firestore vs Realtime Database
Firestore utilise un modèle de documents et collections, des requêtes plus riches et une meilleure montée en charge. Realtime Database stocke un grand arbre JSON, est plus simple et très rapide pour des données simples, mais ses requêtes sont limitées.

## Règles de sécurité
Les Security Rules contrôlent qui peut lire ou écrire. Exemple : autoriser seulement les utilisateurs connectés avec request.auth != null, ou limiter l'accès à ses propres documents avec request.auth.uid. Le mode test, ouvert à tous, ne doit jamais rester en production.

## Intégration dans Flutter
Ajouter firebase_core, puis firebase_auth et cloud_firestore selon les besoins. Configurer le projet avec la FlutterFire CLI (flutterfire configure). Appeler await Firebase.initializeApp() avant runApp, après WidgetsFlutterBinding.ensureInitialized().

## Erreurs fréquentes
- Oublier Firebase.initializeApp() avant d'utiliser un service.
- Laisser les règles en mode test en production.
- Ne pas gérer les FirebaseAuthException (mot de passe faible, email déjà utilisé...).
- Faire trop de lectures : Firestore facture à la lecture, donc il faut limiter et paginer.
- Se désabonner trop tard des streams Firestore dans les widgets.

## Questions d'entretien typiques
- Comment implémenter l'authentification avec Firebase dans Flutter ?
- Quelle est la différence entre Firestore et Realtime Database ?
- À quoi servent les Security Rules ?
- Comment réagir aux changements de connexion de l'utilisateur ?
- Comment initialiser Firebase dans une application Flutter ?
