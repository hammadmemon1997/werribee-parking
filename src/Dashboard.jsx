import { useState, useEffect, useCallback, useRef } from "react";
import { LAT, LON, WEATHER_CODES, WEATHER_ICONS, weatherImpact, getVerdict, fmt12, DAY_NAMES, BASE_OCCUPANCY, WEEKEND_OCCUPANCY, TOTAL_SPOTS, estimateFindTime, storage } from "./utils.js";

const WEATHER_URL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,precipitation,weathercode,windspeed_10m,relativehumidity_2m&hourly=precipitation_probability&timezone=Australia%2FSydney&forecast_days=1`;

export default function Dashboard({ onViewMap, onViewHistory, onViewForecast }) {
  const [weather, setWeather]       = useState(null);
  const [disruptions, setDisruptions] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [lastFetch, setLastFetch]   = useState(null);
  const [notifPerm, setNotifPerm]   = useState(typeof Notification !== "undefined" ? Notification.permission : "denied");
  const [notifThreshold, setNotifThreshold] = useState(() => storage.get("notif_threshold") ?? 80);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [reports, setReports]       = useState(() => storage.get("crowd_reports") ?? []);
  const [showReport, setShowReport] = useState(false);
  const [reportZone, setReportZone] = useState("A");
  const [reportType, setReportType] = useState("full");
  const [pwaPrompt, setPwaPrompt]   = useState(null);
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [toast, setToast]           = useState(null);
  const prevPct = useRef(null);

  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const baseOcc = isWeekend ? WEEKEND_OCCUPANCY : BASE_OCCUPANCY;

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPwaPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setPwaInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const showToast = (msg, color = "#22c55e") => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3500);
  };

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
      if (html.toLowerCase().includes("replacement bus")) d.push({ type: "warning", text: "Bus replacements on Werribee line — MORE parking demand today" });
      if (html.toLowerCase().includes("altered timetable")) d.push({ type: "info", text: "Altered timetable in effect — check PTV for times" });
      setDisruptions(d);
    } catch { setDisruptions([]); }
    setLastFetch(new Date());
    setLoading(false);
  }, [hour]);

  useEffect(() => { fetchData(); const t = setInterval(fetchData, 10*60*1000); return () => clearInterval(t); }, [fetchData]);

  const recentReports = reports.filter(r => Date.now() - r.ts < 30*60*1000);
  const crowdDelta = recentReports.reduce((acc, r) => acc + (r.type === "full" ? +6 : r.type === "spaces" ? -5 : 0), 0);

  const impact = weather ? weatherImpact(weather.code, weather.precip) : { delta: 0, label: "Loading...", icon: "⏳" };
  const disruptDelta = disruptions.some(d => d.text.includes("MORE")) ? 12 : 0;
  const adjustedPct = Math.min(99, Math.max(1, (baseOcc[hour] ?? 50) + impact.delta + disruptDelta + crowdDelta));
  const verdict = getVerdict(adjustedPct);
  const findTime = estimateFindTime(adjustedPct);
  const freeSpots = Math.round(TOTAL_SPOTS * (1 - adjustedPct / 100));
  const todayHours = baseOcc.map(b => Math.min(99, b + impact.delta));
  const bestHour = todayHours.slice(5, 11).reduce((best, v, i) => v < todayHours[best+5] ? i+5 : best, 5);

  useEffect(() => {
    if (prevPct.current !== null && prevPct.current >= notifThreshold && adjustedPct < notifThreshold && notifPerm === "granted") {
      new Notification("Werribee Parking — Spots Available!", {
        body: `Car park is now ${adjustedPct}% full — ${freeSpots} spaces free. Good time to leave!`,
        icon: "/parking-icon.png", tag: "parking-alert",
      });
    }
    prevPct.current = adjustedPct;
  }, [adjustedPct, notifThreshold, notifPerm, freeSpots]);

  useEffect(() => {
    if (!loading && weather) {
      const history = storage.get("parking_history") ?? [];
      const last = history[history.length - 1];
      if (!last || new Date(last.ts).getHours() !== hour) {
        history.push({ ts: Date.now(), pct: adjustedPct, weather: weather.code, hour, day: dayOfWeek });
        if (history.length > 168) history.shift();
        storage.set("parking_history", history);
      }
    }
  }, [loading, adjustedPct]);

  const requestNotifications = async () => {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
    if (perm === "granted") showToast("Notifications enabled!");
    else showToast("Notifications blocked in browser settings", "#ef4444");
  };

  const submitReport = () => {
    const r = { zone: reportZone, type: reportType, ts: Date.now(), id: Math.random().toString(36).slice(2) };
    const updated = [...reports, r].slice(-20);
    setReports(updated);
    storage.set("crowd_reports", updated);
    setShowReport(false);
    showToast(`Thanks! Zone ${reportZone} report submitted`);
  };

  const installPWA = async () => {
    if (!pwaPrompt) return;
    pwaPrompt.prompt();
    const { outcome } = await pwaPrompt.userChoice;
    if (outcome === "accepted") { setPwaInstalled(true); showToast("App installed!"); }
    setPwaPrompt(null);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8f5f0", fontFamily: "'Palatino Linotype', Georgia, serif" }}>
      {toast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: toast.color, color: "#fff", padding: "10px 20px", borderRadius: 8, zIndex: 9999, fontSize: 13, boxShadow: "0 4px 20px rgba(0,0,0,0.3)", whiteSpace: "nowrap" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ background: "#1c2b3a", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🚉</span>
          <div>
            <div style={{ color: "#f0e6d3", fontSize: 15, fontWeight: 700 }}>Werribee Station Parking</div>
            <div style={{ color: "#5d7a8a", fontSize: 10, letterSpacing: 3, fontFamily: "monospace" }}>LIVE SMART ADVISOR</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {weather && <div style={{ textAlign: "right" }}><div style={{ color: "#f0e6d3", fontSize: 15 }}>{WEATHER_ICONS[weather.code]} {weather.temp}°C</div><div style={{ color: "#5d7a8a", fontSize: 9, fontFamily: "monospace" }}>{(WEATHER_CODES[weather.code] || "").slice(0,12)}</div></div>}
          <button onClick={fetchData} style={{ background: "transparent", border: "1px solid #2d4a5a", color: "#5d7a8a", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 13 }}>{loading ? "⏳" : "🔄"}</button>
        </div>
      </div>

      <div style={{ maxWidth: 580, margin: "0 auto", padding: "16px" }}>
        {pwaPrompt && !pwaInstalled && (
          <div style={{ background: "linear-gradient(135deg,#1e40af,#1d4ed8)", borderRadius: 12, padding: "14px 16px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div><div style={{ color: "#bfdbfe", fontSize: 13, fontWeight: 700 }}>📱 Install as App</div><div style={{ color: "#93c5fd", fontSize: 11, marginTop: 2 }}>Add to home screen for quick morning access</div></div>
            <button onClick={installPWA} style={{ background: "#fff", color: "#1e40af", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Install</button>
          </div>
        )}

        {disruptions.map((d,i) => (
          <div key={i} style={{ background: d.type==="warning"?"rgba(220,38,38,0.08)":"rgba(2,132,199,0.08)", border: `1px solid ${d.type==="warning"?"#dc262644":"#0284c744"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 10, color: d.type==="warning"?"#dc2626":"#0284c7", fontSize: 12 }}>
            {d.type==="warning"?"⚠️":"ℹ️"} <strong>PTV Alert:</strong> {d.text}
          </div>
        ))}

        {recentReports.length > 0 && (
          <div style={{ background: "rgba(139,92,246,0.08)", border: "1px solid #8b5cf633", borderRadius: 8, padding: "10px 14px", marginBottom: 10, color: "#7c3aed", fontSize: 12 }}>
            👥 <strong>{recentReports.length} community report{recentReports.length>1?"s":""}</strong> in last 30 min — occupancy adjusted {crowdDelta>0?`+${crowdDelta}`:crowdDelta}%
          </div>
        )}

        <div style={{ background: verdict.bg, border: `2px solid ${verdict.color}44`, borderRadius: 18, padding: "24px 20px", marginBottom: 14, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -10, top: -10, fontSize: 90, opacity: 0.06, userSelect: "none" }}>{verdict.emoji}</div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 3, fontFamily: "monospace", marginBottom: 4 }}>RIGHT NOW · {DAY_NAMES[dayOfWeek].toUpperCase()} {fmt12(hour)}</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: verdict.color, letterSpacing: -1, lineHeight: 1 }}>{verdict.text}</div>
              <div style={{ fontSize: 13, color: "#475569", marginTop: 5 }}>{verdict.sub}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: verdict.color }}>{adjustedPct}%</div>
              <div style={{ fontSize: 9, color: "#94a3b8", fontFamily: "monospace" }}>FULL</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: verdict.color, marginTop: 2 }}>{freeSpots} free</div>
            </div>
          </div>
          <div style={{ height: 10, background: "rgba(0,0,0,0.08)", borderRadius: 5, overflow: "hidden", marginBottom: 12 }}>
            <div style={{ height: "100%", width: `${adjustedPct}%`, background: `linear-gradient(90deg,#22c55e,${verdict.color})`, borderRadius: 5, transition: "width 1.4s ease" }} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ padding: "4px 10px", background: "rgba(255,255,255,0.6)", borderRadius: 20, fontSize: 11, color: "#475569" }}>{impact.icon} {impact.label} <span style={{ color: "#94a3b8", fontFamily: "monospace", fontSize: 9 }}>{impact.delta>0?`+${impact.delta}`:impact.delta<0?impact.delta:"±0"}%</span></div>
            {disruptDelta > 0 && <div style={{ padding: "4px 10px", background: "rgba(220,38,38,0.1)", borderRadius: 20, fontSize: 11, color: "#dc2626" }}>🚌 Bus replace +{disruptDelta}%</div>}
            {crowdDelta !== 0 && <div style={{ padding: "4px 10px", background: "rgba(139,92,246,0.1)", borderRadius: 20, fontSize: 11, color: "#7c3aed" }}>👥 Reports {crowdDelta>0?"+":""}{crowdDelta}%</div>}
          </div>
          <div style={{ background: "rgba(255,255,255,0.5)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 2, fontFamily: "monospace" }}>⏱ EST. TIME TO FIND A SPOT</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: findTime.color, marginTop: 2 }}>{findTime.mins} mins</div>
            </div>
            <div style={{ padding: "6px 14px", background: `${findTime.color}18`, border: `1px solid ${findTime.color}44`, borderRadius: 8, color: findTime.color, fontWeight: 700, fontSize: 12 }}>{findTime.label}</div>
          </div>
          <button onClick={onViewMap} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", cursor: "pointer", background: verdict.color, color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", letterSpacing: 0.5, boxShadow: `0 4px 20px ${verdict.color}55`, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>🅿️</span> View Interactive Parking Map <span style={{ fontSize: 12, opacity: 0.85 }}>→ {freeSpots} free</span>
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: "13px 14px", border: "1px solid #e8e0d5" }}>
            <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 2, fontFamily: "monospace" }}>BEST TIME TODAY</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#1c2b3a", marginTop: 3 }}>{fmt12(bestHour)}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>~{todayHours[bestHour]}% full</div>
          </div>
          {weather ? (
            <div style={{ background: "#fff", borderRadius: 12, padding: "13px 14px", border: "1px solid #e8e0d5" }}>
              <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 2, fontFamily: "monospace" }}>WERRIBEE WEATHER</div>
              <div style={{ fontSize: 20, marginTop: 3 }}>{WEATHER_ICONS[weather.code]} {weather.temp}°C</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>💧{weather.humidity}% · 💨{weather.wind}km/h · 🌧{weather.precipProb}%</div>
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 12, padding: "13px 14px", border: "1px solid #e8e0d5", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#94a3b8", fontSize: 12 }}>Loading...</span></div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          <button onClick={() => setShowReport(true)} style={{ background: "#fff", border: "1px solid #e8e0d5", borderRadius: 12, padding: "12px 8px", cursor: "pointer", fontFamily: "inherit" }}>
            <div style={{ fontSize: 22 }}>👥</div><div style={{ fontSize: 11, fontWeight: 700, color: "#1c2b3a", marginTop: 4 }}>Report</div><div style={{ fontSize: 10, color: "#64748b" }}>Crowdsource</div>
          </button>
          <button onClick={() => notifPerm === "granted" ? setShowNotifPanel(!showNotifPanel) : requestNotifications()} style={{ background: notifPerm==="granted"?"rgba(34,197,94,0.08)":"#fff", border: `1px solid ${notifPerm==="granted"?"#22c55e44":"#e8e0d5"}`, borderRadius: 12, padding: "12px 8px", cursor: "pointer", fontFamily: "inherit" }}>
            <div style={{ fontSize: 22 }}>{notifPerm==="granted"?"🔔":"🔕"}</div><div style={{ fontSize: 11, fontWeight: 700, color: "#1c2b3a", marginTop: 4 }}>Alerts</div><div style={{ fontSize: 10, color: notifPerm==="granted"?"#16a34a":"#64748b" }}>{notifPerm==="granted"?`≤${notifThreshold}%`:"Enable"}</div>
          </button>
          <button onClick={onViewHistory} style={{ background: "#fff", border: "1px solid #e8e0d5", borderRadius: 12, padding: "12px 8px", cursor: "pointer", fontFamily: "inherit" }}>
            <div style={{ fontSize: 22 }}>📊</div><div style={{ fontSize: 11, fontWeight: 700, color: "#1c2b3a", marginTop: 4 }}>History</div><div style={{ fontSize: 10, color: "#64748b" }}>My Stats</div>
          </button>
        </div>

        {showNotifPanel && notifPerm === "granted" && (
          <div style={{ background: "#fff", border: "1px solid #e8e0d5", borderRadius: 12, padding: "16px", marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1c2b3a", marginBottom: 10 }}>🔔 Alert when occupancy drops below:</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[50,60,70,80,90].map(t => (
                <button key={t} onClick={() => { setNotifThreshold(t); storage.set("notif_threshold", t); showToast(`Will alert at ≤${t}%`); }} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: notifThreshold===t?"#1c2b3a":"#f1f5f9", color: notifThreshold===t?"#fff":"#475569" }}>{t}%</button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>Alert when it's a good time to leave (drops ≤{notifThreshold}%)</div>
          </div>
        )}

        {showReport && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowReport(false)}>
            <div style={{ background: "#fff", borderRadius: "16px 16px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: 580 }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#1c2b3a", marginBottom: 4 }}>👥 Report Parking Status</div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>Help other commuters with live info</div>
              <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: 2, fontFamily: "monospace", marginBottom: 8 }}>ZONE</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {["A","B","C","D"].map(z => (
                  <button key={z} onClick={() => setReportZone(z)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14, background: reportZone===z?"#1c2b3a":"#f1f5f9", color: reportZone===z?"#fff":"#475569" }}>Zone {z}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: 2, fontFamily: "monospace", marginBottom: 8 }}>WHAT DID YOU SEE?</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {[
                  { val:"full",   icon:"🔴", label:"Completely full — no spots",  sub:"Can't find a space anywhere" },
                  { val:"busy",   icon:"🟡", label:"Very busy — limited spots",   sub:"Had to circle a few times" },
                  { val:"spaces", icon:"🟢", label:"Spaces available",            sub:"Found a spot quickly" },
                ].map(o => (
                  <button key={o.val} onClick={() => setReportType(o.val)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, border: `2px solid ${reportType===o.val?"#1c2b3a":"#e8e0d5"}`, background: reportType===o.val?"#f8f5f0":"#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                    <span style={{ fontSize: 24 }}>{o.icon}</span>
                    <div><div style={{ fontSize: 13, fontWeight: 700, color: "#1c2b3a" }}>{o.label}</div><div style={{ fontSize: 11, color: "#64748b" }}>{o.sub}</div></div>
                  </button>
                ))}
              </div>
              <button onClick={submitReport} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", cursor: "pointer", background: "#1c2b3a", color: "#f0e6d3", fontSize: 14, fontWeight: 700, fontFamily: "inherit" }}>Submit Report</button>
            </div>
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: 14, padding: "16px", border: "1px solid #e8e0d5", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 2, fontFamily: "monospace" }}>HOURLY FORECAST · {DAY_NAMES[dayOfWeek].toUpperCase()}</div>
            <button onClick={onViewForecast} style={{ fontSize: 11, color: "#1c2b3a", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>7-day forecast →</button>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80 }}>
            {todayHours.map((pct, h) => {
              const v = getVerdict(pct);
              const isCur = h === hour;
              const isYour = h === 7 || h === 8;
              return (
                <div key={h} title={`${fmt12(h)}: ~${pct}% full`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <div style={{ width: "100%", borderRadius: "3px 3px 0 0", minHeight: 3, height: `${Math.max(pct,3)}%`, background: isCur?v.color:isYour?`${v.color}bb`:`${v.color}44`, boxShadow: isCur?`0 0 8px ${v.color}88`:"none", border: isCur?`1px solid ${v.color}`:isYour?`1px solid ${v.color}55`:"none", transition: "all 0.5s" }} />
                  {h%4===0 && <div style={{ fontSize: 7, color: isCur?"#1c2b3a":"#94a3b8", fontFamily: "monospace", fontWeight: isCur?700:400 }}>{fmt12(h)}</div>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ background: "#1c2b3a", borderRadius: 14, padding: "12px 16px", display: "flex", justifyContent: "space-around" }}>
          {[
            { icon: "🅿️", label: "Map",      action: onViewMap },
            { icon: "📊", label: "History",  action: onViewHistory },
            { icon: "🌦️", label: "Forecast", action: onViewForecast },
            { icon: "👥", label: "Report",   action: () => setShowReport(true) },
          ].map(n => (
            <button key={n.label} onClick={n.action} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#94a3b8", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 8px", borderRadius: 8 }}>
              <span style={{ fontSize: 20 }}>{n.icon}</span>
              <span style={{ fontSize: 10, letterSpacing: 1 }}>{n.label}</span>
            </button>
          ))}
        </div>
        {lastFetch && <div style={{ textAlign: "center", marginTop: 10, fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>Updated {lastFetch.toLocaleTimeString("en-AU",{hour:"2-digit",minute:"2-digit"})}</div>}
      </div>
    </div>
  );
}
