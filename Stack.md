# Stack

Documentation de la stack technique utilisée pour ce projet js13kgames 2026.

## Contrainte principale

Le jeu final (zip) doit peser **13 312 octets maximum** (13 Ko). Tous les choix techniques ci-dessous sont faits pour rester le plus léger possible tout en gardant un code lisible en développement.

## Langage & runtime

- **JavaScript vanilla** (ES modules), pas de TypeScript pour éviter l'étape de compilation supplémentaire et rester au plus proche du code final.
- **Node.js** côté outillage (build, serveur de dev, zip).

## Librairie de jeu

- **[kontra.js](https://straker.github.io/kontra/)** — librairie ultra-légère pensée pour js13k (boucle de jeu, sprites, gestion clavier, etc.). Import sélectif pour ne bundler que ce qui est utilisé.

## Build & outillage

- **[esbuild](https://esbuild.github.io/)** — bundling + minification du code source (`src/`) en un seul fichier `dist/bundle.js`.
- Scripts npm (`package.json`) :
  - `npm run build` — build unique minifié
  - `npm run watch` — rebuild automatique en développement
  - `npm run serve` — petit serveur HTTP statique maison (`scripts/serve.js`, sans dépendance) sur `http://localhost:8080`
  - `npm run zip` — build + génère `mygamejam.zip` (via `scripts/zip.js`, utilise `Compress-Archive` de PowerShell) et vérifie la taille par rapport à la limite des 13 Ko

## Architecture du code

- `index.html` — page unique, charge `dist/bundle.js`
- `src/main.js` — point d'entrée, boucle de jeu, machine à états (menu / épreuve / résultat)
- `src/data/events.js` — configuration des 7 épreuves (couleur, nom, mécanique associée)
- `src/mechanics/` — mécaniques de jeu génériques et réutilisables entre plusieurs épreuves (mash, charge & release, timing bar, séquence) pour limiter le poids du code

## Concept de jeu

7 épreuves olympiques (une par couleur de l'arc-en-ciel, thème "Unicorns and Rainbows"), jouables en **mode solo** (les 7 épreuves à la suite) ou en **mode multi**. Chaque épreuve repose sur l'une des 4 mécaniques génériques ci-dessus, avec un habillage (couleur, décor) différent.

## Tests

- Vérification manuelle dans le navigateur via le serveur de dev.
- Tests automatisés ponctuels avec **Playwright** (headless Chromium) pour valider le déroulé menu → épreuve → résultat sans erreur console.
