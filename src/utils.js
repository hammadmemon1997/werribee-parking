export const LAT = -37.9027;
export const LON = 144.6627;

export const BASE_OCCUPANCY     = [2,2,2,2,3,5,18,72,91,80,62,55,50,52,58,65,80,88,74,50,30,18,10,5];
export const WEEKEND_OCCUPANCY  = [2,2,2,2,2,3,5,15,28,32,28,24,20,22,24,26,28,25,20,14,10,6,4,2];
export const TOTAL_SPOTS = 120;

export const WEATHER_CODES = {
  0:"Clear sky",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",
  45:"Foggy",48:"Icy fog",51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",
  61:"Light rain",63:"Rain",65:"Heavy rain",80:"Rain showers",81:"Heavy showers",95:"Thunderstorm"
};
export const WEATHER_ICONS = {
  0:"☀️",1:"🌤️",2:"⛅",3:"☁️",45:"🌫️",51:"🌦️",53:"🌧️",55:"🌧️",
  61:"🌦️",63:"🌧️",65:"⛈️",80:"🌦️",81:"🌧️",95:"⛈️"
};

export const weatherImpact = (code, precip) => {
  if (code >= 61 || precip > 2) return { delta: +14, label: "Rain → more drivers", icon: "🌧️" };
  if (code >= 51 || precip > 0.5) return { delta: +8,  label: "Drizzle → extra cars", icon: "🌦️" };
  if (code === 3)                  return { delta: +3,  label: "Overcast",             icon: "☁️" };
  if (code === 0 || code === 1)    return { delta: -4,  label: "Fine → some walk/cycle",icon: "☀️"};
  return { delta: 0, label: "Neutral conditions", icon: "🌤️" };
};

export const getVerdict = (pct) => {
  if (pct >= 90) return { text:"STAY HOME",  sub:"Car park is full. Leave in 40+ min.",      color:"#dc2626", bg:"rgba(220,38,38,0.1)",   emoji:"🛑", score: 0 };
  if (pct >= 75) return { text:"RISKY",      sub:"Very busy — leave right now.",              color:"#ea580c", bg:"rgba(234,88,12,0.1)",   emoji:"⚠️", score: 1 };
  if (pct >= 55) return { text:"MODERATE",   sub:"Filling up. Leave soon.",                   color:"#d97706", bg:"rgba(217,119,6,0.1)",   emoji:"🟡", score: 2 };
  if (pct >= 30) return { text:"GOOD",       sub:"Decent availability. Normal timing fine.",  color:"#16a34a", bg:"rgba(22,163,74,0.1)",   emoji:"✅", score: 3 };
  return           { text:"EASY",            sub:"Plenty of spaces. No rush!",                color:"#0284c7", bg:"rgba(2,132,199,0.1)",   emoji:"🅿️", score: 4 };
};

export const fmt12 = (h) => h === 0 ? "12AM" : h < 12 ? `${h}AM` : h === 12 ? "12PM" : `${h-12}PM`;
export const DAY_NAMES  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
export const DAY_SHORT  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export const timeAgo = (ms) => {
  const d = Date.now() - ms;
  if (d < 60000)   return "just now";
  if (d < 3600000) return `${Math.floor(d/60000)}m ago`;
  return `${Math.floor(d/3600000)}h ago`;
};

export const getOccupancy = (dayOfWeek, hour, weatherDelta = 0, disruptDelta = 0) => {
  const base = (dayOfWeek === 0 || dayOfWeek === 6) ? WEEKEND_OCCUPANCY : BASE_OCCUPANCY;
  return Math.min(99, Math.max(1, (base[hour] ?? 50) + weatherDelta + disruptDelta));
};

// Estimated time to find a spot based on occupancy %
export const estimateFindTime = (pct) => {
  if (pct >= 95) return { mins: "15-25", label: "Very hard", color: "#dc2626" };
  if (pct >= 85) return { mins: "8-15",  label: "Hard",      color: "#ea580c" };
  if (pct >= 70) return { mins: "3-8",   label: "Moderate",  color: "#d97706" };
  if (pct >= 45) return { mins: "1-3",   label: "Easy",      color: "#16a34a" };
  return                 { mins: "<1",   label: "Instant",   color: "#0284c7" };
};

// Storage helpers (in-memory + localStorage)
export const storage = {
  get: (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};
