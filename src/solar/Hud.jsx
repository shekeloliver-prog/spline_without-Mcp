import { useEffect, useRef } from 'react'
import { SUN, PLANETS, COMET } from './data.js'

const BODIES = [SUN, ...PLANETS, COMET]
const SPEEDS = [0.25, 0.5, 1, 2, 5, 10, 25, 50]

// Elapsed simulated time, written straight to the DOM a few times a second so
// React doesn't re-render the whole HUD every frame.
function Elapsed({ time }) {
  const ref = useRef()
  useEffect(() => {
    const id = setInterval(() => {
      const years = time.current
      ref.current.textContent =
        years < 1 ? `${Math.floor(years * 365.25)} days` : `${years.toFixed(1)} years`
    }, 150)
    return () => clearInterval(id)
  }, [time])
  return <span ref={ref}>0 days</span>
}

export default function Hud(props) {
  const {
    time, selected, onSelect,
    paused, setPaused, speed, setSpeed,
    showLabels, setShowLabels, showOrbits, setShowOrbits,
  } = props
  const body = BODIES.find((b) => b.name === selected)
  const speedIndex = Math.max(0, SPEEDS.indexOf(speed))

  return (
    <div className="hud">
      <header className="hud-title panel">
        <h1>Solar System</h1>
        <p>
          Every planet is the Sphere from your Spline file, the asteroids and satellite are its Cube,
          and the comet rides its Path.
        </p>
        <a href="#/spline">View the original Spline scene →</a>
        <small className="credits">
          Maps: <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener noreferrer">Solar System Scope</a> (CC BY 4.0), NASA
        </small>
      </header>

      <section className="hud-controls panel" aria-label="Simulation controls">
        <div className="row">
          <button className="primary" onClick={() => setPaused(!paused)}>
            {paused ? '▶ Play' : '❚❚ Pause'}
          </button>
          <span className="elapsed">
            Elapsed: <Elapsed time={time} />
          </span>
        </div>
        <label className="speed">
          <span>
            Speed <strong>{speed}×</strong> <small>(1× = 1 year in 20 s)</small>
          </span>
          <input
            type="range"
            min={0}
            max={SPEEDS.length - 1}
            step={1}
            value={speedIndex}
            onChange={(e) => setSpeed(SPEEDS[+e.target.value])}
          />
        </label>
        <div className="row toggles">
          <label>
            <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
            Labels
          </label>
          <label>
            <input type="checkbox" checked={showOrbits} onChange={(e) => setShowOrbits(e.target.checked)} />
            Orbits
          </label>
        </div>
      </section>

      {body && (
        <section className="hud-info panel" aria-live="polite">
          <div className="info-head">
            <h2>{body.name}</h2>
            <button className="ghost" onClick={() => onSelect(null)} aria-label="Back to overview">
              ✕
            </button>
          </div>
          <p>{body.blurb}</p>
          <dl>
            {Object.entries(body.facts).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <nav className="hud-bodies panel" aria-label="Fly to">
        <button className={selected === null ? 'active' : ''} onClick={() => onSelect(null)}>
          Overview
        </button>
        {BODIES.map((b) => (
          <button key={b.name} className={selected === b.name ? 'active' : ''} onClick={() => onSelect(b.name)}>
            {b.name}
          </button>
        ))}
      </nav>
    </div>
  )
}
