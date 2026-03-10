import { useState } from "react";
import { getVerdict, fmt12, DAY_SHORT, DAY_NAMES, storage, WEATHER_ICONS } from "./utils.js";

export default function History({ onBack }) {
  const history = storage.get("parking_history") ?? [];
  const [view, setView] = useState("week"); // week | heatmap | stats

  // Last 7 days grouped by day
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const byDay = days.map(d => {
    const entries = history.filter(h => {
      const hd = new Date(h.ts);
      return hd.toDateString() === d.toDateString();
    });
    const avg = entries.length ? Math.round(entries.reduce((s, h) => s + h.pct, 0) / entries.length) : null;
    const morning = entries.filter(h => h.hour >= 6 && h.hour <= 9);
    const morningAvg = morning.length ? Math.round(morning.reduce((s, h) => s + h.pct, 0) / morning.length) : null;
    return { date: d, entries, avg, morningAvg, dayOfWeek: d.getDay() };
  });

  // Stats
  const total = history.length;
  const morningEntries = history.filter(h => h.hour >= 6 && h.hour <= 9);
  const avgMorning = morningEntries.length ? Math.round(morningEntries.reduce((s, h) => s + h.pct, 0) / morningEntries.length) : null;
  const bestDay = (() => {
    const byDayOfWeek = Array.from({ length: 7 }, (_, i) => {
      const e = history.filter(h => h.day === i && h.hour >= 6 && h.hour <= 9);
      return { day: i, avg: e.length ? Math.round(e.reduce((s, h) => s + h.pct, 0) / e.length) : 100 };
    });
    return byDayOfWeek.sort((a, b) => a.avg - b.avg)[0];
  })();

  const worstDay = (() => {
    const byDayOfWeek = Array.from({ length: 7 }, (_, i) => {
      const e = history.filter(h => h.day === i && h.hour >= 6 && h.hour <= 9);
      return { day: i, avg: e.length ? Math.round(e.reduce((s, h) => s + h.pct, 0) / e.length) : 0 };
    }).filter(d => history.some(h => h.day === d.day));
    return worstDay ? worstDay : byDayOfWeek.sort((a, b) => b.avg - a.avg)[0];
  })();

  // Heatmap: day x hour
  const heatmap = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => {
      const e = history.filter(h => h.day === day && h.hour === hour);
      return e.length ? Math.round(e.reduce((s, h) => s + h.pct, 0) / e.length) : null;
    })
  );

  const isEmpty = history.length === 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f8f5f0", fontFamily: "'Palatino Linotype', Georgia, serif" }}>
      <div style={{ background: "#1c2b3a", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid #334155", color: "#94a3b8", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>← Back</button>
        <div><div style={{ color: "#f0e6d3", fontSize: 15, fontWeight: 700 }}>My Parking History</div><div style={{ color: "#5d7a8a", fontSize: 10, letterSpacing: 3, fontFamily: "monospace" }}>PERSONAL STATS</div></div>
      </div>

      <div style={{ maxWidth: 580, margin: "0 auto", padding: "16px" }}>
        {isEmpty ? (
          <div style={{ background: "#fff", borderRadius: 16, padding: "48px 24px", textAlign: "center", border: "1px solid #e8e0d5" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1c2b3a", marginBottom: 8 }}>No data yet</div>
            <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>Your parking stats will appear here after your first visit. Come back after checking the dashboard a few times!</div>
          </div>
        ) : (
          <>
            {/* Summary stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div style={{ background: "#fff", borderRadius: 12, padding: "14px 12px", border: "1px solid #e8e0d5", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#1c2b3a" }}>{total}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 1, fontFamily: "monospace", marginTop: 2 }}>SESSIONS</div>
              </div>
              <div style={{ background: "#fff", borderRadius: 12, padding: "14px 12px", border: "1px solid #e8e0d5", textAlign: "center" }}>
                {avgMorning !== null ? (
                  <>
                    <div style={{ fontSize: 28, fontWeight: 800, color: getVerdict(avgMorning).color }}>{avgMorning}%</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 1, fontFamily: "monospace", marginTop: 2 }}>AVG 7-9AM</div>
                  </>
                ) : <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 14 }}>No morning data</div>}
              </div>
              <div style={{ background: "#fff", borderRadius: 12, padding: "14px 12px", border: "1px solid #e8e0d5", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a" }}>{DAY_SHORT[bestDay?.day ?? 1]}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 1, fontFamily: "monospace", marginTop: 2 }}>BEST DAY</div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 2, background: "#ede8e1", borderRadius: 10, padding: 3, marginBottom: 14 }}>
              {[["week","📅 Last 7 Days"],["heatmap","🔥 Heatmap"],["stats","📈 Insights"]].map(([id,label]) => (
                <button key={id} onClick={() => setView(id)} style={{ flex: 1, padding: "9px 4px", borderRadius: 8, border: "none", cursor: "pointer", background: view===id?"#1c2b3a":"transparent", color: view===id?"#f0e6d3":"#64748b", fontFamily: "inherit", fontSize: 11, fontWeight: view===id?700:400 }}>{label}</button>
              ))}
            </div>

            {/* Last 7 days */}
            {view === "week" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {byDay.reverse().map((d, i) => {
                  const isToday = d.date.toDateString() === now.toDateString();
                  const v = d.morningAvg !== null ? getVerdict(d.morningAvg) : null;
                  return (
                    <div key={i} style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: `1px solid ${isToday?"#1c2b3a33":"#e8e0d5"}` }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#1c2b3a" }}>{DAY_NAMES[d.dayOfWeek]}</span>
                            {isToday && <span style={{ fontSize: 10, background: "#1c2b3a", color: "#f0e6d3", padding: "2px 8px", borderRadius: 10, fontFamily: "monospace" }}>TODAY</span>}
                          </div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{d.date.toLocaleDateString("en-AU",{day:"numeric",month:"short"})}</div>
                        </div>
                        {v ? (
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: v.color }}>{d.morningAvg}%</div>
                            <div style={{ fontSize: 10, color: v.color, fontFamily: "monospace" }}>{v.text}</div>
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: "#94a3b8" }}>No data</div>
                        )}
                      </div>
                      {d.entries.length > 0 && (
                        <div style={{ marginTop: 10, display: "flex", alignItems: "flex-end", gap: 3, height: 30 }}>
                          {Array.from({ length: 24 }, (_, h) => {
                            const e = d.entries.find(e => e.hour === h);
                            const pct = e?.pct ?? null;
                            const v2 = pct !== null ? getVerdict(pct) : null;
                            return (
                              <div key={h} title={pct !== null ? `${fmt12(h)}: ${pct}%` : ""} style={{ flex: 1, height: pct !== null ? `${Math.max(pct,5)}%` : "5%", borderRadius: "2px 2px 0 0", background: v2 ? `${v2.color}${pct!==null?"cc":"22"}` : "#f1f5f9", minHeight: 2 }} />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Heatmap */}
            {view === "heatmap" && (
              <div style={{ background: "#fff", borderRadius: 14, padding: "16px", border: "1px solid #e8e0d5" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1c2b3a", marginBottom: 4 }}>Average occupancy by day & hour</div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 14 }}>Darker = busier. Based on your recorded sessions.</div>
                <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  <div style={{ width: 30 }} />
                  {[0,3,6,9,12,15,18,21].map(h => (
                    <div key={h} style={{ flex: 1, fontSize: 8, color: "#94a3b8", fontFamily: "monospace", textAlign: "center" }}>{fmt12(h)}</div>
                  ))}
                </div>
                {heatmap.map((row, dayI) => (
                  <div key={dayI} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                    <div style={{ width: 30, fontSize: 9, color: "#64748b", fontFamily: "monospace", flexShrink: 0 }}>{DAY_SHORT[dayI]}</div>
                    {row.map((pct, hi) => {
                      const v = pct !== null ? getVerdict(pct) : null;
                      return (
                        <div key={hi} title={pct !== null ? `${DAY_NAMES[dayI]} ${fmt12(hi)}: ${pct}%` : "No data"} style={{ flex: 1, height: 16, borderRadius: 3, background: v ? `${v.color}${pct > 80?"ff": pct > 60 ? "cc" : pct > 40 ? "88" : "44"}` : "#f1f5f9" }} />
                      );
                    })}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                  {[["#22c55e","Easy (<30%)"],["#d97706","Moderate (55%)"],["#ef4444","Full (90%+)"]].map(([c,l]) => (
                    <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 12, height: 12, background: c, borderRadius: 2 }} /><span style={{ fontSize: 10, color: "#64748b" }}>{l}</span></div>
                  ))}
                </div>
              </div>
            )}

            {/* Insights */}
            {view === "stats" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { icon: "🏆", title: `Best day: ${DAY_NAMES[bestDay?.day ?? 1]}`, body: `On average the lowest occupancy during your commute window. Aim for this day when possible.`, color: "#16a34a" },
                  { icon: "📅", title: `${total} sessions recorded`, body: `The more sessions logged, the more accurate your personal patterns become.`, color: "#0284c7" },
                  avgMorning !== null && { icon: "🕖", title: `Your typical 7–9AM: ${avgMorning}% full`, body: getVerdict(avgMorning).text + " — " + getVerdict(avgMorning).sub, color: getVerdict(avgMorning).color },
                  { icon: "🌧️", title: "Rain adds ~14% occupancy", body: "On rainy mornings, leave 10–15 minutes earlier than usual to secure a spot.", color: "#0ea5e9" },
                  { icon: "💡", title: "Pro tip: leave before 7:15 AM", body: "Data shows the car park reaches 85%+ by 7:45 AM on typical weekdays.", color: "#d97706" },
                ].filter(Boolean).map((tip, i) => (
                  <div key={i} style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid #e8e0d5", display: "flex", gap: 12 }}>
                    <div style={{ fontSize: 24, lineHeight: 1 }}>{tip.icon}</div>
                    <div><div style={{ fontSize: 13, fontWeight: 700, color: tip.color, marginBottom: 3 }}>{tip.title}</div><div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{tip.body}</div></div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
