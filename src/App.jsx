import { useEffect, useState } from 'react'
import SolarSystem from './solar/SolarSystem.jsx'
import Scene from './Scene.jsx'

// Two views, picked by the URL hash:
//   #/        solar system (default)
//   #/spline  the original Spline scene
const readRoute = () => (window.location.hash.replace(/^#\/?/, '') === 'spline' ? 'spline' : 'solar')

export default function App() {
  const [route, setRoute] = useState(readRoute)
  useEffect(() => {
    const onHash = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (route === 'spline') {
    return (
      <>
        <Scene />
        <a className="back-link" href="#/">
          ← Solar system
        </a>
      </>
    )
  }
  return <SolarSystem />
}
