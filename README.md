# Carnet de route

Un petit logiciel pour préparer un voyage et le présenter à ses proches sur un ordinateur. Il comprend deux fichiers HTML :

- **Le carnet** (`carnet-de-route.html`), ton outil. Tu y crées et modifies les scénarios : départ (lieu, date, heure), puis des étapes (vol, escale, transfert, séjour), avec un commentaire pour chacune. Le bouton **Prévisualiser la visite** montre la visite exactement comme tes proches la verront.
- **La visite** (`visite-….html`), ce que tu montres ou envoies. Elle est produite par **Exporter la visite** et ne contient que le scénario choisi, sans éditeur. Elle s'ouvre sur un écran d'accueil (le voyage en un coup d'œil, puis « Lancer la visite »), puis passe à une présentation animée en plein écran :
  - un globe trace le trajet ;
  - chaque étape affiche ses horaires, sa durée, la distance et le décalage horaire ;
  - la présentation se termine par le programme jour par jour et un récapitulatif.

Chaque étape commence quand la précédente se termine. Allonger l'escale d'Abu Dhabi décale donc automatiquement toutes les heures qui suivent. Les heures sont toujours données en heure locale, fuseaux et changements d'heure compris.

Les deux fichiers s'ouvrent d'un double-clic, sans installation ni connexion.

## Utilisation

1. Ouvrir `carnet-de-route.html` dans Chrome, Edge ou Firefox.
2. Modifier le scénario d'exemple, ou en créer un nouveau avec « Nouveau ». « Dupliquer » sert à créer une variante, par exemple une escale plus longue.
3. Cliquer sur **Prévisualiser la visite** pour la voir, puis sur **Exporter la visite** pour obtenir le fichier à ouvrir ou à envoyer.

Pendant la visite :
- Entrée lance la visite depuis l'accueil ;
- Espace met en pause ;
- ← → passent d'une scène à l'autre ;
- Échap revient à l'accueil.

### Où sont gardés les scénarios

- Le carnet les garde **dans le navigateur** de l'ordinateur, avec une sauvegarde automatique à chaque modification. Ils ne sont pas écrits dans le fichier `carnet-de-route.html` lui-même.
- Pour les mettre à l'abri ou les retrouver sur un autre ordinateur, utiliser **Exporter** puis **Importer** dans la colonne de gauche. On échange ainsi un scénario sous forme de petit fichier `.json`.
- Un fichier de visite exporté contient son scénario pour toujours. Si le scénario change ensuite dans le carnet, il faut exporter à nouveau la visite.

### Lieux

Le catalogue propose les aéroports français et voisins, les hubs du Golfe (Abu Dhabi, Dubaï, Doha, Istanbul…), Djeddah, Médine, La Mecque, Mina, Arafat, etc. Pour un lieu absent (un hôtel, une autre ville), choisir « Ajouter un lieu » dans la liste, puis coller ses coordonnées GPS. Sur Google Maps, on les obtient par un clic droit sur le lieu.

## Développement

```bash
npm install
npm run dev        # carnet en direct sur http://localhost:5173 (la visite seule : /visite.html)
npm test           # tests du calcul des horaires
npm run build      # produit dist/carnet-de-route.html
```

Le build se fait en deux temps. Le lecteur de visite (`visite.html`, `src/visite/`) est d'abord compilé en `dist-visite/visite.html`. Ce fichier est ensuite inclus dans le carnet, qui s'en sert de gabarit pour « Exporter la visite » en y glissant le scénario choisi.

- `src/domaine/` : modèle des scénarios, calcul de la chronologie (fuseaux, distances, alertes), programme jour par jour, sauvegarde, export de la visite.
- `src/editeur/` : l'éditeur du carnet.
- `src/presentation/` : le globe (d3-geo), les scènes et le moteur de lecture.
- `src/visite/` : le lecteur de visite (accueil + présentation), utilisé à la fois par le fichier exporté et par l'aperçu du carnet.
