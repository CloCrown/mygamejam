# myGameJam

Projet pour le [js13kgames](https://js13kgames.com/) 2026.

Le jeu doit tenir dans une archive zip de 13 Ko maximum.

## Concept

7 épreuves olympiques sur le thème "Unicorns and Rainbows" (une par couleur de l'arc-en-ciel), jouables en mode solo (les 7 à la suite) ou en mode multi.

## Stack

- JavaScript vanilla + [kontra.js](https://straker.github.io/kontra/)
- Voir [Stack.md](Stack.md) pour le détail de l'architecture et de l'outillage.

## Taille

`npm run zip` build puis vérifie la taille du zip final par rapport à la limite des 13 Ko (13 312 octets).

## Statut

En cours de préparation.

- Fait : machine à états (menu/épreuve/résultat), écran d'accueil, écran d'options avec touches rebindables, mécanique "mash", sprite licorne
- À faire : mécaniques charge & release / timing bar / séquence, habillage des 7 épreuves
