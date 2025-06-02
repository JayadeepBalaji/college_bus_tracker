import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { doc, setDoc, collection, getDocs, deleteDoc, query, where } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const geoOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 10000,
};

const DriverDashboard = ({ onLogout }) => {
  const [bus, setBus] = useState(null);
  const [busId, setBusId] = useState("");
  const [currentLocation, setCurrentLocation] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [userPosition, setUserPosition] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");
  const [isTracking, setIsTracking] = useState(false);
  const [watchId, setWatchId] = useState(null);
  const watchIdRef = useRef(null); 
  const [lastUpdateTime, setLastUpdateTime] = useState(null);

  // Fetch assigned bus to the logged-in driver
  useEffect(() => {
    const fetchAssignedBus = async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) return;
        const busesRef = collection(db, "buses");
        const q = query(busesRef, where("driverID", "==", user.uid));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const busDoc = snapshot.docs[0];
          setBus({ id: busDoc.id, ...busDoc.data() });
          setBusId(busDoc.id);
        } else {
          setBus(null);
          setBusId("");
        }
      } catch (error) {
        console.error("Error fetching assigned bus:", error);
      }
    };
    fetchAssignedBus();
    // eslint-disable-next-line
  }, []);

  // Update watchIdRef whenever watchId changes
  useEffect(() => {
    watchIdRef.current = watchId;
  }, [watchId]);

  // Cleanup geolocation watch when component unmounts
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Auto-start tracking when busId is selected
  useEffect(() => {
    if (busId && !isTracking) {
      startLocationTracking();
    }
    if (!busId && isTracking && watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
      setIsTracking(false);
    }
    // eslint-disable-next-line
  }, [busId]);

  // Get current location (one-time)
  const getCurrentLocation = () => {
    setLoadingLocation(true);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserPosition({ latitude, longitude });
          setCurrentLocation(`Current location: (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`);
          setLoadingLocation(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          setCurrentLocation("Unable to retrieve location");
          setLoadingLocation(false);
        }
      );
    } else {
      setCurrentLocation("Geolocation is not supported by this browser");
      setLoadingLocation(false);
    }
  };

  // Toggle location tracking
  const toggleLocationTracking = () => {
    if (isTracking) {
      // Stop tracking
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        setWatchId(null);
      }
      setIsTracking(false);
      setUpdateMessage("Location tracking stopped");
      setTimeout(() => setUpdateMessage(""), 3000);
    } else {
      // Start tracking
      if (!busId) {
        setUpdateMessage("Please select a bus first");
        setTimeout(() => setUpdateMessage(""), 3000);
        return;
      }
      
      startLocationTracking();
    }
  };

  // Start continuous location tracking
  const startLocationTracking = () => {
    if (!busId) return;
    setIsTracking(true);
    setLoadingLocation(true);

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newPosition = { latitude, longitude, accuracy };
        setUserPosition(newPosition);
        setCurrentLocation(
          `Tracking: (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`
        );
        setLoadingLocation(false);
        updateFirestoreLocation(newPosition);
      },
      (error) => {
        setLoadingLocation(false);
        setIsTracking(false);
        setCurrentLocation("Unable to get location.");
      },
      geoOptions
    );
    setWatchId(id);
    watchIdRef.current = id; // <-- always update ref
  };

  // Update location in Firestore
  const updateFirestoreLocation = async (position) => {
    if (!busId || !position) return;

    try {
      const now = new Date();
      const timestamp = now.toISOString();
      const formattedTime = now.toLocaleTimeString();

      await setDoc(doc(db, "bus_locations", busId), {
        busId,
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy, // Store accuracy
        timestamp,
        lastUpdated: formattedTime,
      });

      setLastUpdateTime(formattedTime);
    } catch (error) {
      console.error("Error updating location:", error);
    }
  };

  // Manual update bus location
  const updateBusLocation = async (e) => {
    e.preventDefault();
    if (!busId || !userPosition) return;
    
    setIsUpdating(true);
    
    try {
      const now = new Date();
      const timestamp = now.toISOString();
      const formattedTime = now.toLocaleTimeString();
      
      await setDoc(doc(db, "bus_locations", busId), {
        busId,
        latitude: userPosition.latitude,
        longitude: userPosition.longitude,
        timestamp,
        lastUpdated: formattedTime
      });
      
      setLastUpdateTime(formattedTime);
      setUpdateMessage("Location updated successfully!");
      
      // Clear message after 3 seconds
      setTimeout(() => {
        setUpdateMessage("");
      }, 3000);
    } catch (error) {
      console.error("Error updating location:", error);
      setUpdateMessage("Error updating location. Please try again.");
    }
    
    setIsUpdating(false);
  };

  // Delete bus location
  const deleteBusLocation = async () => {
    if (!busId) return;
    // Stop tracking if active
    if (isTracking) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        setWatchId(null);
      }
      setIsTracking(false);
    }
    
    setIsUpdating(true);
    
    try {
      await deleteDoc(doc(db, "bus_locations", busId));
      setCurrentLocation("");
      setUserPosition(null);
      setLastUpdateTime(null);
      setUpdateMessage("Location deleted successfully!");
      
      // Clear message after 3 seconds
      setTimeout(() => {
        setUpdateMessage("");
      }, 3000);
    } catch (error) {
      console.error("Error deleting location:", error);
      setUpdateMessage("Error deleting location. Please try again.");
    }
    
    setIsUpdating(false);
  };

  return (
    <div className="driver-dashboard page-transition">
      <h2>Driver Dashboard</h2>
      
      <div className="dashboard-container">
        {bus ? (
          <form onSubmit={updateBusLocation}>
            <div className="form-group">
              <label>Assigned Bus</label>
              <div className="bus-name-box">{bus.name}</div>
            </div>
            
            <div className="location-controls">
              <div className="location-buttons">
                <button 
                  type="button" 
                  className="btn btn-outline get-location-btn"
                  onClick={getCurrentLocation}
                  disabled={loadingLocation || isTracking}
                >
                  {loadingLocation ? "Getting Location..." : "Get Current Location"}
                </button>
                
                <button 
                  type="button" 
                  className={`btn btn-primary tracking-btn${isTracking ? ' tracking-active' : ''}`}
                  onClick={toggleLocationTracking}
                  disabled={loadingLocation}
                >
                  {isTracking ? "Stop Tracking" : "Start Live Tracking"}
                </button>
              </div>
              
              <div className="current-location">
                {currentLocation && <p>{currentLocation}</p>}
                {lastUpdateTime && <p className="last-update">Last update: {lastUpdateTime}</p>}
                {isTracking && <p className="tracking-status">✓ Live location tracking is active</p>}
              </div>
            </div>
            
            <div className="action-buttons">
              <button 
                type="submit" 
                className="btn btn-primary update-btn"
                disabled={isUpdating || !userPosition || isTracking}
              >
                {isUpdating ? "Updating..." : "Update Location Once"}
              </button>
              
              <button 
                type="button" 
                className="btn btn-danger delete-btn"
                onClick={deleteBusLocation}
                disabled={isUpdating}
              >
                Delete Location
              </button>
            </div>
          </form>
        ) : (
          <div className="error-message">No bus assigned to your account.</div>
        )}
        
        {updateMessage && (
          <div className="update-message">
            {updateMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverDashboard;