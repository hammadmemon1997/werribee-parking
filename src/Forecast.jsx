import { useState, useEffect } from "react";
import { LAT, LON, BASE_OCCUPANCY, WEEKEND_OCCUPANCY, WEATHER_ICONS, WEATHER_CODES, weatherImpact, getVerdict, fmt12, DAY_NAMES, DAY_SHORT } from "./utils.js";

const FORECAST_URL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&hourly=precipitation_probability,weathercode&timezone=Australia%2FSydney&forecast_days=7`;

export default function Forecast({ onBack }) {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    fetch(FORECAST_URL)
      .then(r => r.json())
      .then(data => {
        const days = data.daily.time.map((date, i) => {
          const d   = new Date(date);
          const dow = d.getDay();
          const isWe = dow === 0 || dow === 6;
          const base = isWe ? WEEKEND_OCCUPANCY : BASE_OCCUPANCY;
          const code = data.daily.weathercode[i];
          const precip = data.daily.precipitation_sum[i] ?? 0;
          const impact = weatherImpact(code, precip / 8); // daily precip spread over hours
          // Per hour adjusted
          const hours = base.map(b => Math.min(99, b + impact.delta));
          const morningPeak = Math.max(...hours.slice(7, 10));
          const bestHr = hours.slice(5, 11).reduce((best, v, idx) => v < hours[best+5] ? idx+5 : best, 5);
          return { date: d, dow, isWeekend: isWe, code, precip, maxTemp: Math.round(data.daily.temperature_2m_max[i]), minTemp: Math.round(data.daily.temperature_2m_min[i]), precipProb: data.daily.precipitation_probability_max[i], impact, morningPeak, bestHour: bestHr, hours };
        });
        setForecast(days);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const getRating = (pct) => {
    if (pct >= 90) return { label: "Avoid driving", stars: 1, color: "#dc2626" };
    if (pct >= 75) return { label: "Risky",         stars: 2, color: "#ea580c" };
    if (pct >= 55) return { label: "Moderate",      stars: 3, color: "#d97706" };
    if (pct >= 30) return { label: "Good day",      stars: 4, color: "#16a34a" };
    return               { label: "Best day!",      stars: 5, color: "#0284c7" };
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", fontFamily: "'Palatino Linotype', Georgia, serif", color: "#e2e8f0" }}>
      <div style={{ background: "#1e293b", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 100, borderBottom: "1px solid #334155" }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid #334155", color: "#94a3b8", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>← Back</button>
        <div><div style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700 }}>7-Day Forecast</div><div style={{ color: "#475569", fontSize: 10, letterSpacing: 3, fontFamily: "monospace" }}>PARKING + WEATHER · WERRIBEE</div></div>
      </div>

      <div style={{ maxWidth: 580, margin: "0 auto", padding: "16px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#475569" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div>Loading 7-day forecast...</div>
          </div>
        )}
        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid #ef444433", borderRadius: 12, padding: "24px", textAlign: "center", color: "#fca5a5" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
            <div>Couldn't load forecast. Check your connection.</div>
          </div>
        )}
        {forecast && (
          <>
            {/* Day picker strip */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
              {forecast.map((d, i) => {
                const r = getRating(d.morningPeak);
                const isToday = i === 0;
                const isSelected = selected === i;
                return (
                  <button key={i} onClick={() => setSelected(i)} style={{ flexShrink: 0, padding: "10px 10px 8px", borderRadius: 12, border: `1px solid ${isSelected ? r.color : "#334155"}`, background: isSelected ? `${r.color}18` : "rgba(30,41,59,0.8)", cursor: "pointer", minWidth: 64, textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: isSelected ? r.color : "#64748b", fontFamily: "monospace", fontWeight: 700 }}>{isToday ? "TODAY" : DAY_SHORT[d.dow]}</div>
                    <div style={{ fontSize: 20, margin: "4px 0" }}>{WEATHER_ICONS[d.code] || "🌡️"}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{d.maxTemp}°</div>
                    <div style={{ fontSize: 8, color: r.color, fontFamily: "monospace", marginTop: 3 }}>{"★".repeat(r.stars)}{"☆".repeat(5-r.stars)}</div>
                  </button>
                );
              })}
            </div>

            {/* Selected day detail */}
            {(() => {
              const d = forecast[selected];
              const r = getRating(d.morningPeak);
              const v = getVerdict(d.morningPeak);
              const isToday = selected === 0;
              return (
                <div>
                  <div style={{ background: `${r.color}12`, border: `2px solid ${r.color}44`, borderRadius: 16, padding: "22px 20px", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "#475569", letterSpacing: 3, fontFamily: "monospace", marginBottom: 4 }}>
                          {isToday ? "TODAY" : DAY_NAMES[d.dow].toUpperCase()} · {d.date.toLocaleDateString("en-AU",{day:"numeric",month:"short"})}
                        </div>
                        <div style={{ fontSize: 30, fontWeight: 900, color: r.color, lineHeight: 1 }}>{r.label}</div>
                        <div style={{ fontSize: 13, color: "#64748b", marginTop: 5 }}>Peak morning occupancy ~{d.morningPeak}% at 7–9 AM</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 36 }}>{WEATHER_ICONS[d.code] || "🌡️"}</div>
                        <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>{d.maxTemp}° / {d.minTemp}°</div>
                      </div>
                    </div>

                    {/* Weather detail */}
                    <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                      <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 12px" }}>
                        <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", letterSpacing: 1 }}>CONDITION</div>
                        <div style={{ fontSize: 13, color: "#e2e8f0", marginTop: 3 }}>{WEATHER_CODES[d.code] || "Unknown"}</div>
                      </div>
                      <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 12px" }}>
                        <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", letterSpacing: 1 }}>RAIN CHANCE</div>
                        <div style={{ fontSize: 13, color: d.precipProb > 50 ? "#60a5fa" : "#e2e8f0", marginTop: 3 }}>{d.precipProb}% · {d.precip.toFixed(1)}mm</div>
                      </div>
                      <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 12px" }}>
                        <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", letterSpacing: 1 }}>PARKING IMPACT</div>
                        <div style={{ fontSize: 13, color: d.impact.delta > 0 ? "#f87171" : d.impact.delta < 0 ? "#4ade80" : "#e2e8f0", marginTop: 3 }}>{d.impact.icon} {d.impact.delta > 0 ? `+${d.impact.delta}` : d.impact.delta}%</div>
                      </div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                      <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>BEST TIME TO LEAVE</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: "#22c55e" }}>{fmt12(d.bestHour)}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>~{d.hours[d.bestHour]}% full — lowest occupancy in your commute window</div>
                      </div>
                    </div>

                    {/* Recommendation */}
                    <div style={{ background: `${r.color}18`, border: `1px solid ${r.color}33`, borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ fontSize: 12, color: r.color, lineHeight: 1.6 }}>
                        {r.stars >= 4 && "✅ Good day to drive. Parking should be easy — leave at your normal time."}
                        {r.stars === 3 && "⚠️ Moderate day. Leave 10 minutes earlier than usual and head to Zone C or D first."}
                        {r.stars === 2 && "⚠️ Busy day expected. Leave before 7:15 AM or consider street parking on Watton St."}
                        {r.stars === 1 && "🛑 Very busy — possibly due to weather. Consider leaving before 7 AM or taking a different route."}
                      </div>
                    </div>
                  </div>

                  {/* Hourly chart for this day */}
                  <div style={{ background: "rgba(30,41,59,0.8)", borderRadius: 14, padding: "16px", border: "1px solid #334155", marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, fontFamily: "monospace", marginBottom: 14 }}>HOURLY PARKING FORECAST</div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 90 }}>
                      {d.hours.map((pct, h) => {
                        const v2 = getVerdict(pct);
                        const isYour = h === 7 || h === 8;
                        return (
                          <div key={h} title={`${fmt12(h)}: ~${pct}%`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                            <div style={{ width: "100%", borderRadius: "2px 2px 0 0", minHeight: 2, height: `${Math.max(pct,2)}%`, background: isYour ? v2.color : `${v2.color}55`, border: isYour ? `1px solid ${v2.color}` : "none", transition: "all 0.3s" }} />
                            {h % 4 === 0 && <div style={{ fontSize: 7, color: "#475569", fontFamily: "monospace" }}>{fmt12(h)}</div>}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: "#475569" }}>
                      Bright bars = your 7–8 AM commute window
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Week at a glance */}
            <div style={{ background: "rgba(30,41,59,0.8)", borderRadius: 14, padding: "16px", border: "1px solid #334155" }}>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, fontFamily: "monospace", marginBottom: 14 }}>WEEK AT A GLANCE — MORNING PEAK (7–9AM)</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
                {forecast.map((d, i) => {
                  const r = getRating(d.morningPeak);
                  const isSelected2 = selected === i;
                  return (
                    <button key={i} onClick={() => setSelected(i)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "transparent", border: "none", cursor: "pointer" }}>
                      <div style={{ width: "100%", borderRadius: "3px 3px 0 0", height: `${Math.max(d.morningPeak, 5)}%`, background: isSelected2 ? r.color : `${r.color}66`, boxShadow: isSelected2 ? `0 0 10px ${r.color}88` : "none", transition: "all 0.3s" }} />
                      <div style={{ fontSize: 9, color: isSelected2 ? r.color : "#475569", fontFamily: "monospace", fontWeight: isSelected2 ? 700 : 400 }}>{i === 0 ? "NOW" : DAY_SHORT[d.dow]}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
