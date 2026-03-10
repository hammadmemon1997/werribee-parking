import { useState } from "react";
import Dashboard from "./Dashboard.jsx";
import ParkingMap from "./ParkingMap.jsx";
import History from "./History.jsx";
import Forecast from "./Forecast.jsx";

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [selectedSpot, setSelectedSpot] = useState(null);

  return (
    <div>
      {page === "dashboard"  && <Dashboard onViewMap={() => setPage("map")} onViewHistory={() => setPage("history")} onViewForecast={() => setPage("forecast")} />}
      {page === "map"        && <ParkingMap onBack={() => setPage("dashboard")} selectedSpot={selectedSpot} setSelectedSpot={setSelectedSpot} />}
      {page === "history"    && <History onBack={() => setPage("dashboard")} />}
      {page === "forecast"   && <Forecast onBack={() => setPage("dashboard")} />}
    </div>
  );
}
