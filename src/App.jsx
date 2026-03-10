import { useState } from "react";
import Dashboard from "./Dashboard.jsx";
import ParkingMap from "./ParkingMap.jsx";

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [selectedSpot, setSelectedSpot] = useState(null);

  return (
    <div>
      {page === "dashboard" && (
        <Dashboard onViewMap={() => setPage("map")} />
      )}
      {page === "map" && (
        <ParkingMap
          onBack={() => setPage("dashboard")}
          selectedSpot={selectedSpot}
          setSelectedSpot={setSelectedSpot}
        />
      )}
    </div>
  );
}
