# My paper maze

A first-person 3D maze with ten levels and a rectangular map editor. Level one uses a hand-drawn design and requires only collecting items. Later levels add keys, block-shaped enemies and torches.

## Run

Requires Python 3.10 or later and a modern browser with WebGL. No npm, account or model key is required.

```sh
python serve.py
```

Open http://127.0.0.1:8766/ . On Windows, you can also double-click `start.cmd`. For a local network, run `python serve.py --host 0.0.0.0` and open the host computer's LAN address with port 8766 on another device. Start the server from this game directory. Opening an HTML file directly will not load browser modules correctly.

## Controls

- WASD or arrow keys: move. Mouse: look around. Touch controls are available on phones.
- E: collect fire, light a torch, or climb up/down a ladder.
- Space: swing the light staff. F: place a marker. H: show a hint.
- Collect the required items, find the ladder, climb onto the walls and walk along the wall top to the exit door.
- From level five, visibility is limited until you find fire and light torches.

The editor supports widths and heights of 5–43 cells, including the boundary walls. Set colours, a start, items, a ladder and a door on the wall top. Import or export a map as JSON. Progress is saved in the current browser and does not sync between devices.

## Change the game

`game/levels.mjs` defines level rules and the first map; `characters.mjs` and `themes.mjs` define characters and colours. `collision.mjs` handles walls, and `rooftop.mjs` handles the route above them. `effects.mjs` and `audio.mjs` provide feedback. The existing OGG music is included; running the music composition scripts is optional.

The first map is a hand-interpreted grid version of a drawing, not a pixel-perfect reconstruction. This repository includes a generated route diagram, not the original photograph. The game interface is in Simplified Chinese.

Code: MIT. Teaching text: CC BY 4.0. Three.js has its own MIT notice. See [ATTRIBUTION.md](ATTRIBUTION.md).
