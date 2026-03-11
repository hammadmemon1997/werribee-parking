// SEO landing page generator for all 13 Werribee line stations
const fs = require('fs');
const path = require('path');

const stations = [
  { id:'werribee',   name:'Werribee',          suburb:'Werribee',        lga:'Wyndham',      spots:120, zone:2, desc:'Park & ride at Werribee Station — the start of the Werribee line. Free parking, Zone 2 Myki.' },
  { id:'hoppers',    name:'Hoppers Crossing',   suburb:'Hoppers Crossing',lga:'Wyndham',      spots:350, zone:2, desc:'Hoppers Crossing Station has one of the largest commuter car parks on the Werribee line with 350+ spaces.' },
  { id:'williams',   name:'Williams Landing',   suburb:'Williams Landing', lga:'Wyndham',      spots:400, zone:2, desc:'Williams Landing Station serves the fast-growing Point Cook and Williams Landing suburbs. 400-space car park.' },
  { id:'aircraft',   name:'Aircraft',           suburb:'Point Cook',      lga:'Wyndham',      spots:180, zone:2, desc:'Aircraft Station at the edge of Point Cook — 180 parking spaces, quieter than Williams Landing.' },
  { id:'laverton',   name:'Laverton',           suburb:'Laverton',        lga:'Hobsons Bay',  spots:580, zone:1, desc:'Laverton Station has Melbourne\'s largest Werribee line car park with 580+ spaces. Zone 1 Myki boundary station.' },
  { id:'westona',    name:'Westona',            suburb:'Altona North',    lga:'Hobsons Bay',  spots:80,  zone:1, desc:'Westona is a quiet station in Altona North with 80 car spaces — often less busy than neighbouring stations.' },
  { id:'altona',     name:'Altona',             suburb:'Altona',          lga:'Hobsons Bay',  spots:110, zone:1, desc:'Altona Station near the beach — 110 car spaces, Zone 1 Myki. Good alternative to busier Laverton.' },
  { id:'seaholme',   name:'Seaholme',           suburb:'Seaholme',        lga:'Hobsons Bay',  spots:60,  zone:1, desc:'Seaholme is a small station with just 60 spaces — fills early. Consider Altona or Newport as alternatives.' },
  { id:'newport',    name:'Newport',            suburb:'Newport',         lga:'Hobsons Bay',  spots:90,  zone:1, desc:'Newport Station serves the Newport and Williamstown community — 90 spaces, with ongoing works reducing capacity.' },
  { id:'spotswood',  name:'Spotswood',          suburb:'Spotswood',       lga:'Hobsons Bay',  spots:70,  zone:1, desc:'Spotswood Station near the Museum of Industry — 70 parking spaces, well-connected inner-west Melbourne.' },
  { id:'yarraville', name:'Yarraville',         suburb:'Yarraville',      lga:'Maribyrnong',  spots:50,  zone:1, desc:'Yarraville is a popular inner-west suburb. The station has only 50 spaces — fills very early on weekdays.' },
  { id:'seddon',     name:'Seddon',             suburb:'Seddon',          lga:'Maribyrnong',  spots:30,  zone:1, desc:'Seddon Station in the inner west — just 30 spaces, frequently full. Street parking on Somerville Rd is the main option.' },
  { id:'footscray',  name:'Footscray',          suburb:'Footscray',       lga:'Maribyrnong',  spots:0,   zone:1, desc:'Footscray is a major interchange with no dedicated commuter car park — street parking and paid lots nearby.' },
];

function generatePage(st) {
  const hasParking = st.spots > 0;
  const spotsTxt = hasParking ? `${st.spots} spaces` : 'No dedicated car park';
  const zoneTxt = `Zone ${st.zone}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${st.name} Station Parking — Live Availability | ParkWest</title>
<meta name="description" content="Check ${st.name} Station parking availability in real time. ${st.desc} Free app for Melbourne commuters on the Werribee line."/>
<meta name="keywords" content="${st.name} station parking, ${st.suburb} train station parking, Werribee line parking, ${st.lga} commuter parking, Melbourne train parking"/>
<link rel="canonical" href="https://werribee-parking.vercel.app/${st.id}"/>
<meta property="og:title" content="${st.name} Station Parking — Live Availability"/>
<meta property="og:description" content="${st.desc}"/>
<meta property="og:url" content="https://werribee-parking.vercel.app/${st.id}"/>
<meta property="og:type" content="website"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#faf7f2;color:#1a1208;font-family:'DM Sans',sans-serif;min-height:100vh}
.hdr{background:rgba(250,247,242,.96);border-bottom:1px solid rgba(0,0,0,.08);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;backdrop-filter:blur(16px);z-index:10}
.logo{font-family:'Syne',sans-serif;font-size:18px;font-weight:800;text-decoration:none;color:#1a1208}.logo span{color:#2563eb}
.open-btn{background:#2563eb;color:#fff;border:none;border-radius:12px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;text-decoration:none}
.wrap{max-width:680px;margin:0 auto;padding:32px 20px 60px}
.breadcrumb{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:2px;color:#8a7d6b;margin-bottom:20px}
.breadcrumb a{color:#8a7d6b;text-decoration:none}.breadcrumb a:hover{color:#2563eb}
h1{font-family:'Syne',sans-serif;font-size:32px;font-weight:800;letter-spacing:-1px;margin-bottom:8px;line-height:1.1}
.subtitle{font-size:15px;color:#8a7d6b;margin-bottom:28px;line-height:1.5}
.stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px}
.stat{background:#fff;border:1.5px solid rgba(0,0,0,.08);border-radius:16px;padding:16px;text-align:center}
.stat-val{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;margin-bottom:4px}
.stat-lbl{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:2px;color:#8a7d6b}
.live-card{background:#fff;border:1.5px solid rgba(0,0,0,.08);border-radius:20px;padding:24px;margin-bottom:24px;text-align:center}
.live-card h2{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;margin-bottom:8px}
.live-card p{color:#8a7d6b;font-size:13px;margin-bottom:18px}
.app-btn{display:inline-block;background:#2563eb;color:#fff;text-decoration:none;border-radius:14px;padding:14px 28px;font-size:15px;font-weight:700;font-family:'Syne',sans-serif;letter-spacing:.3px}
.app-btn:hover{background:#1d4ed8}
.info-section{margin-bottom:24px}
.info-section h2{font-family:'Syne',sans-serif;font-size:18px;font-weight:800;margin-bottom:10px}
.info-section p{font-size:14px;line-height:1.7;color:#374151;margin-bottom:10px}
.tip-list{list-style:none;padding:0}
.tip-list li{font-size:13px;color:#374151;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.06);display:flex;gap:10px;line-height:1.5}
.tip-list li:last-child{border-bottom:none}
.nearby-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
.nearby-card{background:#fff;border:1.5px solid rgba(0,0,0,.08);border-radius:14px;padding:14px}
.nearby-card a{font-size:13px;color:#2563eb;text-decoration:none;font-weight:600}
.nearby-card p{font-size:11px;color:#8a7d6b;margin-top:3px}
footer{border-top:1px solid rgba(0,0,0,.08);padding:24px 20px;text-align:center;font-size:12px;color:#8a7d6b;font-family:'DM Mono',monospace}
footer a{color:#2563eb;text-decoration:none}
@media(max-width:480px){.stat-grid{grid-template-columns:repeat(2,1fr)}.nearby-grid{grid-template-columns:1fr}h1{font-size:26px}}
</style>
<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"Place",
  "name":"${st.name} Railway Station",
  "description":"${st.desc}",
  "address":{
    "@type":"PostalAddress",
    "addressLocality":"${st.suburb}",
    "addressRegion":"VIC",
    "addressCountry":"AU"
  },
  "amenityFeature":[
    {"@type":"LocationFeatureSpecification","name":"Car Park","value":${hasParking}},
    {"@type":"LocationFeatureSpecification","name":"Parking Spaces","value":${st.spots}},
    {"@type":"LocationFeatureSpecification","name":"Myki Zone","value":"${zoneTxt}"}
  ]
}
</script>
</head>
<body>
<header class="hdr">
  <a href="/" class="logo">Park<span>West</span></a>
  <a href="/?station=${st.id}" class="open-btn">Check Live →</a>
</header>

<div class="wrap">
  <div class="breadcrumb">
    <a href="/">ParkWest</a> › <a href="/stations">Werribee Line</a> › ${st.name}
  </div>

  <h1>${st.name} Station Parking</h1>
  <p class="subtitle">${st.desc}</p>

  <div class="stat-grid">
    <div class="stat">
      <div class="stat-val" style="color:${hasParking?'#16a34a':'#8a7d6b'}">${hasParking?st.spots:'—'}</div>
      <div class="stat-lbl">TOTAL SPACES</div>
    </div>
    <div class="stat">
      <div class="stat-val" style="color:#2563eb">${zoneTxt}</div>
      <div class="stat-lbl">MYKI ZONE</div>
    </div>
    <div class="stat">
      <div class="stat-val">~40 min</div>
      <div class="stat-lbl">TO CITY</div>
    </div>
  </div>

  <div class="live-card">
    <h2>🚦 Is ${st.name} parking full right now?</h2>
    <p>ParkWest uses real-time occupancy modelling, live PTV disruption data, and weather to predict parking availability — updated every 10 minutes.</p>
    <a href="/?station=${st.id}" class="app-btn">Check Live Availability →</a>
  </div>

  <div class="info-section">
    <h2>About ${st.name} Station Parking</h2>
    <p>${st.desc}</p>
    ${hasParking ? `<p>The car park at ${st.name} is free for commuters with a Myki card (${zoneTxt}). Spaces are allocated on a first-come, first-served basis — no reservations available.</p>` : `<p>There is no dedicated commuter car park at ${st.name}. Street parking is available on surrounding streets, though time limits may apply. Paid parking is also available nearby.</p>`}
    <p>Peak times are typically 7:00am–8:30am on weekdays. Arrive before 7:30am for the best chance of a space. On rainy days, occupancy is typically 10–15% higher than normal.</p>
  </div>

  <div class="info-section">
    <h2>Tips for parking at ${st.name}</h2>
    <ul class="tip-list">
      <li>⏰ <span>Arrive before <strong>7:30am</strong> on weekdays to guarantee a space — the lot typically fills by 7:45–8:00am.</span></li>
      <li>🌧️ <span>On rainy days the lot fills 15–20 minutes earlier than usual — leave home earlier or consider street parking.</span></li>
      <li>📱 <span>Use <strong>ParkWest</strong> to check occupancy before you leave home — saves circling the car park.</span></li>
      ${st.zone===2 ? '<li>💰 <span>Zone 2 Myki — consider whether driving to a Zone 1 station saves money on your daily fare.</span></li>' : '<li>💰 <span>Zone 1 Myki — the most cost-effective zone for daily commuters.</span></li>'}
      <li>🚌 <span>If the lot is full, check the ParkWest <strong>Alternative Parking</strong> tab for free street parking options within walking distance.</span></li>
    </ul>
  </div>

  <div class="info-section">
    <h2>Nearby stations on the Werribee line</h2>
    <div class="nearby-grid">
      ${stations.filter(s=>s.id!==st.id).slice(0,4).map(s=>`
      <div class="nearby-card">
        <a href="/${s.id}">${s.name} Station</a>
        <p>${s.spots>0?s.spots+' spaces':'Street only'} · Zone ${s.zone}</p>
      </div>`).join('')}
    </div>
  </div>
</div>

<footer>
  <p>© 2026 <a href="/">ParkWest</a> — Free Melbourne commuter parking app · <a href="/">Check all stations →</a></p>
  <p style="margin-top:6px">Data updates every 10 min · Not affiliated with PTV or Metro Trains</p>
</footer>
</body>
</html>`;
}

// Write pages
const outDir = path.join(__dirname, 'stations');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

stations.forEach(st => {
  const dir = path.join(__dirname, st.id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'index.html'), generatePage(st));
  console.log(`✅ Generated /${st.id}/index.html`);
});

// Generate stations hub page
const hubHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Werribee Line Station Parking Guide | ParkWest</title>
<meta name="description" content="Live parking availability for all 13 stations on Melbourne's Werribee train line. Free commuter app — check before you leave home."/>
<link rel="canonical" href="https://werribee-parking.vercel.app/stations"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}body{background:#faf7f2;color:#1a1208;font-family:'DM Sans',sans-serif}
.hdr{background:rgba(250,247,242,.96);border-bottom:1px solid rgba(0,0,0,.08);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;backdrop-filter:blur(16px)}
.logo{font-family:'Syne',sans-serif;font-size:18px;font-weight:800;text-decoration:none;color:#1a1208}.logo span{color:#2563eb}
.open-btn{background:#2563eb;color:#fff;border:none;border-radius:12px;padding:9px 18px;font-size:13px;font-weight:600;font-family:'DM Sans',sans-serif;text-decoration:none}
.wrap{max-width:680px;margin:0 auto;padding:32px 20px 60px}
h1{font-family:'Syne',sans-serif;font-size:28px;font-weight:800;margin-bottom:8px}
.subtitle{color:#8a7d6b;font-size:14px;margin-bottom:28px}
.st-list{display:grid;gap:10px}
.st-row{background:#fff;border:1.5px solid rgba(0,0,0,.08);border-radius:16px;padding:16px 18px;display:flex;align-items:center;gap:14px;text-decoration:none;color:#1a1208;transition:.15s}
.st-row:hover{border-color:rgba(37,99,235,.3);background:rgba(37,99,235,.03)}
.st-name{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;flex:1}
.st-meta{font-family:'DM Mono',monospace;font-size:10px;color:#8a7d6b;text-align:right}
.z1{color:#2563eb;font-weight:600}.z2{color:#7c3aed;font-weight:600}
footer{border-top:1px solid rgba(0,0,0,.08);padding:24px;text-align:center;font-size:12px;color:#8a7d6b;font-family:'DM Mono',monospace}
footer a{color:#2563eb;text-decoration:none}
</style>
</head>
<body>
<header class="hdr">
  <a href="/" class="logo">Park<span>West</span></a>
  <a href="/" class="open-btn">Live App →</a>
</header>
<div class="wrap">
  <h1>Werribee Line Stations</h1>
  <p class="subtitle">Click any station for parking tips, live availability and street parking alternatives.</p>
  <div class="st-list">
    ${stations.map(s=>`
    <a href="/${s.id}" class="st-row">
      <div class="st-name">${s.name}</div>
      <div class="st-meta">
        <div>${s.spots>0?s.spots+' spaces':'No car park'}</div>
        <div class="${s.zone===1?'z1':'z2'}">Zone ${s.zone}</div>
      </div>
      <div style="color:#8a7d6b;font-size:18px">›</div>
    </a>`).join('')}
  </div>
</div>
<footer><a href="/">← Back to live app</a> · ParkWest — Free Melbourne commuter parking</footer>
</body>
</html>`;

fs.writeFileSync(path.join(outDir, 'index.html'), hubHtml);
console.log('✅ Generated /stations/index.html (hub)');
console.log('\nAll SEO pages generated!');
