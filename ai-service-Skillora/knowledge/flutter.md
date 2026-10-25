# Flutter

## Widgets
Dans Flutter, tout est widget. Une interface est un arbre de widgets, et chaque widget est une description immuable d'une partie de l'écran. Flutter reconstruit les widgets quand les données changent, en s'appuyant sur la méthode build.

## StatelessWidget vs StatefulWidget
Un StatelessWidget n'a pas d'état interne modifiable : son affichage dépend uniquement de ses paramètres, et il convient aux éléments statiques. Un StatefulWidget possède un objet State dont les données peuvent changer pendant la vie du widget ; appeler setState() déclenche une nouvelle exécution de build. On utilise un StatefulWidget quand l'interface évolue selon des interactions ou des données.

## Cycle de vie d'un State
Ordre principal : createState, initState (appelé une fois, pour initialiser), didChangeDependencies, build (appelé à chaque reconstruction), didUpdateWidget, dispose (libérer controllers, abonnements et streams). initState sert aux initialisations, dispose au nettoyage.

## Gestion d'état
setState convient à l'état local d'un widget. Pour un état partagé entre plusieurs écrans, on utilise une solution dédiée : Provider, Riverpod, Bloc ou GetX. Ces solutions séparent l'interface de la logique et évitent de faire remonter l'état manuellement.

## Layouts
Row (horizontal), Column (vertical), Stack (superposition), Expanded et Flexible (répartir l'espace), Container, Padding, SizedBox. ListView.builder construit les éléments à la demande et convient aux longues listes.

## Navigation
Navigator.push et Navigator.pop gèrent une pile d'écrans. Les routes nommées centralisent les chemins. Le package go_router offre une navigation déclarative avec liens profonds.

## Hot reload vs hot restart
Le hot reload injecte le code modifié et conserve l'état de l'application. Le hot restart relance l'application et réinitialise l'état. Un changement d'initialisation d'état demande un hot restart.

## Erreurs fréquentes
- Appeler setState dans build, ce qui crée une boucle de reconstruction.
- Oublier dispose et laisser fuir des controllers ou des streams.
- Mettre un ListView dans une Column sans Expanded : erreur de hauteur non bornée.
- Utiliser BuildContext après un await sans vérifier que le widget est toujours monté.
- Reconstruire de gros widgets au lieu d'utiliser const et de découper en petits widgets.

## Questions d'entretien typiques
- Quelle est la différence entre StatelessWidget et StatefulWidget ?
- Décris le cycle de vie d'un StatefulWidget.
- Comment gères-tu l'état dans une application Flutter ?
- Quelle est la différence entre hot reload et hot restart ?
- Pourquoi utiliser ListView.builder ?
