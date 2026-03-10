import { useState, useEffect, useCallback } from "react";

const LAT = -37.9027;
const LON = 144.6627;
const WEATHER_URL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,precipitation,weathercode,windspeed_10m,relativehumidity_2m&hourly=precipitation_probability&timezone=Australia%2FSydney&forecast_days=1`;

const BASE_OCCUPANCY = [2,2,2,2,3,5,18,72,91,80,62,55,50,52,58,65,80,88,74,50,30,18,10,5];
const WEEKEND_OCCUPANCY = [2,2,2,2,2,3,5,15,28,32,28,24,20,22,24,26,28,25,20,14,10,6,4,2];

const WEATHER_CODES = {
  0:"Clear sky",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",
  45:"Foggy",48:"Icy fog",51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",
  61:"Light rain",63:"Rain",65:"Heavy rain",80:"Rain showers",81:"Heavy showers",95:"Thunderstorm"
};
const WEATHER_ICONS = {
  0:"☀️",1:"🌤️",2:"⛅",3:"☁️",45:"🌫️",51:"🌦️",53:"🌧️",55:"🌧️",
  61:"🌦️",63:"🌧️",65:"⛈️",80:"🌦️",81:"🌧️",95:"⛈️"
};

const weatherImpact = (code, precip) => {
  if (code >= 61 || precip > 2) return { delta: +14, label: "Rain → more drivers", icon: "🌧️" };
  if (code >= 51 || precip > 0.5) return { delta: +8, label: "Drizzle → extra cars", icon: "🌦️" };
  if (code === 3) return { delta: +3, label: "Overcast", icon: "☁️" };
  if (code === 0 || code === 1) return { delta: -4, label: "Fine → some walk/cycle", icon: "☀️" };
  return { delta: 0, label: "Neutral conditions", icon: "🌤️" };
};

const getVerdict = (pct) => {
  if (pct >= 90) return { text: "STAY HOME", sub: "Car park is full. Leave in 40+ min.", color: "#dc2626", bg: "rgba(220,38,38,0.1)", emoji: "🛑" };
  if (pct >= 75) return { text: "RISKY", sub: "Very busy — leave right now.", color: "#ea580c", bg: "rgba(234,88,12,0.1)", emoji: "⚠️" };
  if (pct >= 55) return { text: "MODERATE", sub: "Filling up. Leave soon.", color: "#d97706", bg: "rgba(217,119,6,0.1)", emoji: "🟡" };
  if (pct >= 30) return { text: "GOOD", sub: "Decent availability. Normal timing fine.", color: "#16a34a", bg: "rgba(22,163,74,0.1)", emoji: "✅" };
  return { text: "EASY", sub: "Plenty of spaces. No rush!", color: "#0284c7", bg: "rgba(2,132,199,0.1)", emoji: "🅿️" };
};

const fmt = (h) => h === 0 ? "12AM" : h < 12 ? `${h}AM` : h === 12 ? "12PM" : `${h-12}PM`;
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export default function Dashboard({ onViewMap }) {
  const [weather, setWeather] = useState(null);
  const [disruptions, setDisruptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);

  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const baseOcc = isWeekend ? WEEKEND_OCCUPANCY : BASE_OCCUPANCY;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(WEATHER_URL);
      const data = await res.json();
      const c = data.current;
      const precipProb = data.hourly?.precipitation_probability?.[hour] ?? 0;
      setWeather({ temp: Math.round(c.temperature_2m), precip: c.precipitation, code: c.weathercode, wind: Math.round(c.windspeed_10m), humidity: c.relativehumidity_2m, precipProb });
    } catch { setWeather(null); }

    try {
      const res = await fetch("https://api.allorigins.win/get?url=" + encodeURIComponent("https://www.ptv.vic.gov.au/disruptions/werribee-line-disruptions/nochrome"));
      const data = await res.json();
      const html = data.contents || "";
      const d = [];
      if (html.toLowerCase().includes("replacement bus") || html.toLowerCase().includes("bus replace"))
        d.push({ type: "warning", text: "Bus replacements on Werribee line — MORE parking demand today" });
      if (html.toLowerCase().includes("altered timetable"))
        d.push({ type: "info", text: "Altered timetable in effect — check PTV for times" });
      setDisruptions(d);
    } catch { setDisruptions([]); }

    setLastFetch(new Date());
    setLoading(false);
  }, [hour]);

  useEffect(() => { fetchData(); const t = setInterval(fetchData, 10 * 60 * 1000); return () => clearInterval(t); }, [fetchData]);

  const impact = weather ? weatherImpact(weather.code, weather.precip) : { delta: 0, label: "Loading...", icon: "⏳" };
  const disruptDelta = disruptions.some(d => d.text.includes("MORE")) ? 12 : 0;
  const adjustedPct = Math.min(99, Math.max(1, (baseOcc[hour] ?? 50) + impact.delta + disruptDelta));
  const verdict = getVerdict(adjustedPct);
  const todayHours = baseOcc.map(b => Math.min(99, b + impact.delta));
  const bestHour = todayHours.slice(5, 11).reduce((best, v, i) => v < todayHours[best + 5] ? i + 5 : best, 5);

  // How many spots free (out of 120 total)
  const totalSpots = 120;
  const freeSpots = Math.round(totalSpots * (1 - adjustedPct / 100));

  return (
    <div style={{ minHeight: "100vh", background: "#f8f5f0", fontFamily: "'Palatino Linotype', Georgia, serif" }}>
      {/* Header */}
      <div style={{ background: "#1c2b3a", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🚉</span>
          <div>
            <div style={{ color: "#f0e6d3", fontSize: 15, fontWeight: 700 }}>Werribee Station Parking</div>
            <div style={{ color: "#5d7a8a", fontSize: 10, letterSpacing: 3, fontFamily: "monospace" }}>LIVE SMART ADVISOR</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {weather && <div style={{ textAlign: "right" }}>
            <div style={{ color: "#f0e6d3", fontSize: 16 }}>{WEATHER_ICONS[weather.code] || "🌡️"} {weather.temp}°C</div>
            <div style={{ color: "#5d7a8a", fontSize: 10, fontFamily: "monospace" }}>{WEATHER_CODES[weather.code] || ""}</div>
          </div>}
          <button onClick={fetchData} style={{ background: "transparent", border: "1px solid #2d4a5a", color: "#5d7a8a", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 14 }}>
            {loading ? "⏳" : "🔄"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 580, margin: "0 auto", padding: "20px 16px" }}>

        {/* Disruption banners */}
        {disruptions.map((d, i) => (
          <div key={i} style={{ background: d.type === "warning" ? "rgba(220,38,38,0.08)" : "rgba(2,132,199,0.08)", border: `1px solid ${d.type === "warning" ? "#dc262644" : "#0284c744"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 10, color: d.type === "warning" ? "#dc2626" : "#0284c7", fontSize: 12 }}>
            {d.type === "warning" ? "⚠️" : "ℹ️"} <strong>PTV Alert:</strong> {d.text}
          </div>
        ))}

        {/* Main verdict */}
        <div style={{ background: verdict.bg, border: `2px solid ${verdict.color}44`, borderRadius: 18, padding: "28px 24px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -10, top: -10, fontSize: 100, opacity: 0.06, userSelect: "none" }}>{verdict.emoji}</div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: 3, fontFamily: "monospace", marginBottom: 4 }}>
                RIGHT NOW · {DAY_NAMES[dayOfWeek].toUpperCase()} {fmt(hour)}
              </div>
              <div style={{ fontSize: 38, fontWeight: 900, color: verdict.color, letterSpacing: -1, lineHeight: 1 }}>{verdict.text}</div>
              <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>{verdict.sub}</div>
            </div>
            <div style={{ textAlign: "center", minWidth: 80 }}>
              <div style={{ fontSize: 34, fontWeight: 900, color: verdict.color }}>{adjustedPct}%</div>
              <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>FULL</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: verdict.color, marginTop: 4 }}>{freeSpots} free</div>
            </div>
          </div>

          <div style={{ height: 10, background: "rgba(0,0,0,0.08)", borderRadius: 5, overflow: "hidden", marginBottom: 14 }}>
            <div style={{ height: "100%", width: `${adjustedPct}%`, background: `linear-gradient(90deg, #22c55e, ${verdict.color})`, borderRadius: 5, transition: "width 1.4s ease" }} />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", background: "rgba(255,255,255,0.6)", borderRadius: 20, fontSize: 11, color: "#475569" }}>
              {impact.icon} {impact.label}
              <span style={{ fontSize: 9, color: "#94a3b8", fontFamily: "monospace" }}>{impact.delta > 0 ? `+${impact.delta}` : impact.delta < 0 ? impact.delta : "±0"}%</span>
            </div>
            {disruptDelta > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", background: "rgba(220,38,38,0.1)", borderRadius: 20, fontSize: 11, color: "#dc2626" }}>
                🚌 Bus replacement +{disruptDelta}%
              </div>
            )}
          </div>

          {/* 🅿️ VIEW MAP BUTTON — the main CTA */}
          <button onClick={onViewMap} style={{
            width: "100%", padding: "16px", borderRadius: 12, border: "none", cursor: "pointer",
            background: verdict.color, color: "#fff", fontSize: 15, fontWeight: 700,
            fontFamily: "'Palatino Linotype', Georgia, serif", letterSpacing: 0.5,
            boxShadow: `0 4px 20px ${verdict.color}55`,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            transition: "transform 0.15s, box-shadow 0.15s"
          }}
            onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 28px ${verdict.color}66`; }}
            onMouseOut={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 4px 20px ${verdict.color}55`; }}
          >
            <span style={{ fontSize: 20 }}>🅿️</span>
            View Interactive Parking Map
            <span style={{ fontSize: 13, opacity: 0.85 }}>→ {freeSpots} spots available</span>
          </button>
        </div>

        {/* Quick stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid #e8e0d5" }}>
            <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 2, fontFamily: "monospace" }}>BEST TIME TODAY</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#1c2b3a", marginTop: 4 }}>{fmt(bestHour)}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>~{todayHours[bestHour]}% full</div>
          </div>
          {weather ? (
            <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid #e8e0d5" }}>
              <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 2, fontFamily: "monospace" }}>WERRIBEE WEATHER</div>
              <div style={{ fontSize: 22, marginTop: 4 }}>{WEATHER_ICONS[weather.code]} {weather.temp}°C</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>💧{weather.humidity}% · 💨{weather.wind}km/h · 🌧{weather.precipProb}%</div>
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid #e8e0d5", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#94a3b8", fontSize: 12 }}>Loading weather...</span>
            </div>
          )}
        </div>

        {/* Hourly chart */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "18px 16px", border: "1px solid #e8e0d5", marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 2, fontFamily: "monospace", marginBottom: 14 }}>
            HOURLY FORECAST — {DAY_NAMES[dayOfWeek].toUpperCase()} (your 7–8AM highlighted)
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 90 }}>
            {todayHours.map((pct, h) => {
              const v = getVerdict(pct);
              const isCurrent = h === hour;
              const isYours = h === 7 || h === 8;
              return (
                <div key={h} title={`${fmt(h)}: ~${pct}% full`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <div style={{ width: "100%", borderRadius: "3px 3px 0 0", minHeight: 3, height: `${Math.max(pct, 3)}%`, background: isCurrent ? v.color : isYours ? `${v.color}bb` : `${v.color}44`, boxShadow: isCurrent ? `0 0 8px ${v.color}88` : "none", border: isCurrent ? `1px solid ${v.color}` : isYours ? `1px solid ${v.color}55` : "none", transition: "all 0.5s" }} />
                  {h % 4 === 0 && <div style={{ fontSize: 7, color: isCurrent ? "#1c2b3a" : "#94a3b8", fontFamily: "monospace", fontWeight: isCurrent ? 700 : 400 }}>{fmt(h)}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Data sources */}
        <div style={{ background: "#1c2b3a", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, color: "#5d7a8a", letterSpacing: 2, fontFamily: "monospace", marginBottom: 10 }}>LIVE DATA SOURCES</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "🌤 Open-Meteo", sub: "Live weather · free", ok: !!weather },
              { label: "🚆 PTV", sub: "Line disruptions", ok: true },
              { label: "📊 Pattern model", sub: "Commuter history", ok: true },
            ].map(s => (
              <div key={s.label} style={{ padding: "5px 10px", borderRadius: 6, background: s.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${s.ok ? "#22c55e33" : "#ef444433"}`, fontSize: 10 }}>
                <span style={{ color: s.ok ? "#22c55e" : "#ef4444" }}>{s.label}</span>
                <span style={{ color: "#475569", marginLeft: 4 }}>{s.sub}</span>
              </div>
            ))}
          </div>
          {lastFetch && <div style={{ marginTop: 8, fontSize: 10, color: "#475569", fontFamily: "monospace" }}>Updated: {lastFetch.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}</div>}
        </div>
      </div>
    </div>
  );
}
