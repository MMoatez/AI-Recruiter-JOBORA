# React

## Composants et JSX
React construit l'interface avec des composants réutilisables, aujourd'hui des fonctions qui retournent du JSX. JSX est une syntaxe qui ressemble à du HTML mais se compile en appels JavaScript. L'approche est déclarative : on décrit l'interface selon l'état, React met à jour le DOM.

## Props vs state
Les props sont les données passées du parent à l'enfant ; elles sont en lecture seule. Le state est la donnée interne d'un composant qui, en changeant, déclenche un nouveau rendu. Les données descendent par les props, et les événements remontent par des fonctions passées en props.

## Hook useState
const [valeur, setValeur] = useState(initiale). Le state ne doit jamais être modifié directement : on passe par la fonction de mise à jour, avec une nouvelle copie pour les objets et tableaux. Une mise à jour dépendant de l'ancienne valeur utilise la forme fonctionnelle setValeur(v => v + 1).

## Hook useEffect
Exécute des effets de bord (appel API, abonnement, timer) après le rendu. Le tableau de dépendances contrôle quand il se relance : vide = une seule fois au montage, absent = à chaque rendu. La fonction retournée sert de nettoyage (cleanup) au démontage.

## Autres hooks
useRef (référence mutable sans rendu, accès au DOM), useMemo (mémoriser un calcul), useCallback (mémoriser une fonction), useContext (partager des données sans passer par les props), useReducer (état complexe). Les hooks s'appellent seulement au niveau racine d'un composant, jamais dans une condition ou une boucle.

## Listes, keys et formulaires
Dans un rendu de liste, chaque élément doit avoir une key stable et unique, de préférence un identifiant et non l'index. Un composant contrôlé lie la valeur d'un champ au state avec value et onChange.

## Virtual DOM
React compare la nouvelle arborescence virtuelle à l'ancienne (réconciliation) et ne met à jour dans le vrai DOM que ce qui a changé.

## État global et routage
Context API pour des cas simples ; Redux, Zustand ou autre pour un état global plus complexe. React Router gère la navigation côté client.

## Erreurs fréquentes
- Oublier le tableau de dépendances de useEffect et provoquer une boucle infinie.
- Modifier directement le state.
- Utiliser l'index comme key dans une liste dynamique.
- Appeler des hooks dans une condition.
- Mettre dans le state des valeurs qu'on peut calculer à partir d'autres données.

## Questions d'entretien typiques
- Quelle est la différence entre props et state ?
- Comment fonctionne useEffect et son tableau de dépendances ?
- Pourquoi les keys sont-elles importantes dans une liste ?
- Qu'est-ce que le Virtual DOM ?
- Quand utiliser useMemo et useCallback ?
