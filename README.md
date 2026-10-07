# Carnet de route

Un petit logiciel pour préparer un voyage et le présenter à ses proches sur un ordinateur.

- **Éditeur de scénarios** : départ (lieu, date, heure), puis des étapes (vol, escale, transfert, séjour) avec un commentaire pour chacune.
- **Présentation animée** : un film plein écran composé à partir du scénario. Un globe trace le trajet, et chaque étape affiche ses horaires, sa durée, la distance et le décalage horaire. La présentation se termine par le programme jour par jour et un récapitulatif.

Chaque étape commence quand la précédente se termine. Allonger l'escale d'Abu Dhabi décale donc automatiquement toutes les heures qui suivent, dans l'éditeur comme dans la présentation. Les heures sont toujours données en heure locale, fuseaux et changements d'heure compris.

Tout tient dans **un seul fichier `carnet-de-route.html`**, à ouvrir d'un double-clic sans installation ni connexion.

## Utilisation

1. Ouvrir `carnet-de-route.html` dans Chrome, Edge ou Firefox.
2. Modifier le scénario d'exemple, ou en créer un nouveau avec « Nouveau ». « Dupliquer » sert à créer une variante, par exemple une escale plus longue.
3. Cliquer sur **Lancer la présentation**. Pendant la présentation :
   - Espace met en pause ;
   - ← → passent d'une scène à l'autre ;
   - Échap quitte.

### Sauvegarder et partager

- Chaque modification est gardée automatiquement **dans le navigateur** de l'ordinateur.
- **Enregistrer une copie** télécharge un nouveau fichier `.html` qui contient tous les scénarios. C'est la vraie sauvegarde, et c'est ce fichier qu'on envoie à quelqu'un.
- **Exporter / Importer** échangent un seul scénario sous forme de petit fichier `.json`.

### Lieux

Le catalogue propose les aéroports français et voisins, les hubs du Golfe (Abu Dhabi, Dubaï, Doha, Istanbul…), Djeddah, Médine, La Mecque, Mina, Arafat, etc. Pour un lieu absent (un hôtel, une autre ville), choisir « Ajouter un lieu » dans la liste, puis coller ses coordonnées GPS. Sur Google Maps, on les obtient par un clic droit sur le lieu.

## Développement

```bash
npm install
npm run dev        # éditeur en direct sur http://localhost:5173
npm test           # tests du calcul des horaires
npm run build      # produit dist/carnet-de-route.html
```

- `src/domaine/` : modèle des scénarios, calcul de la chronologie (fuseaux, distances, alertes), programme jour par jour, sauvegarde.
- `src/editeur/` : l'éditeur.
- `src/presentation/` : le globe (d3-geo), les scènes et le moteur de lecture.
