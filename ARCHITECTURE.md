# Architecture — contexte pour agents

Ce fichier donne le contexte technique dont un agent a besoin pour travailler sur une partie du jeu sans avoir à relire tout l'historique de conversation. Voir aussi `CLAUDE.md` pour les règles générales du projet (phase d'exploration, pas de serveur local, etc.).

## Vue d'ensemble

`game/game.html` charge une série de `<script src="...">` qui sont concaténés/minifiés/packés par `build.js` (Terser + Roadroller + html-minifier-terser + advzip) en un seul fichier HTML autonome dans `dist/`, puis zippé (`dist.zip`) pour la soumission js13kgames.

**Budget js13kgames : 13 312 octets (13 KB) zippés.** Toujours vérifier `npm run build` après un changement — la sortie affiche la taille et le pourcentage du budget utilisé. Actuellement autour de 95%.

**Test** : ouvrir `game/game.html` ou `dist/game.html` directement dans le navigateur (`file://`), jamais de serveur local.

## Périmètre par tâche (éviter les collisions entre agents)

Si plusieurs agents travaillent en parallèle sur ce projet, chacun doit rester dans son périmètre pour ne pas écraser le travail d'un autre. `game.js` et `game.html` sont des points de convergence partagés par presque tout le jeu — un agent ne doit les éditer que si sa tâche l'exige explicitement (voir ci-dessous), jamais en passant.

| Tâche | Fichiers à éditer | Fichiers à NE PAS toucher |
|---|---|---|
| Musique / sons | `audio.js` uniquement | `game.js` (déjà câblé, voir section Audio plus bas), tout le reste |
| Nouveau type d'obstacle | `obstacle-types.js`, `track2.js` (assignation des types par position) | `game.js` (déjà générique), `obstacles.js` (sauf si la mécanique de collision elle-même doit changer) |
| Animation d'impact / flinch | `horse-rig-skinned.js` (nouveaux helpers d'animation), `side-debug-panel.js` (debug) | `game.js` tant que l'animation n'est pas prête à être branchée ; en discuter avant d'y toucher |
| Power-up "perforation" | `powerups.js` (nouvel effet dans `PICKUP_COLORS`) | `game.js` seulement pour le branchement final, une fois la logique validée séparément |
| Mesh/rig 3D de la licorne | Rien en JS — le changement part de Blender (utilisateur) | `horse-mesh-skinned.js` (généré, jamais édité à la main), `horse-rig-skinned.js` sauf pour la logique d'animation (pas les données) |

`build.js` ne doit être édité que par une seule personne/agent à la fois, hors de ce tableau : plusieurs agents peuvent lancer `npm run build` en parallèle sans risque (ça régénère juste `dist/`), mais éditer `build.js` lui-même est à coordonner séparément pour éviter d'écraser un changement de pipeline en cours.

Si une tâche semble nécessiter d'éditer `game.js` alors qu'elle n'est pas listée ci-dessus comme le nécessitant, c'est probablement le signe qu'il manque un point d'extension générique (comme le registre `OBSTACLE_TYPES` ou le contrat `Audio_`) plutôt qu'une raison d'éditer `game.js` directement — proposer d'abord d'ajouter ce point d'extension.

## Fichiers actifs (chargés dans game.html)

Dans l'ordre de chargement :

1. `gl-utils.js` — bas niveau : matrices (`m4`), scene-graph (`Node`, `TRS`), `createCubeBufferInfo`, compilation de shaders. Réutiliser ces helpers plutôt que réinventer une matrice/un cube.
2. `audio.js` — contrat audio, voir section dédiée plus bas.
3. `axis-gizmo.js` — gizmo de debug (exploration, retirable).
4. `tail-debug-panel.js` / `side-debug-panel.js` — panels de debug avec sliders (exploration, retirables).
5. `track2.js` — génère la géométrie de la piste (sol, waypoints) à partir de `TRACKS` (plusieurs circuits). Expose `createMarkerPositions`, `createPickupPositions`, `createObstaclePositions`, `createFinishLinePositions`.
6. `powerups.js` — logique pure des 7 power-ups (rouge=vitesse, orange=saut, jaune=invincibilité, vert=virage, bleu=grossir, indigo=rétrécir, violet=contrôles inversés). Pas de WebGL, testable isolément.
7. `obstacle-types.js` — registre des types d'obstacles (voir section dédiée).
8. `obstacles.js` — logique pure de collision/état des obstacles (voir section dédiée).
9. `horse-mesh-skinned.js` — données générées (positions, UV, poids de skinning). **Ne jamais éditer à la main** — régénéré depuis Blender, voir section pipeline 3D.
10. `horse-rig-skinned.js` — squelette + animation de galop + skinning CPU + helpers `leftBoneNames`/`rightBoneNames`.
11. `game.js` — **fichier central** : input clavier/souris, caméra, boucle de rendu (`drawScene`), état du joueur, toute la logique de collision, appelle tout le reste.

## Fichiers d'exploration non chargés (legacy, gardés pour référence)

`horse-rig.js`, `horse-mesh.js`, `unicorn-rig.js`, `horse-mesh-from-glb.js`, `horse-rig-from-glb.js` — anciennes versions/expérimentations du rig, plus utilisées par `game.html`.

`exploration/fbx_way/` — scripts Python Blender + fichiers `.glb`/`.json` du pipeline d'import 3D (voir plus bas).

## Pipeline 3D (horse-mesh-skinned.js)

Le mesh/squelette de la licorne vient de Blender, jamais édité à la main dans le JS :

1. Le fichier source est `exploration/fbx_way/new_horse.glb`, édité/exporté depuis Blender par l'utilisateur (pas par un agent — Blender est piloté manuellement).
2. `exploration/fbx_way/extract_horse_rig_skinned.py` (lancé via `blender --background --python ...`) extrait bones + skin weights + UV vers `horse_rig_skinned.json`.
3. `exploration/fbx_way/generate_horse_mesh_skinned_js.js` (Node) convertit ce JSON en `game/horse-mesh-skinned.js`.

Un agent ne doit **jamais éditer `horse-mesh-skinned.js` directement** — si le mesh doit changer, c'est côté Blender (utilisateur) puis re-génération via ce pipeline.

## Système d'obstacles (extensible sans toucher game.js)

Architecture pensée pour qu'un agent ajoute un nouveau type d'obstacle sans jamais éditer `game.js` :

- **`obstacle-types.js`** — registre `OBSTACLE_TYPES = { rock: {...}, ... }`. Chaque entrée : `size` [x,y,z], `color`, `radius` (collision), `yOffset`, `movable` (bool, peut être poussé), `destructible` (bool, peut être détruit). `maxSize`/`scale` sont précalculés automatiquement pour chaque type (ne pas les définir à la main).
- **`obstacles.js`** — logique pure : `createObstacles(positions, types)`, `resolveObstacleCollisions(obstacles, player, collisionRadius, speedFrac)`, `destroyObstacle(obstacle)`, `pushApart(player, ox, oz, minDist, obstacleShare)` (fonction de poussée cercle-cercle partagée, réutilisée aussi par le cheval-obstacle spécial dans `game.js`).
- **`game.js`** lit le registre génériquement (boucle sur `Object.keys(OBSTACLE_TYPES)`, un buffer WebGL par type) — ne contient aucun nom de type en dur.

**Pour ajouter un type d'obstacle** : ajouter une entrée dans `OBSTACLE_TYPES`, puis faire en sorte que `track2.js` (`createObstaclePositions`, à étendre pour retourner aussi un tableau `types` parallèle) assigne ce type à certaines positions. Aucun changement à `game.js` nécessaire.

**État actuel** : un seul type (`rock`), `movable: false`, `destructible: false` — rochers statiques uniquement, aucun obstacle mobile/destructible n'est encore branché en jeu (l'infra est prête, pas utilisée).

Le cheval-obstacle (`obstacleHorse`/`obstacleState` dans `game.js`) est **séparé** de ce système — il a un rig 3D animé (pas un cube), donc pas une entrée du registre. Il réutilise `pushApart`/`movableObstacleShare` d'`obstacles.js` pour sa physique, mais son dessin/animation reste dans `game.js`.

## Contrat audio (audio.js)

**État actuel : silencieux.** `audio.js` définit l'objet `Audio_` avec `play(name)` et `startMusic()`, tous deux no-op tant que les données sont `null`.

Choix technique : **synthèse procédurale (ZzFX pour les SFX, ZzFXM pour la musique)**, pas de fichier audio importé — trop lourd pour le budget js13k.

Événements déjà câblés dans `game.js` (aucun changement à `game.js` nécessaire pour les activer) :
- `jump` — au saut (Espace)
- `land` — à l'atterrissage
- `pickup` — au ramassage d'un power-up
- `effectActivate` — à l'activation d'un effet (touches `&`/`é`)
- `hitSoft` — au premier contact avec le cheval-obstacle (edge-detect, pas répété en continu)
- `hitHard` — prévu pour le futur power-up "perforation", pas encore câblé (n'existe pas encore dans `PICKUP_COLORS`)
- `startMusic()` — appelé au premier clic sur le canvas (contournement de la restriction navigateur sur l'audio avant interaction utilisateur)

**Pour un agent musique** : coller le code source ZzFX/ZzFXM dans `audio.js` (licence MIT, projet `KilledByAPixel/ZzFX` sur GitHub), remplir `ZZFX_PARAMS` (un array de paramètres par son) et `MUSIC_PATTERN` (pattern ZzFXM), implémenter le corps de `play()`/`startMusic()`. Rien d'autre à toucher — le câblage dans `game.js` est déjà fait.

## Rig gauche/droite (pour animation d'impact future)

`horse-rig-skinned.js` expose `leftBoneNames`/`rightBoneNames` sur l'objet retourné par `createHorseRigSkinned` — dérivés automatiquement des noms de bones se terminant par `.L`/`.R` (11 paires : shoulder, thigh, shin, foot, toe, front_thigh, front_shin, front_foot, front_toe, pelvis, breast). Utile pour appliquer une rotation à tout un côté du corps (ex: flinch lors d'un impact).

`side-debug-panel.js` est un panel de debug (sliders X/Y/Z + choix gauche/droite) pour visualiser l'effet de ces rotations avant de coder la vraie animation d'impact — pas encore implémentée.

## Collision : deux mécaniques distinctes prévues

- **Impact "sans dégâts"** (déjà implémenté) : poussée physique pure, pondérée par la vitesse du joueur (`speedFrac`/`movableObstacleShare` dans `obstacles.js`) — la licorne la plus rapide pousse l'autre.
- **Impact "avec dégâts"** (pas encore implémenté) : prévu pour un futur power-up "perforation" (n'existe pas encore dans `powerups.js`/`PICKUP_COLORS`), utiliserait probablement les helpers gauche/droite + le son `hitHard` déjà prévu dans le contrat audio.

## Outils de build

- `build.js` : Terser (minification JS) → Roadroller (compression, via `import("roadroller")` en dynamique — le require CommonJS casse sous Node récent, voir commentaire dans le fichier) → html-minifier-terser → Compress-Archive (PowerShell) → `tools/advancecomp/advzip.exe` si présent (recompression zip, gain gratuit ~1.2 Ko). `tools/` est dans `.gitignore` (binaire téléchargé, pas versionné).
- Pour retélécharger `advzip.exe` si absent : release GitHub `amadvance/advancecomp`, asset `advancecomp-2.6-windows-x64.zip`, extraire `advzip.exe` dans `tools/advancecomp/`.
