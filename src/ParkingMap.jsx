import { useState, useEffect, useRef } from "react";

// Werribee Station car park layout — based on real station layout
// 120 spots across 4 zones (A near entrance, D near platform)
// Spot types: standard, accessible, ev, reserved
const generateSpots = (occupancyPct) => {
  const zones = [
    { id: "A", label: "Zone A", desc: "Near Entrance", rows: 3, cols: 10, baseOcc: occupancyPct + 10 },
    { id: "B", label: "Zone B", desc: "Central",       rows: 3, cols: 10, baseOcc: occupancyPct + 5  },
    { id: "C", label: "Zone C", desc: "Mid Car Park",  rows: 3, cols: 10, baseOcc: occupancyPct      },
    { id: "D", label: "Zone D", desc: "Near Platform", rows: 3, cols: 10, baseOcc: occupancyPct - 8  },
  ];

  const spots = [];
  zones.forEach(zone => {
    for (let row = 0; row < zone.rows; row++) {
      for (let col = 0; col < zone.cols; col++) {
        const num = row * zone.cols + col + 1;
        const id = `${zone.id}${String(num).padStart(2, "0")}`;
        // Special spots
        const isAccessible = zone.id === "D" && num <= 4;
        const isEV = zone.id === "D" && (num === 5 || num === 6);
        const isReserved = zone.id === "A" && num <= 3;
        // Occupancy probability
        const occ = Math.max(0, Math.min(98, zone.baseOcc));
        const occupied = !isAccessible && !isEV && !isReserved
          ? Math.random() * 100 < occ
          : Math.random() * 100 < (occ * 0.5); // special spots fill more slowly
        spots.push({
          id, zone: zone.id, row, col, num,
          occupied: isReserved ? false : occupied,
          type: isAccessible ? "accessible" : isEV ? "ev" : isReserved ? "reserved" : "standard",
          lastChanged: Date.now() - Math.floor(Math.random() * 1800000),
        });
      }
    }
  });
  return spots;
};

const ZONE_COLORS = { A: "#6366f1", B: "#0ea5e9", C: "#10b981", D: "#f59e0b" };
const ZONE_DESC = { A: "Near Entrance / Manly St", B: "Central Bay", C: "Mid Car Park", D: "Closest to Platform" };

// Walking time from each zone to the platform
const ZONE_WALK = {
  A: { mins: "5-7", steps: "~380", path: "Exit via Manly St gate → walk along southern path → platform entry", color: "#ef4444" },
  B: { mins: "4-5", steps: "~300", path: "Head south through central walkway → platform gates", color: "#f59e0b" },
  C: { mins: "2-4", steps: "~200", path: "Short cut through mid path → straight to platform", color: "#16a34a" },
  D: { mins: "1-2", steps: "~80",  path: "Zone D is adjacent to platform — 30 sec walk!", color: "#0284c7" },
};

const TYPE_INFO = {
  standard:   { label: "Standard",   icon: "🚗", color: "#64748b" },
  accessible: { label: "Accessible", icon: "♿", color: "#8b5cf6" },
  ev:         { label: "EV Charging",icon: "⚡", color: "#0ea5e9" },
  reserved:   { label: "Reserved",   icon: "🔒", color: "#f59e0b" },
};

const timeAgo = (ms) => {
  const diff = Date.now() - ms;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
};

// Google Maps directions to a specific spot area
const getGoogleMapsUrl = (zone) => {
  // Werribee Station car park coords, slightly offset per zone
  const offsets = { A: [-37.9025, 144.6620], B: [-37.9027, 144.6624], C: [-37.9029, 144.6627], D: [-37.9031, 144.6630] };
  const [lat, lon] = offsets[zone] || [-37.9027, 144.6627];
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
};

export default function ParkingMap({ onBack }) {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const BASE_OCCUPANCY = [2,2,2,2,3,5,18,72,91,80,62,55,50,52,58,65,80,88,74,50,30,18,10,5];
  const WEEKEND_OCC = [2,2,2,2,2,3,5,15,28,32,28,24,20,22,24,26,28,25,20,14,10,6,4,2];
  const baseOcc = (isWeekend ? WEEKEND_OCC : BASE_OCCUPANCY)[hour] ?? 55;

  const [spots, setSpots] = useState(() => generateSpots(baseOcc));
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [filterZone, setFilterZone] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");
  const [filterFree, setFilterFree] = useState(false);
  const [lastSync, setLastSync] = useState(Date.now());
  const [syncing, setSyncing] = useState(false);
  const [showToast, setShowToast] = useState(null);
  const intervalRef = useRef(null);

  // Simulate live updates — a few spots change every 12 seconds
  const liveUpdate = () => {
    setSyncing(true);
    setTimeout(() => {
      setSpots(prev => prev.map(s => {
        if (s.type === "reserved") return s;
        if (Math.random() < 0.025) {
          return { ...s, occupied: !s.occupied, lastChanged: Date.now() };
        }
        return s;
      }));
      setLastSync(Date.now());
      setSyncing(false);
    }, 700);
  };

  useEffect(() => {
    intervalRef.current = setInterval(liveUpdate, 12000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Filter spots
  const filtered = spots.filter(s => {
    if (filterZone !== "ALL" && s.zone !== filterZone) return false;
    if (filterType !== "ALL" && s.type !== filterType) return false;
    if (filterFree && s.occupied) return false;
    return true;
  });

  // Stats per zone
  const zoneStats = ["A","B","C","D"].map(z => {
    const zs = spots.filter(s => s.zone === z);
    const free = zs.filter(s => !s.occupied).length;
    return { zone: z, free, total: zs.length, pct: Math.round((zs.filter(s => s.occupied).length / zs.length) * 100) };
  });

  const totalFree = spots.filter(s => !s.occupied).length;
  const totalSpots = spots.length;

  const handleSpotClick = (spot) => {
    setSelectedSpot(spot);
  };

  const handleNavigate = (zone) => {
    const url = getGoogleMapsUrl(zone);
    window.open(url, "_blank");
    setShowToast(`Opening Google Maps for Zone ${zone}...`);
    setTimeout(() => setShowToast(null), 3000);
  };

  const spotColor = (spot) => {
    if (spot.type === "reserved") return { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" };
    if (spot.type === "accessible") return spot.occupied ? { bg: "#ede9fe", border: "#8b5cf688", text: "#5b21b6" } : { bg: "#ddd6fe", border: "#8b5cf6", text: "#4c1d95" };
    if (spot.type === "ev") return spot.occupied ? { bg: "#e0f2fe", border: "#0ea5e966", text: "#0c4a6e" } : { bg: "#bae6fd", border: "#0ea5e9", text: "#0c4a6e" };
    return spot.occupied ? { bg: "#fee2e2", border: "#ef444455", text: "#991b1b" } : { bg: "#dcfce7", border: "#22c55e", text: "#14532d" };
  };

  const groups = ["A","B","C","D"].map(z => ({
    zone: z,
    spots: filtered.filter(s => s.zone === z),
    stat: zoneStats.find(st => st.zone === z),
  })).filter(g => filterZone === "ALL" || g.zone === filterZone);

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", fontFamily: "'Palatino Linotype', Georgia, serif", color: "#e2e8f0" }}>

      {/* Toast */}
      {showToast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#22c55e", color: "#fff", padding: "10px 20px", borderRadius: 8, zIndex: 1000, fontFamily: "monospace", fontSize: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
          {showToast}
        </div>
      )}

      {/* Header */}
      <div style={{ background: "#1e293b", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 100, borderBottom: "1px solid #334155" }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid #334155", color: "#94a3b8", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>Werribee Station — Car Park Map</div>
          <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", letterSpacing: 2 }}>
            {syncing ? "SYNCING..." : `LIVE · ${timeAgo(lastSync)}`}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#22c55e" }}>{totalFree}</div>
          <div style={{ fontSize: 9, color: "#475569", fontFamily: "monospace" }}>FREE / {totalSpots}</div>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px" }}>

        {/* Zone summary cards — clickable */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
          {zoneStats.map(z => {
            const col = ZONE_COLORS[z.zone];
            const isActive = filterZone === z.zone;
            return (
              <button key={z.zone} onClick={() => setFilterZone(filterZone === z.zone ? "ALL" : z.zone)}
                style={{ background: isActive ? `${col}22` : "rgba(30,41,59,0.8)", border: `1px solid ${isActive ? col : "#334155"}`, borderRadius: 10, padding: "12px 8px", cursor: "pointer", color: "#e2e8f0", textAlign: "center", transition: "all 0.2s" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: col, letterSpacing: 1 }}>ZONE {z.zone}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: z.free === 0 ? "#ef4444" : "#f1f5f9", margin: "4px 0" }}>{z.free}</div>
                <div style={{ fontSize: 9, color: "#475569", fontFamily: "monospace" }}>FREE</div>
                <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: "#1e293b", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${z.pct}%`, background: z.pct > 85 ? "#ef4444" : z.pct > 65 ? "#f59e0b" : "#22c55e", transition: "width 1s" }} />
                </div>
                <div style={{ fontSize: 9, color: "#475569", fontFamily: "monospace", marginTop: 3 }}>{z.pct}% full</div>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {["ALL","accessible","ev","standard"].map(t => (
              <button key={t} onClick={() => setFilterType(t)} style={{
                padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11,
                background: filterType === t ? "#3b82f6" : "rgba(30,41,59,0.8)",
                color: filterType === t ? "#fff" : "#64748b",
                border: `1px solid ${filterType === t ? "#3b82f6" : "#334155"}`,
                transition: "all 0.2s"
              }}>
                {t === "ALL" ? "All Types" : TYPE_INFO[t]?.icon + " " + TYPE_INFO[t]?.label}
              </button>
            ))}
          </div>
          <button onClick={() => setFilterFree(!filterFree)} style={{
            padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 11,
            background: filterFree ? "rgba(34,197,94,0.2)" : "rgba(30,41,59,0.8)",
            color: filterFree ? "#22c55e" : "#64748b",
            border: `1px solid ${filterFree ? "#22c55e55" : "#334155"}`,
            transition: "all 0.2s"
          }}>
            {filterFree ? "✅ Free only" : "Show free only"}
          </button>
          <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", marginLeft: "auto" }}>
            {filtered.filter(s => !s.occupied).length} free shown
          </div>
        </div>

        {/* Parking grid zones */}
        {groups.map(g => (
          <div key={g.zone} style={{ background: "rgba(30,41,59,0.5)", border: `1px solid ${ZONE_COLORS[g.zone]}33`, borderRadius: 14, padding: "16px", marginBottom: 14 }}>
            {/* Zone header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: ZONE_COLORS[g.zone], boxShadow: `0 0 8px ${ZONE_COLORS[g.zone]}` }} />
                  <span style={{ fontSize: 15, fontWeight: 800, color: ZONE_COLORS[g.zone] }}>Zone {g.zone}</span>
                  <span style={{ fontSize: 11, color: "#475569" }}>— {ZONE_DESC[g.zone]}</span>
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, marginLeft: 18 }}>
                  {g.stat?.free} of {g.stat?.total} spaces free
                </div>
              </div>
              {/* Navigate to zone button */}
              <button onClick={() => handleNavigate(g.zone)} style={{
                padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                background: ZONE_COLORS[g.zone], color: "#fff", fontSize: 12,
                fontFamily: "inherit", fontWeight: 700, display: "flex", alignItems: "center", gap: 6,
                boxShadow: `0 2px 12px ${ZONE_COLORS[g.zone]}55`, transition: "transform 0.15s"
              }}
                onMouseOver={e => e.currentTarget.style.transform = "scale(1.05)"}
                onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
              >
                📍 Navigate Here
              </button>
            </div>

            {/* Spot grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4 }}>
              {g.spots.map(spot => {
                const c = spotColor(spot);
                const isSelected = selectedSpot?.id === spot.id;
                return (
                  <button key={spot.id}
                    onClick={() => handleSpotClick(selectedSpot?.id === spot.id ? null : spot)}
                    title={`${spot.id} · ${spot.occupied ? "Occupied" : "Free"} · ${TYPE_INFO[spot.type].label}`}
                    style={{
                      height: 32, borderRadius: 4, border: `1.5px solid ${isSelected ? "#f1f5f9" : c.border}`,
                      background: c.bg, cursor: "pointer", fontSize: 7, color: c.text,
                      fontFamily: "monospace", fontWeight: 700, letterSpacing: 0.3,
                      boxShadow: isSelected ? "0 0 0 2px #f1f5f9" : "none",
                      transition: "all 0.2s", display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", gap: 1, padding: 0,
                      outline: "none"
                    }}>
                    <span style={{ fontSize: 9 }}>
                      {spot.type === "accessible" ? "♿" : spot.type === "ev" ? "⚡" : spot.type === "reserved" ? "🔒" : spot.occupied ? "🚗" : ""}
                    </span>
                    <span>{spot.id}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Selected spot detail panel */}
        {selectedSpot && (
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            background: "#1e293b", borderTop: "2px solid #334155",
            padding: "20px 20px 28px", zIndex: 200,
            boxShadow: "0 -8px 32px rgba(0,0,0,0.5)"
          }}>
            <div style={{ maxWidth: 700, margin: "0 auto", display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 28, lineHeight: 1 }}>{TYPE_INFO[selectedSpot.type].icon}</div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9" }}>Spot {selectedSpot.id}</div>
                    <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
                      {TYPE_INFO[selectedSpot.type].label} · Zone {selectedSpot.zone} · {ZONE_DESC[selectedSpot.zone]}
                    </div>
                  </div>
                  <div style={{
                    marginLeft: "auto", padding: "6px 14px", borderRadius: 20,
                    background: selectedSpot.occupied ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
                    color: selectedSpot.occupied ? "#ef4444" : "#22c55e",
                    border: `1px solid ${selectedSpot.occupied ? "#ef444444" : "#22c55e44"}`,
                    fontSize: 12, fontWeight: 700
                  }}>
                    {selectedSpot.occupied ? "🚗 Occupied" : "✅ Free"}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#475569", fontFamily: "monospace" }}>
                  Status changed: {timeAgo(selectedSpot.lastChanged)}
                </div>
                {/* Walking path to platform */}
                {ZONE_WALK[selectedSpot.zone] && (
                  <div style={{ marginTop: 10, background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, fontFamily: "monospace", marginBottom: 4 }}>🚶 WALK TO PLATFORM</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: ZONE_WALK[selectedSpot.zone].color }}>{ZONE_WALK[selectedSpot.zone].mins} min</span>
                      <span style={{ fontSize: 11, color: "#64748b" }}>{ZONE_WALK[selectedSpot.zone].steps} steps</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>{ZONE_WALK[selectedSpot.zone].path}</div>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {!selectedSpot.occupied && (
                  <button onClick={() => handleNavigate(selectedSpot.zone)} style={{
                    padding: "12px 20px", borderRadius: 10, border: "none", cursor: "pointer",
                    background: "#22c55e", color: "#fff", fontWeight: 700, fontSize: 13,
                    fontFamily: "inherit", whiteSpace: "nowrap",
                    boxShadow: "0 4px 16px rgba(34,197,94,0.4)"
                  }}>
                    📍 Navigate to Zone {selectedSpot.zone}
                  </button>
                )}
                <button onClick={() => setSelectedSpot(null)} style={{
                  padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)",
                  border: "1px solid #334155", color: "#64748b", cursor: "pointer", fontSize: 13
                }}>✕</button>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{ background: "rgba(30,41,59,0.5)", borderRadius: 12, padding: "14px 16px", border: "1px solid #334155" }}>
          <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, fontFamily: "monospace", marginBottom: 10 }}>LEGEND</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { color: "#dcfce7", border: "#22c55e", label: "Free standard spot" },
              { color: "#fee2e2", border: "#ef4444", label: "Occupied spot" },
              { color: "#ddd6fe", border: "#8b5cf6", label: "♿ Accessible" },
              { color: "#bae6fd", border: "#0ea5e9", label: "⚡ EV Charging" },
              { color: "#fef3c7", border: "#f59e0b", label: "🔒 Reserved (free)" },
            ].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 20, height: 14, borderRadius: 3, background: l.color, border: `1.5px solid ${l.border}`, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "#64748b" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 12, textAlign: "center", fontSize: 10, color: "#334155", fontFamily: "monospace", paddingBottom: selectedSpot ? 100 : 0 }}>
          SIMULATED LIVE DATA · UPDATES EVERY 12 SECONDS · NAVIGATE OPENS GOOGLE MAPS
        </div>
      </div>
    </div>
  );
}
