import { useState, Component } from "react";
import Dashboard from "./Dashboard.jsx";
import ParkingMap from "./ParkingMap.jsx";
import History from "./History.jsx";
import Forecast from "./Forecast.jsx";

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e?.message || "Unknown error" }; }
  render() {
    if (this.state.error) return (
      <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "monospace" }}>
        <div style={{ background: "#1e293b", borderRadius: 16, padding: 32, maxWidth: 400, border: "1px solid #ef444433" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ color: "#ef4444", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>App Error</div>
          <div style={{ color: "#64748b", fontSize: 12, marginBottom: 20 }}>{this.state.error}</div>
          <button onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontFamily: "monospace", fontSize: 12 }}>
            Clear Cache &amp; Reload
          </button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [selectedSpot, setSelectedSpot] = useState(null);

  return (
    <ErrorBoundary>
      <div>
        {page === "dashboard"  && <Dashboard onViewMap={() => setPage("map")} onViewHistory={() => setPage("history")} onViewForecast={() => setPage("forecast")} />}
        {page === "map"        && <ParkingMap onBack={() => setPage("dashboard")} selectedSpot={selectedSpot} setSelectedSpot={setSelectedSpot} />}
        {page === "history"    && <History onBack={() => setPage("dashboard")} />}
        {page === "forecast"   && <Forecast onBack={() => setPage("dashboard")} />}
      </div>
    </ErrorBoundary>
  );
}
