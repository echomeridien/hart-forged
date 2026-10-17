# Hart Forged configurator (prototype)

A 3D bespoke wheel configurator: three designs (Split-10, Y-Spoke, Mesh), monoblock / 2-piece / 3-piece construction, face, lip and hardware finishes, an exploded view, a cut-away, and indicative fitment numbers.

It's a static site: plain HTML, CSS and JavaScript, with three.js loaded from a CDN. There's no build step.

## Run it on your Mac

```bash
cd ~/code/hart-forged
python3 -m http.server 8000
```

Then open http://localhost:8000. (Opening `index.html` directly won't work, because browsers only load JavaScript modules over http.) Press Ctrl + C to stop the server.

## Files

| File | What it does |
|---|---|
| `index.html` | Page layout and the three.js import map |
| `styles.css` | All styling |
| `js/config.js` | Designs, finishes, sizes and defaults. Edit this to add options |
| `js/fitment.js` | Fitment maths: backspacing, lip depth, concave, warnings |
| `js/geom.js` | Wheel geometry: barrel profile, spokes, lathe and sweep helpers |
| `js/wheel.js` | Turns the geometry into a 3D model |
| `js/main.js` | Scene, camera, controls and the options panel |
| `tests/geometry.test.mjs` | Checks the maths and geometry across 15,000+ wheel sizes |

Run the tests with `node tests/geometry.test.mjs`.

## Accuracy

Fitment figures come from a simplified wheel model and are indicative only. Brake clearance needs real caliper data per vehicle; final fitment is confirmed by Racing Hart Concepts before any order.
