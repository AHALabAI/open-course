# Animal garden

A 2D pet-care game with twelve animals and four maps. Name pets, feed them, play ball and discover more animals. Feeding and playing have animated responses and sound effects.

## Run

Requires Python 3.10 or later and a modern browser. No npm, account, key or online assets are needed.

```sh
python serve.py
```

Open http://127.0.0.1:8768/ . Windows users can also double-click `start.cmd`. For a local network, run `python serve.py --host 0.0.0.0` and use the host computer's LAN address with port 8768. Use HTTP rather than opening the HTML file directly.

## Play

Name the first cat, then choose “找动物” (find animals) and open a hiding place. Select a discovered animal from the row below to care for it.

- Forest: 2 animal friends and 4 care actions.
- Pond: 5 friends and 12 care actions.
- Snow: 8 friends and 20 care actions.

Feeding and playing ball both count as care actions. Progress stays in the current browser. Leaving the page does not reduce pet status. There is no illness, death or payment mechanic. Restarting requires confirmation.

## Change the game

Edit `MAPS` and `ANIMALS` in `animal-garden/garden.mjs` to change maps, unlock conditions, animals and fictional foods. The SVG functions draw the animals. `garden.css` defines their animations and responsive layout. `lesson.html` contains activity cards in Chinese. The game interface is in Simplified Chinese.

This is AHALab's editable classroom example. The separate student project made in Coze is not included in this source. Foods and actions are fictional game illustrations, not advice for caring for real animals.

Code and procedural graphics: MIT. Teaching text: CC BY 4.0. See [ATTRIBUTION.md](ATTRIBUTION.md).
