import { useEffect, useRef, useState } from 'react'
import { BODY_LIST, VIEWS } from './data.js'

const SPEEDS = [0.25, 0.5, 1, 2, 5, 10, 25, 50]

// Display options, in the order they appear in the panel.
const TOGGLES = [
  ['showLabels', 'Labels'],
  ['labelDetails', 'Label details'],
  ['showOrbits', 'Orbits'],
  ['showBelt', 'Asteroid belt'],
  ['showSky', 'Milky Way'],
  ['showGlow', 'Sun glow'],
  ['autoRotate', 'Auto-rotate'],
]

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

// The options section starts collapsed on phones, open elsewhere.
function useStartsOpen() {
  const [open] = useState(() => !window.matchMedia?.('(max-width: 760px)').matches)
  return open
}

export default function Hud(props) {
  const {
    time, selected, onSelect, view, onView,
    paused, setPaused, speed, setSpeed,
    options, setOption, onReset,
  } = props
  const body = BODY_LIST.find((b) => b.name === selected)
  const speedIndex = Math.max(0, SPEEDS.indexOf(speed))
  const startsOpen = useStartsOpen()

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
        <label className="speed" htmlFor="speed">
          <span>
            Speed <strong>{speed}×</strong> <small>(1× = 1 year in 20 s)</small>
          </span>
          <input
            id="speed"
            type="range"
            min={0}
            max={SPEEDS.length - 1}
            step={1}
            value={speedIndex}
            onChange={(e) => setSpeed(SPEEDS[+e.target.value])}
          />
        </label>

        <details className="more" open={startsOpen}>
          <summary>Options</summary>

          <div className="group">
            <span className="group-label">View</span>
            <div className="segmented" role="group" aria-label="Camera view">
              {Object.entries(VIEWS).map(([key, v]) => (
                <button
                  key={key}
                  className={view === key && !selected ? 'active' : ''}
                  aria-pressed={view === key && !selected}
                  onClick={() => onView(key)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="group">
            <span className="group-label">Show</span>
            <div className="toggles">
              {TOGGLES.map(([key, label]) => (
                <label key={key} htmlFor={`opt-${key}`}>
                  <input
                    id={`opt-${key}`}
                    type="checkbox"
                    checked={options[key]}
                    disabled={key === 'labelDetails' && !options.showLabels}
                    onChange={(e) => setOption(key, e.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="group keys">
            <span className="group-label">Keys</span>
            <span>
              <kbd>Space</kbd> pause · <kbd>←</kbd> <kbd>→</kbd> next body · <kbd>Esc</kbd> back
            </span>
          </div>

          <button className="ghost reset" onClick={onReset}>
            Reset everything
          </button>
        </details>
      </section>

      {body && (
        <section className="hud-info panel" aria-live="polite">
          <div className="info-head">
            <div>
              <h2>{body.name}</h2>
              {body.facts.Type && <span className="info-type">{body.facts.Type}</span>}
            </div>
            <button className="ghost" onClick={() => onSelect(null)} aria-label="Back to the view">
              ✕
            </button>
          </div>
          <p>{body.blurb}</p>
          <dl>
            {Object.entries(body.facts)
              .filter(([k]) => k !== 'Type')
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
        </section>
      )}

      <nav className="hud-bodies panel" aria-label="Fly to">
        {BODY_LIST.map((b) => (
          <button
            key={b.name}
            className={selected === b.name ? 'active' : ''}
            aria-pressed={selected === b.name}
            onClick={() => onSelect(b.name)}
          >
            {b.name}
          </button>
        ))}
      </nav>
    </div>
  )
}
