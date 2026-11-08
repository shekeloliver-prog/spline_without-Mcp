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
