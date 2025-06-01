import React, { useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icon issue in Leaflet with Webpack
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const busIcon = new L.Icon({
  iconUrl,
  iconRetinaUrl: iconUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: iconShadow,
  shadowSize: [41, 41],
});

function RecenterMap({ lat, lng, recenterTrigger }) {
  const map = useMapEvents({});
  React.useEffect(() => {
    if (recenterTrigger) {
      // Set view to live location and zoom in to 18 for a close-up
      map.setView([lat, lng], 18, { animate: true });
    }
    // eslint-disable-next-line
  }, [recenterTrigger]);
  return null;
}

const BusLocationMap = ({ location, busId }) => {
  const [showRecenter, setShowRecenter] = useState(false);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const mapRef = useRef();

  // Handler to detect if user moves away from bus location
  function MapMoveHandler() {
    useMapEvents({
      moveend: (e) => {
        const map = e.target;
        const center = map.getCenter();
        const distance = map.distance(center, L.latLng(location.latitude, location.longitude));
        // Show recenter if user moved more than 100 meters from bus location
        setShowRecenter(distance > 100);
      },
      zoomend: (e) => {
        const map = e.target;
        const center = map.getCenter();
        const distance = map.distance(center, L.latLng(location.latitude, location.longitude));
        setShowRecenter(distance > 100);
      }
    });
    return null;
  }

  // Don't render anything if no location is available
  if (!location || !location.latitude || !location.longitude) {
    return (
      <div className="no-location-container">
        <p>No live location available for this bus yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="live-location-map" style={{ position: 'relative' }}>
        <MapContainer
          center={[location.latitude, location.longitude]}
          zoom={16}
          scrollWheelZoom={true}
          style={{ height: '350px', width: '100%' }}
          whenCreated={mapInstance => { mapRef.current = mapInstance; }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[location.latitude, location.longitude]} icon={busIcon}>
            <Popup>
              Bus {busId} <br />
              Lat: {location.latitude.toFixed(6)} <br />
              Lng: {location.longitude.toFixed(6)} <br />
            </Popup>
          </Marker>
          <MapMoveHandler />
          <RecenterMap lat={location.latitude} lng={location.longitude} recenterTrigger={recenterTrigger} />
        </MapContainer>
        {showRecenter && (
          <button
            className="recenter-btn"
            onClick={() => {
              setRecenterTrigger(prev => prev + 1);
              setShowRecenter(false);
            }}
          >
            Recenter
          </button>
        )}
      </div>
      <div className="location-info-card">
        <div className="location-coords-container" style={{boxShadow: 'none', border: 'none', background: 'none', padding: 0, margin: 0}}>
          <div className="location-coords-row">
            <div className="coordinate-display location-coords-left">
              <h4 style={{marginTop: 0}}>Current Bus Location</h4>
              <p className="coordinates">
                <span className="coordinate-label">Latitude:</span> {location.latitude.toFixed(6)}
              </p>
              <p className="coordinates">
                <span className="coordinate-label">Longitude:</span> {location.longitude.toFixed(6)}
              </p>
              <p className="coordinates accuracy-label">
                Accuracy: {location.accuracy !== undefined && location.accuracy !== null ? `${Number(location.accuracy).toFixed(2)} meters` : "Unknown"}
              </p>
              <p className="update-time">
                Last updated: {location.lastUpdated || "Unknown"}
              </p>
            </div>
          </div>
          <a
            href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-block btn-primary open-maps-btn"
            style={{marginTop: '1em'}}
          >
            Open precise location in Google Maps
          </a>
        </div>
      </div>
    </div>
  );
};

export default BusLocationMap;