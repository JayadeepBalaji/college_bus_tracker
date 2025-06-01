import React, { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { doc, onSnapshot, collection, getDocs } from "firebase/firestore";
import { signInWithEmailAndPassword } from "firebase/auth";
import DriverDashboard from "./components/DriverDashboard";
import BusLocationMap from './components/BusLocationMap';
import "./style.css";

const Home = ({ onSeeLiveLocation }) => {
  return (
    <div className="home-container page-transition">
      <h2 className="title">College Bus Tracker</h2>
      <BusList onSeeLiveLocation={onSeeLiveLocation} />
    </div>
  );
};

const BusList = ({ onSeeLiveLocation }) => {
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchBuses = async () => {
      try {
        const busesRef = collection(db, "buses");
        const snapshot = await getDocs(busesRef);
        const busesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setBuses(busesData);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching buses:", error);
        setError("Failed to load buses. Please try again later.");
        setLoading(false);
      }
    };
    
    fetchBuses();
  }, []);

  if (loading) {
    return <div className="loading">Loading buses...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (buses.length === 0) {
    return <div>No buses available at the moment.</div>;
  }

  return (
    <div className="bus-list-container">
      <h3 className="bus-list-title">Available Buses</h3>
      <div className="bus-list">
        {buses.map((bus) => (
          <BusCard
            key={bus.id}
            bus={bus}
            onSeeLiveLocation={onSeeLiveLocation}
          />
        ))}
      </div>
    </div>
  );
};

const BusCard = ({ bus, onSeeLiveLocation }) => {
  return (
    <div className="bus-card">
      <img src={bus.imageUrl} alt={bus.name} className="bus-image" />
      <h4 className="bus-name">{bus.name}</h4>
      <button
        className="btn btn-primary location-btn"
        onClick={() => onSeeLiveLocation(bus.id)}
      >
        View Live Location
      </button>
    </div>
  );
};

const BusLocationPage = ({ busId, onBack }) => {
  // In a real app, fetch the route data based on busId
  const busRoutes = {
    "1": [
      { stop: "Campus", time: "8:00 AM" },
      { stop: "Downtown", time: "8:30 AM" },
      { stop: "Library", time: "9:00 AM" }
    ],
    "2": [
      { stop: "Campus", time: "9:00 AM" },
      { stop: "Mall", time: "9:30 AM" },
      { stop: "Stadium", time: "10:00 AM" }
    ],
    "3": [
      { stop: "Campus", time: "10:00 AM" },
      { stop: "Hospital", time: "10:30 AM" },
      { stop: "Park", time: "11:00 AM" }
    ]
  };

  const routes = busRoutes[busId] || [];

  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locationExists, setLocationExists] = useState(false);
  const [locationHistory, setLocationHistory] = useState([]);

  useEffect(() => {
    setLoading(true);
    setLocationHistory([]);
    // Set up real-time listener for bus location
    const unsubscribe = onSnapshot(doc(db, "bus_locations", busId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setLocation({
          latitude: data.latitude,
          longitude: data.longitude,
          lastUpdated: data.lastUpdated,
          accuracy: data.accuracy
        });
        setLocationExists(true);
        // Maintain a short history in memory (not persisted)
        setLocationHistory(prev => {
          const newEntry = {
            latitude: data.latitude,
            longitude: data.longitude,
            lastUpdated: data.lastUpdated,
            accuracy: data.accuracy
          };
          // Only add if different from last
          if (!prev.length || prev[prev.length-1].latitude !== newEntry.latitude || prev[prev.length-1].longitude !== newEntry.longitude) {
            const updated = [...prev, newEntry];
            // Keep only last 3
            return updated.slice(-3);
          }
          return prev;
        });
      } else {
        setLocation(null);
        setLocationExists(false);
        setLocationHistory([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error getting bus location:", error);
      setLocationExists(false);
      setLoading(false);
      setLocationHistory([]);
    });
    // Clean up listener when component unmounts
    return () => unsubscribe();
  }, [busId]);

  return (
    <div className="bus-location-page page-transition">
      <h2>Bus {busId} – Live Location</h2>
      <div className="route-container">
        <h3>Route Schedule</h3>
        <table className="route-table">
          <colgroup>
            <col style={{ width: '60%' }} />
            <col style={{ width: '40%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Stop</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((route, index) => (
              <tr key={index}>
                <td>{route.stop}</td>
                <td>{route.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="live-location-container">
        <h3>Live Location</h3>
        {loading ? (
          <div className="map-placeholder">
            <p>Loading location data...</p>
          </div>
        ) : !locationExists ? (
          <div className="no-location-message">
            <p>No live location data available for this bus at the moment.</p>
            <p>Please check back later or contact the transportation office.</p>
          </div>
        ) : (
          <>
            <BusLocationMap location={{...location, history: locationHistory}} busId={busId} />
          </>
        )}
      </div>
      <button className="back-btn" onClick={onBack}>
        ⬅ Back to Home
      </button>
    </div>
  );
};

const DriverLogin = ({ onLogin, onBack }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      // Authenticate with Firebase
      await signInWithEmailAndPassword(auth, email, password);
      
      // If we got here, authentication was successful
      onLogin();
    } catch (error) {
      console.error("Error signing in:", error);
      
      switch (error.code) {
        case 'auth/invalid-email':
          setError('Invalid email address format.');
          break;
        case 'auth/user-disabled':
          setError('This account has been disabled.');
          break;
        case 'auth/user-not-found':
          setError('No account found with this email.');
          break;
        case 'auth/wrong-password':
          setError('Incorrect password.');
          break;
        default:
          setError('Failed to sign in. Please try again.');
          break;
      }
    }
    
    setLoading(false);
  };

  return (
    <div className="login-page-center-wrapper">
      <div className="login-container page-transition">
        <h2>Driver Login</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>
        <button className="back-btn" style={{marginTop: '1rem'}} onClick={onBack}>
          ⬅ Back to Home
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const [page, setPage] = useState("home");
  const [selectedBusId, setSelectedBusId] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is already logged in
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
      if (user) {
        setPage("driverDashboard"); // Redirect to dashboard if authenticated
      } else {
        setPage("home"); // Go to home if not authenticated
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSeeLiveLocation = (busId) => {
    setSelectedBusId(busId);
    setPage("busLocation");
  };

  const handleBackToHome = () => {
    setPage("home");
  };

  const handleLogin = () => {
    setPage("driverDashboard");
  };

  const handleDriverLogin = () => {
    setPage("login");
  };

  const handleLogout = () => {
    auth.signOut()
      .then(() => {
        setIsAuthenticated(false);
        setPage("home");
      })
      .catch((error) => {
        console.error("Error signing out:", error);
      });
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="app-title">College Bus Tracker</h1>
        {page !== "driverDashboard" ? (
          <button className="btn btn-outline login-btn" onClick={handleDriverLogin}>
            Driver Login
          </button>
        ) : (
          <button className="btn btn-outline logout-btn" onClick={handleLogout}>
            Logout
          </button>
        )}
      </header>

      <main className="content-container">
        {page === "home" && <Home onSeeLiveLocation={handleSeeLiveLocation} />}
        {page === "busLocation" && (
          <BusLocationPage busId={selectedBusId} onBack={handleBackToHome} />
        )}
        {page === "login" && <DriverLogin onLogin={handleLogin} onBack={handleBackToHome} />}
        {page === "driverDashboard" && <DriverDashboard onLogout={handleLogout} />}
      </main>

      <footer className="footer">
        <p>&copy; 2025 College Bus Tracker | All rights reserved.</p>
      </footer>
    </div>
  );
}