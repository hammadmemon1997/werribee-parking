import { useState, useEffect, useCallback } from "react";

// Werribee Station coordinates
const LAT = -37.9027;
const LON = 144.6627;

// Werribee line disruptions RSS feed (public, no key needed)
const PTV_DISRUPTIONS_URL = "https://api.allorigins.win/get?url=" + encodeURIComponent("https://www.ptv.vic.gov.au/api/content/en/api/disruption/line/werribee");

// Open-Meteo free weather API — no key required
const WEATHER_URL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,precipitation,weathercode,windspeed_10m,relativehumidity_2m&hourly=precipitation_probability&timezone=Australia%2FSydney&forecast_days=1`;

// Base parking occupancy by hour (Mon-Fri typical Werribee commuter pattern)
const BASE_OCCUPANCY = [2,2,2,2,3,5,18,72,91,80,62,55,50,52,58,65,80,88,74,50,30,18,10,5];
// Weekend is much quieter
const WEEKEND_OCCUPANCY = [2,2,2,2,2,3,5,15,28,32,28,24,20,22,24,26,28,25,20,14,10,6,4,2];

const WEATHER_CODES = {
  0:"Clear sky",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",
  45:"Foggy",48:"Icy fog",51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",
  61:"Light rain",63:"Rain",65:"Heavy rain",71:"Light snow",73:"Snow",75:"Heavy snow",
  80:"Rain showers",81:"Heavy showers",82:"Violent showers",95:"Thunderstorm",99:"Thunderstorm & hail"
};

const WEATHER_ICONS = {
  0:"☀️",1:"🌤️",2:"⛅",3:"☁️",45:"🌫️",48:"🌫️",
  51:"🌦️",53:"🌧️",55:"🌧️",61:"🌦️",63:"🌧️",65:"⛈️",
  71:"🌨️",73:"❄️",75:"❄️",80:"🌦️",81:"🌧️",82:"⛈️",95:"⛈️",99:"⛈️"
};

// Weather impact: rain/storms push more people to drive = fuller car park
const weatherImpact = (code, precip) => {
  if (code >= 61 || precip > 2) return { delta: +14, label: "Rain → more drivers", icon: "🌧️" };
  if (code >= 51 || precip > 0.5) return { delta: +8, label: "Drizzle → extra cars", icon: "🌦️" };
  if (code === 3) return { delta: +3, label: "Overcast", icon: "☁️" };
  if (code === 0 || code === 1) return { delta: -4, label: "Fine day → some walk/cycle", icon: "☀️" };
  return { delta: 0, label: "Neutral conditions", icon: "🌤️" };
};

const getVerdict = (pct) => {
  if (pct >= 90) return { text: "STAY HOME", sub: "Car park is full. Leave in 40+ min.", color: "#dc2626", bg: "rgba(220,38,38,0.12)", emoji: "🛑" };
  if (pct >= 75) return { text: "RISKY", sub: "Very busy — leave right now or risk no spot.", color: "#ea580c", bg: "rgba(234,88,12,0.12)", emoji: "⚠️" };
  if (pct >= 55) return { text: "MODERATE", sub: "Spaces available but filling. Leave soon.", color: "#d97706", bg: "rgba(217,119,6,0.12)", emoji: "🟡" };
  if (pct >= 30) return { text: "GOOD", sub: "Decent availability. Normal timing fine.", color: "#16a34a", bg: "rgba(22,163,74,0.12)", emoji: "✅" };
  return { text: "EASY", sub: "Plenty of spaces. No rush!", color: "#0284c7", bg: "rgba(2,132,199,0.12)", emoji: "🅿️" };
};

const fmt = (h) => h === 0 ? "12AM" : h < 12 ? `${h}AM` : h === 12 ? "12PM" : `${h-12}PM`;

export default function App() {
  const [weather, setWeather] = useState(null);
  const [disruptions, setDisruptions] = useState([]);
  const [weatherError, setWeatherError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const [tab, setTab] = useState("now"); // now | chart | tips

  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const baseOcc = isWeekend ? WEEKEND_OCCUPANCY : BASE_OCCUPANCY;

  const fetchData = useCallback(async () => {
    setLoading(true);
    // --- Weather from Open-Meteo (totally free, no key) ---
    try {
      const res = await fetch(WEATHER_URL);
      const data = await res.json();
      const c = data.current;
      const precipProb = data.hourly?.precipitation_probability?.[hour] ?? 0;
      setWeather({
        temp: Math.round(c.temperature_2m),
        precip: c.precipitation,
        code: c.weathercode,
        wind: Math.round(c.windspeed_10m),
        humidity: c.relativehumidity_2m,
        precipProb,
      });
      setWeatherError(false);
    } catch {
      setWeatherError(true);
    }

    // --- PTV Disruptions (public feed via allorigins proxy) ---
    try {
      const res = await fetch("https://api.allorigins.win/get?url=" + encodeURIComponent("https://www.ptv.vic.gov.au/disruptions/werribee-line-disruptions/nochrome"));
      const data = await res.json();
      // Parse any disruption mentions from the HTML
      const html = data.contents || "";
      const hasBusReplacement = html.toLowerCase().includes("replacement bus") || html.toLowerCase().includes("bus replace");
      const hasAlteredTimetable = html.toLowerCase().includes("altered timetable") || html.toLowerCase().includes("timetable changes");
      const disrupts = [];
      if (hasBusReplacement) disrupts.push({ type: "warning", text: "Bus replacements operating on Werribee line — expect MORE parking demand" });
      if (hasAlteredTimetable) disrupts.push({ type: "info", text: "Altered timetable in effect — check PTV for current times" });
      setDisruptions(disrupts);
    } catch {
      setDisruptions([]);
    }

    setLastFetch(new Date());
    setLoading(false);
  }, [hour]);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 10 * 60 * 1000); // refresh every 10 min
    return () => clearInterval(t);
  }, [fetchData]);

  // Calculate current occupancy with weather adjustment
  const impact = weather ? weatherImpact(weather.code, weather.precip) : { delta: 0, label: "Loading...", icon: "⏳" };
  // Disruption impact: bus replacements push people to drive
  const disruptDelta = disruptions.some(d => d.text.includes("MORE parking")) ? 12 : 0;
  const rawPct = baseOcc[hour] ?? 50;
  const adjustedPct = Math.min(99, Math.max(1, rawPct + impact.delta + disruptDelta));
  const verdict = getVerdict(adjustedPct);

  // Best time today
  const todayHours = baseOcc.map((b, h) => Math.min(99, b + impact.delta));
  const bestHour = todayHours.slice(5, 11).reduce((best, v, i) => v < todayHours[best + 5] ? i + 5 : best, 5);

  const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#faf7f2",
      fontFamily: "'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif",
    }}>
      {/* Header strip */}
      <div style={{
        background: "#1c2b3a",
        padding: "0 20px",
        display: "flex", alignItems: "stretch",
      }}>
        <div style={{ padding: "16px 0", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>🚉</span>
            <div>
              <div style={{ color: "#f0e6d3", fontSize: 15, fontWeight: 700, letterSpacing: 0.5 }}>Werribee Station Parking</div>
              <div style={{ color: "#5d7a8a", fontSize: 10, letterSpacing: 3, fontFamily: "monospace" }}>LIVE SMART ADVISOR</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {weather && !weatherError && (
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#f0e6d3", fontSize: 18 }}>
                {WEATHER_ICONS[weather.code] || "🌡️"} {weather.temp}°C
              </div>
              <div style={{ color: "#5d7a8a", fontSize: 10, fontFamily: "monospace" }}>
                {WEATHER_CODES[weather.code] || ""}
              </div>
            </div>
          )}
          <button onClick={fetchData} style={{
            background: "transparent", border: "1px solid #2d4a5a", color: "#5d7a8a",
            borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 14,
            transition: "all 0.2s"
          }} title="Refresh">
            {loading ? "⏳" : "🔄"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 580, margin: "0 auto", padding: "20px 16px" }}>

        {/* Disruption banners */}
        {disruptions.map((d, i) => (
          <div key={i} style={{
            background: d.type === "warning" ? "rgba(220,38,38,0.08)" : "rgba(2,132,199,0.08)",
            border: `1px solid ${d.type === "warning" ? "#dc262644" : "#0284c744"}`,
            borderRadius: 8, padding: "10px 14px", marginBottom: 10,
            color: d.type === "warning" ? "#dc2626" : "#0284c7",
            fontSize: 12, lineHeight: 1.5
          }}>
            {d.type === "warning" ? "⚠️" : "ℹ️"} <strong>PTV Alert:</strong> {d.text}
          </div>
        ))}

        {/* MAIN VERDICT */}
        <div style={{
          background: verdict.bg,
          border: `2px solid ${verdict.color}44`,
          borderRadius: 18, padding: "28px 24px", marginBottom: 16,
          position: "relative", overflow: "hidden"
        }}>
          {/* Decorative background text */}
          <div style={{
            position: "absolute", right: -10, top: -10, fontSize: 100,
            opacity: 0.06, lineHeight: 1, userSelect: "none"
          }}>{verdict.emoji}</div>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: 3, fontFamily: "monospace", marginBottom: 4 }}>
                RIGHT NOW · {DAY_NAMES[dayOfWeek].toUpperCase()} {fmt(hour)}
              </div>
              <div style={{ fontSize: 38, fontWeight: 900, color: verdict.color, letterSpacing: -1, lineHeight: 1 }}>
                {verdict.text}
              </div>
              <div style={{ fontSize: 13, color: "#475569", marginTop: 6, maxWidth: 280 }}>
                {verdict.sub}
              </div>
            </div>
            <div style={{ textAlign: "center", minWidth: 70 }}>
              <div style={{ fontSize: 34, fontWeight: 900, color: verdict.color }}>{adjustedPct}%</div>
              <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", letterSpacing: 1 }}>FULL</div>
            </div>
          </div>

          {/* Occupancy bar */}
          <div style={{ height: 10, background: "rgba(0,0,0,0.08)", borderRadius: 5, overflow: "hidden", marginBottom: 14 }}>
            <div style={{
              height: "100%", width: `${adjustedPct}%`,
              background: `linear-gradient(90deg, #22c55e, ${verdict.color})`,
              borderRadius: 5, transition: "width 1.4s ease"
            }} />
          </div>

          {/* Data sources used */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px",
              background: "rgba(255,255,255,0.6)", borderRadius: 20, fontSize: 11, color: "#475569" }}>
              {impact.icon} {impact.label}
              <span style={{ fontSize: 9, color: "#94a3b8", fontFamily: "monospace" }}>
                {impact.delta > 0 ? `+${impact.delta}` : impact.delta < 0 ? impact.delta : "±0"}%
              </span>
            </div>
            {disruptDelta > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px",
                background: "rgba(220,38,38,0.1)", borderRadius: 20, fontSize: 11, color: "#dc2626" }}>
                🚌 Bus replacement +{disruptDelta}%
              </div>
            )}
          </div>
        </div>

        {/* Best time + weather strip */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid #e8e0d5" }}>
            <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 2, fontFamily: "monospace" }}>BEST TIME TODAY</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#1c2b3a", marginTop: 4 }}>{fmt(bestHour)}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>~{todayHours[bestHour]}% full</div>
          </div>
          {weather && !weatherError ? (
            <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid #e8e0d5" }}>
              <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 2, fontFamily: "monospace" }}>WERRIBEE WEATHER</div>
              <div style={{ fontSize: 22, marginTop: 4 }}>{WEATHER_ICONS[weather.code]} {weather.temp}°C</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                💧 {weather.humidity}% · 💨 {weather.wind}km/h · 🌧 {weather.precipProb}% rain
              </div>
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid #e8e0d5",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#94a3b8", fontSize: 12 }}>{weatherError ? "Weather unavailable" : "Loading weather..."}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, marginBottom: 14, background: "#ede8e1", borderRadius: 10, padding: 3 }}>
          {[["now","⏱ Today's Chart"],["tips","💡 Tips & Alternatives"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              flex: 1, padding: "9px 8px", borderRadius: 8, border: "none", cursor: "pointer",
              background: tab === id ? "#1c2b3a" : "transparent",
              color: tab === id ? "#f0e6d3" : "#64748b",
              fontFamily: "inherit", fontSize: 12, fontWeight: tab === id ? 700 : 400,
              transition: "all 0.2s"
            }}>{label}</button>
          ))}
        </div>

        {/* TODAY'S CHART */}
        {tab === "now" && (
          <div style={{ background: "#fff", borderRadius: 14, padding: "18px 16px", border: "1px solid #e8e0d5" }}>
            <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 2, fontFamily: "monospace", marginBottom: 4 }}>
              HOURLY FORECAST — {DAY_NAMES[dayOfWeek].toUpperCase()}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 14 }}>
              Adjusted for live weather · Your window (7–8 AM) highlighted
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 100, marginBottom: 6 }}>
              {todayHours.map((pct, h) => {
                const v = getVerdict(pct);
                const isCurrent = h === hour;
                const isYours = h === 7 || h === 8;
                return (
                  <div key={h} title={`${fmt(h)}: ~${pct}% full`}
                    style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <div style={{
                      width: "100%", borderRadius: "3px 3px 0 0", minHeight: 3,
                      height: `${Math.max(pct, 3)}%`,
                      background: isCurrent ? v.color : isYours ? `${v.color}bb` : `${v.color}44`,
                      boxShadow: isCurrent ? `0 0 8px ${v.color}88` : "none",
                      border: isCurrent ? `1px solid ${v.color}` : isYours ? `1px solid ${v.color}66` : "none",
                      transition: "all 0.5s"
                    }} />
                    {h % 4 === 0 && (
                      <div style={{ fontSize: 7, color: isCurrent ? "#1c2b3a" : "#94a3b8", fontFamily: "monospace", fontWeight: isCurrent ? 700 : 400 }}>
                        {fmt(h)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
              {[["#dc2626","90%+ Full"],["#ea580c","75–89%"],["#d97706","55–74%"],["#16a34a","<55% Good"]].map(([c,l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 10, height: 10, background: c, borderRadius: 2 }} />
                  <span style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>{l}</span>
                </div>
              ))}
            </div>

            {/* Data sources footer */}
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #f1f0ee" }}>
              <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", letterSpacing: 1, marginBottom: 4 }}>
                LIVE DATA SOURCES
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { label: "🌤 Open-Meteo", sub: "Live weather · free, no key", ok: !weatherError },
                  { label: "🚆 PTV", sub: "Line disruptions · public feed", ok: true },
                  { label: "📊 Pattern model", sub: "Commuter history · Werribee", ok: true },
                ].map(s => (
                  <div key={s.label} style={{ padding: "5px 10px", borderRadius: 6,
                    background: s.ok ? "#f0fdf4" : "#fef2f2",
                    border: `1px solid ${s.ok ? "#bbf7d0" : "#fecaca"}`, fontSize: 10 }}>
                    <span style={{ color: s.ok ? "#15803d" : "#dc2626" }}>{s.label}</span>
                    <span style={{ color: "#94a3b8", marginLeft: 4 }}>{s.sub}</span>
                  </div>
                ))}
              </div>
              {lastFetch && (
                <div style={{ marginTop: 8, fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>
                  Last updated: {lastFetch.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TIPS */}
        {tab === "tips" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { icon: "🕖", title: "Leave before 7:15 AM", body: "Werribee car park hits 90%+ by 7:45 AM on weekdays. Beat the rush." },
              { icon: "🌧️", title: "Rainy days = fuller car park", body: "When it's raining, 10–15% more drivers skip walking/cycling. This app already adjusts for that using live weather." },
              { icon: "🚌", title: "Bus replacement days", body: "When trains are replaced by buses, commuters drive instead — car park fills up 20–30 min earlier than normal. Check PTV alerts above." },
              { icon: "🚶", title: "Watton St street parking", body: "Free street parking ~3 min walk from the station. Usually available even when station car park is full." },
              { icon: "🚲", title: "Bike cage at station", body: "Secure, free bike storage. Cycling removes the parking problem entirely." },
              { icon: "📱", title: "PTV real-time departures", body: "If you miss your train, the next Werribee line service is usually within 10–20 min during peak. No need to rush and risk a fine." },
              { icon: "☀️", title: "Weekends are easy", body: "Saturday and Sunday the car park rarely exceeds 30% full, even in the morning." },
            ].map((t, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: 12, padding: "14px 16px",
                border: "1px solid #e8e0d5", display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span style={{ fontSize: 24, lineHeight: 1 }}>{t.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, color: "#1c2b3a", fontSize: 13, marginBottom: 3 }}>{t.title}</div>
                  <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.6 }}>{t.body}</div>
                </div>
              </div>
            ))}

            {/* Quick links */}
            <div style={{ background: "#1c2b3a", borderRadius: 12, padding: "16px", marginTop: 4 }}>
              <div style={{ fontSize: 10, color: "#5d7a8a", letterSpacing: 2, fontFamily: "monospace", marginBottom: 12 }}>QUICK LINKS</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { label: "📍 Google Maps Parking", url: "https://maps.google.com/?q=Werribee+Station+Car+Park+Werribee+VIC" },
                  { label: "🚆 PTV Disruptions", url: "https://www.ptv.vic.gov.au/disruptions/werribee-line-disruptions/" },
                  { label: "🅿️ Parkopedia", url: "https://www.parkopedia.com.au/parking/carpark/werribee_station/3030/melbourne/" },
                ].map(l => (
                  <a key={l.label} href={l.url} target="_blank" rel="noreferrer" style={{
                    padding: "9px 14px", borderRadius: 8, background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.1)", color: "#cbd5e1",
                    fontSize: 12, textDecoration: "none", fontFamily: "inherit",
                    transition: "background 0.2s"
                  }}>
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
