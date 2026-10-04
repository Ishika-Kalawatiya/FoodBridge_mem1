import { useEffect, useRef, useState } from "react";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
let mapsPromise;

function loadMaps() {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (!API_KEY || API_KEY === "YOUR_KEY_HERE") return Promise.reject(new Error("Add your Google Maps API key to the root .env file to use live maps."));
  if (!mapsPromise) {
    mapsPromise = new Promise((resolve, reject) => {
      const callback = "foodBridgeMapsReady";
      window[callback] = () => {
        delete window[callback];
        resolve(window.google.maps);
      };
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(API_KEY)}&libraries=geometry&callback=${callback}`;
      script.async = true;
      script.onerror = () => reject(new Error("Google Maps could not load. Check your API key and enabled Maps JavaScript API."));
      document.head.appendChild(script);
    });
  }
  return mapsPromise;
}

export default function MapView() {
  const mapElement = useRef(null);
  const map = useRef(null);
  const renderer = useRef(null);
  const vehicle = useRef(null);
  const animation = useRef(null);
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [mapError, setMapError] = useState("");
  const [routeStats, setRouteStats] = useState(null);
  const [routing, setRouting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadMaps().then((maps) => {
      if (cancelled || !mapElement.current) return;
      map.current = new maps.Map(mapElement.current, {
        center: { lat: 40.7128, lng: -74.006 },
        zoom: 12,
        mapTypeId: "satellite",
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: "cooperative",
      });
      renderer.current = new maps.DirectionsRenderer({ map: map.current, suppressMarkers: false, polylineOptions: { strokeColor: "#f0a94d", strokeWeight: 5, strokeOpacity: 0.95 } });
    }).catch((error) => {
      if (!cancelled) setMapError(error.message);
    });
    return () => {
      cancelled = true;
      if (animation.current) window.clearInterval(animation.current);
      if (vehicle.current) vehicle.current.setMap(null);
    };
  }, []);

  async function buildRoute(event) {
    event.preventDefault();
    setMapError("");
    setRouteStats(null);
    if (!map.current) {
      setMapError("The map is still loading. Please try again in a moment.");
      return;
    }
    setRouting(true);
    if (animation.current) window.clearInterval(animation.current);
    if (vehicle.current) vehicle.current.setMap(null);
    try {
      const maps = await loadMaps();
      const result = await new maps.DirectionsService().route({
        origin: pickup.trim(),
        destination: dropoff.trim(),
        travelMode: maps.TravelMode.DRIVING,
      });
      renderer.current.setDirections(result);
      const route = result.routes[0];
      const leg = route.legs[0];
      const path = route.overview_path;
      const totalMeters = path.reduce((sum, point, index) => index ? sum + maps.geometry.spherical.computeDistanceBetween(path[index - 1], point) : sum, 0);
      const speedKmh = 28;
      const totalSeconds = Math.max(1, (totalMeters / 1000 / speedKmh) * 3600);
      const started = Date.now();
      const marker = new maps.Marker({
        map: map.current,
        position: path[0],
        title: "FoodBridge delivery in progress",
        zIndex: 10,
        icon: { path: maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 6, fillColor: "#f07843", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
      });
      vehicle.current = marker;
      const update = () => {
        const elapsed = (Date.now() - started) / 1000;
        const driven = Math.min(totalMeters, (elapsed / totalSeconds) * totalMeters);
        let segment = 1;
        let segmentStart = 0;
        while (segment < path.length) {
          const length = maps.geometry.spherical.computeDistanceBetween(path[segment - 1], path[segment]);
          if (segmentStart + length >= driven) {
            const fraction = length ? (driven - segmentStart) / length : 0;
            const current = maps.geometry.spherical.interpolate(path[segment - 1], path[segment], fraction);
            marker.setPosition(current);
            marker.setIcon({ path: maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 6, fillColor: "#f07843", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2, rotation: maps.geometry.spherical.computeHeading(path[segment - 1], path[segment]) });
            break;
          }
          segmentStart += length;
          segment++;
        }
        const remaining = Math.max(0, totalMeters - driven);
        const distance = remaining >= 1000 ? `${(remaining / 1000).toFixed(1)} km` : `${Math.round(remaining)} m`;
        const eta = Math.ceil((remaining / 1000 / speedKmh) * 60);
        setRouteStats({ distance, eta: remaining === 0 ? 0 : eta, speed: remaining === 0 ? 0 : speedKmh, total: leg.distance.text });
        if (remaining === 0 && animation.current) {
          window.clearInterval(animation.current);
          animation.current = null;
        }
      };
      update();
      animation.current = window.setInterval(update, 1000);
    } catch (error) {
      setMapError(error.message || "Could not calculate a driving route. Check the addresses and try again.");
    } finally {
      setRouting(false);
    }
  }

  return (
    <section className="section-wrap map-section" id="map">
      <div className="section-heading"><div><p className="eyebrow">FROM SURPLUS TO SOMEONE’S TABLE</p><h2>Good things are <em>on the move.</em></h2></div><span className="map-type-pill">◉ SATELLITE VIEW</span></div>
      <div className="map-card">
        <form className="route-form" onSubmit={buildRoute}>
          <label>Pickup location<input required value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Enter pickup address" /></label>
          <span className="route-connector">→</span>
          <label>Drop-off location<input required value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="Enter delivery address" /></label>
          <button className="button button-primary" disabled={routing}>{routing ? "Finding route…" : "Plan route"}<span>↗</span></button>
        </form>
        <div className="map-canvas" ref={mapElement} aria-label="Satellite map showing your route" />
        {mapError && <div className="map-message" role="status">{mapError}</div>}
        {routeStats && <div className="route-stats"><div><small>SPEED</small><strong>{routeStats.speed} <span>km/h</span></strong></div><div><small>ETA</small><strong>{routeStats.eta} <span>min</span></strong></div><div><small>LEFT TO GO</small><strong>{routeStats.distance}</strong></div><div><small>FULL ROUTE</small><strong>{routeStats.total}</strong></div></div>}
      </div>
      <p className="map-caption">Enter pickup and drop-off addresses to chart your run. The vehicle marker simulates progress at an estimated 28 km/h; connect GPS telemetry for live volunteer tracking.</p>
    </section>
  );
}
