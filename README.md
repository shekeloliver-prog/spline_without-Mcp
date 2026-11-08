# Spline solar system

A 3D solar system built with Vite, React and react-three-fiber from the Spline
starter file (`spline_3_d_starter_file.glb`):

- **Sphere:** the Sun, the planets and the Moon.
- **Cube:** a satellite orbiting Earth, and the rocks of the asteroid belt.
- **Path:** the orbit of a comet.

The planets wear real NASA-based maps. Earth has clouds, city lights on its
night side and a thin atmosphere. Credits are in `CREDITS.md`.

The original Spline scene is still there, at `#/spline`.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

**Controls:** drag to orbit, scroll to zoom. Click a planet, or use the bar at
the bottom, to fly to it and see facts about it. Use the panel at the top right
to pause, change speed, and show or hide labels and orbits.

See `CLAUDE.md` for how it's put together.

## Import into Spline

`exports/solar-system-for-spline.glb` is the solar system as one file for a
new Spline project:

1. In Spline, create a new file.
2. Drag the `.glb` onto the canvas, or use the Import option in Spline's
   file menu.

It contains the Sun, the eight planets (with their real surface maps), the
Moon, Saturn's rings, the satellite, orbit lines, a 240-rock asteroid belt
and the comet on your original Path. Every object is named. It is static:
motion, glow, eclipses and the sandbox tools only exist in the web app, so
use Spline's states and events to animate it there. Lights aren't
included; add a point light at the Sun in Spline.

To rebuild it after changing `src/solar/data.js`:

```bash
npm run export:spline
```
