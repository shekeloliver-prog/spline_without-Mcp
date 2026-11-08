import { useEffect, useRef, useState } from 'react'
import { BODY_LIST, ALL_BODIES, VIEWS } from './data.js'

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
// React doesn't re-render the whole HUD every frame. Once "Today's sky" has
// set a calendar epoch, it shows the simulated date instead.
const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
function Elapsed({ time, epoch }) {
  const ref = useRef()
  useEffect(() => {
    const id = setInterval(() => {
      const years = time.current
      const e = epoch?.current
      ref.current.textContent = e
        ? DATE_FORMAT.format(new Date(e.ms0 + (years - e.t0) * 365.25 * 86400000))
        : years < 1
          ? `${Math.floor(years * 365.25)} days`
          : `${years.toFixed(1)} years`
    }, 150)
    return () => clearInterval(id)
  }, [time, epoch])
  return <span ref={ref}>0 days</span>
}

// The guided tour's caption, above the fly-to bar.
function TourPanel({ tour, controls }) {
  const [name, text] = tour.stops[tour.index] ?? []
  if (!name) return null
  return (
    <section className="hud-tour panel" aria-live="polite">
      <div className="tour-head">
        <span className="tour-step">
          Tour · stop {tour.index + 1} of {tour.stops.length}
        </span>
        <button className="ghost" onClick={controls.end} aria-label="End the tour">
          ✕
        </button>
      </div>
      <h2>{name}</h2>
      <p>{text}</p>
      <div className="tour-buttons">
        <button onClick={controls.prev} disabled={tour.index === 0}>
          ◀ Back
        </button>
        <button onClick={controls.toggle}>{tour.playing ? '❚❚ Hold' : '▶ Go on'}</button>
        <button onClick={controls.next} disabled={tour.index >= tour.stops.length - 1}>
          Next ▶
        </button>
      </div>
      <div className="tour-progress" aria-hidden="true">
        {tour.stops.map(([n], i) => (
          <span key={n} className={i === tour.index ? 'on' : i < tour.index ? 'done' : ''} />
        ))}
      </div>
    </section>
  )
}

// One-time note about what's new; closing it is remembered on this device.
const NEWS_KEY = 'solar-news-dismissed-v1'
function WhatsNew() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(NEWS_KEY) !== '1'
    } catch {
      return true
    }
  })
  if (!open) return null
  const close = () => {
    setOpen(false)
    try {
      localStorage.setItem(NEWS_KEY, '1')
    } catch {
      // storage blocked: the note just comes back next time
    }
  }
  return (
    <aside className="hud-news panel">
      <div className="tour-head">
        <strong>New</strong>
        <button className="ghost" onClick={close} aria-label="Close">
          ✕
        </button>
      </div>
      <p>
        Dwarf planets and the Kuiper belt, a guided <b>Tour</b>, <b>Today’s sky</b> (real planet positions), and a{' '}
        <b>Sizes</b> view comparing worlds at true scale.
      </p>
    </aside>
  )
}

const TOOLS = [
  ['blackhole', 'Black hole', 'Swallows anything that falls in, and grows as it feeds.'],
  ['whitehole', 'White hole', 'The reverse of a black hole: it pushes everything away.'],
  ['wormhole', 'Wormhole', 'Two linked mouths. Whatever falls into one comes out of the other.'],
  ['impactor', 'Impactor', 'Hurls a big asteroid at a planet or a moon.'],
]

const EVENT_TEXT = {
  solar: {
    title: 'Total solar eclipse',
    body: 'The Moon passes between the Sun and Earth. At totality only the Sun’s faint outer atmosphere, the corona, is visible.',
  },
  lunar: {
    title: 'Total lunar eclipse',
    body: 'Earth passes between the Sun and the Moon. Sunlight bent through Earth’s atmosphere turns the Moon red.',
  },
}

function toolHint(armed, pendingMouth) {
  if (armed === 'impactor') return 'Click a planet or any moon to hit it. Zoom in to reach the small moons.'
  if (armed === 'wormhole') return pendingMouth ? 'Now click where the second mouth goes.' : 'Click where the first mouth goes.'
  if (armed) return 'Click the orbital plane, or a planet, to place it.'
  return 'Pick a tool, then click in the scene. Esc cancels.'
}

const TOOL_NAMES = { blackhole: 'Black hole', whitehole: 'White hole', wormhole: 'Wormhole' }

function SandboxPanel({ sandbox: sb, startsOpen }) {
  const earthGone = sb.destroyed.has('Earth') || sb.destroyed.has('Moon')
  const starGone = sb.starPhase !== 'normal'
  return (
    <details className="hud-sandbox panel" open={startsOpen}>
      <summary>Sandbox</summary>

      <div className="group">
        <span className="group-label">Events</span>
        <div className="two">
          <button onClick={() => sb.startEvent('solar')} disabled={earthGone || starGone || !!sb.eventType}>
            Solar eclipse
          </button>
          <button onClick={() => sb.startEvent('lunar')} disabled={earthGone || starGone || !!sb.eventType}>
            Lunar eclipse
          </button>
        </div>
      </div>

      <div className="group">
        <span className="group-label">Tools</span>
        <div className="two">
          {TOOLS.map(([key, label, about]) => (
            <button
              key={key}
              className={sb.armed === key ? 'active' : ''}
              aria-pressed={sb.armed === key}
              title={about}
              onClick={() => sb.arm(key)}
              disabled={!!sb.eventType}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="danger" onClick={sb.triggerSupernova} disabled={starGone || !!sb.eventType} title="The Sun explodes. Its shock wave vaporises the inner planets and flings the rest away.">
          {starGone ? 'Sun is now a pulsar' : 'Supernova'}
        </button>
        <p className="hint" aria-live="polite">{toolHint(sb.armed, sb.pendingMouth)}</p>
      </div>

      <div className="group">
        <label className="group-label" htmlFor="strength">Strength</label>
        <div className="segmented" role="group" aria-label="Tool strength" id="strength">
          {['small', 'medium', 'huge'].map((k) => (
            <button key={k} className={sb.strength === k ? 'active' : ''} aria-pressed={sb.strength === k} onClick={() => sb.setStrength(k)}>
              {k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {sb.tools.length > 0 && (
        <div className="group">
          <span className="group-label">Placed</span>
          <ul className="placed">
            {sb.tools.map((t) => (
              <li key={t.id}>
                {TOOL_NAMES[t.type]}
                <button className="ghost" onClick={() => sb.removeTool(t.id)} aria-label={`Remove ${TOOL_NAMES[t.type]}`}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sb.destroyed.size > 0 && (
        <p className="hint">Destroyed: {[...sb.destroyed].join(', ')}</p>
      )}
      <button className="restore" onClick={sb.restore}>
        Restore the solar system
      </button>
    </details>
  )
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
    options, setOption, onReset, sandbox,
    today, tour, tourControls,
  } = props
  const body = ALL_BODIES.find((b) => b.name === selected)
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

      {sandbox.eventType && (
        <section className="hud-event panel" aria-live="polite">
          <h2>{EVENT_TEXT[sandbox.eventType].title}</h2>
          <p>{EVENT_TEXT[sandbox.eventType].body}</p>
          <button onClick={sandbox.endEvent}>End</button>
        </section>
      )}

      <div className="hud-right">
      <section className="hud-controls panel" aria-label="Simulation controls">
        <div className="row">
          <button className="primary" onClick={() => setPaused(!paused)}>
            {paused ? '▶ Play' : '❚❚ Pause'}
          </button>
          <button onClick={tour ? tourControls.end : tourControls.start} disabled={!!sandbox.eventType}>
            {tour ? 'End tour' : '✦ Tour'}
          </button>
          <span className="elapsed">
            {today.on ? 'Date: ' : 'Elapsed: '}
            <Elapsed time={time} epoch={today.epoch} />
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
            <span className="group-label">Time</span>
            <button className={today.on ? 'active' : ''} onClick={today.show} title="Approximate: mean orbits">
              {today.on ? '✓ Today’s sky (tap to refresh)' : 'Today’s sky'}
            </button>
            <small className="note">
              Moves the planets and the Moon’s phase to where they are right now (approximately), and pauses. Press
              Play to run time on from today.
            </small>
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
              <kbd>Space</kbd> pause · <kbd>←</kbd> <kbd>→</kbd> next body · <kbd>Esc</kbd> back / cancel tool
            </span>
          </div>

          <button className="ghost reset" onClick={onReset}>
            Reset options
          </button>
        </details>
      </section>
      <SandboxPanel sandbox={sandbox} startsOpen={startsOpen} />
      </div>

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

      {tour && <TourPanel tour={tour} controls={tourControls} />}
      {!tour && <WhatsNew />}

      <nav className="hud-bodies panel" aria-label="Fly to">
        {BODY_LIST.map((b) => [
          b.name === 'Ceres' && <span key="dwarf-divider" className="divider" title="Dwarf planets" aria-hidden="true" />,
          <button
            key={b.name}
            className={selected === b.name ? 'active' : ''}
            aria-pressed={selected === b.name}
            onClick={() => onSelect(b.name)}
            disabled={sandbox.destroyed.has(b.name) || !!sandbox.eventType}
          >
            {b.name}
          </button>,
        ])}
      </nav>
    </div>
  )
}
