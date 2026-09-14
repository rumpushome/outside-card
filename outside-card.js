/*!
 * Outside Card for Home Assistant
 * The time and the outdoor temperature, large enough to read across a room: a
 * sky that follows the sun (moon and stars at night), a thermometer marking the
 * last 24 hours' low and high, and those 24 hours as a chart.
 *
 * No build step required - drop this file in /config/www/ and add it as a
 * Lovelace resource of type "JavaScript Module".
 */

const CARD_VERSION = "1.0.1";

/* ------------------------------------------------------------------ *
 * Colour
 * ------------------------------------------------------------------ */

// Outdoor temperatures, in Celsius: icy blue -> cyan -> green -> amber -> red.
const RAMP = [[-5, "#bfdbfe"], [5, "#60a5fa"], [12, "#22d3ee"], [18, "#34d399"], [24, "#fbbf24"], [30, "#fb923c"], [36, "#ef4444"]];
const UNKNOWN = "#94a3b8";

function hex(h) {
  return [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16));
}

function mix(a, b, f) {
  const pa = hex(a), pb = hex(b);
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * f).toString(16).padStart(2, "0")).join("");
}

function tempColour(c) {
  if (c <= RAMP[0][0]) return RAMP[0][1];
  for (let i = 1; i < RAMP.length; i++) {
    if (c <= RAMP[i][0]) {
      const [t0, c0] = RAMP[i - 1], [t1, c1] = RAMP[i];
      return mix(c0, c1, (c - t0) / (t1 - t0));
    }
  }
  return RAMP[RAMP.length - 1][1];
}

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const pad = (n) => String(n).padStart(2, "0");
const HOUR = 3600e3;

/* ------------------------------------------------------------------ *
 * Geometry
 * ------------------------------------------------------------------ */

// One 600x680 viewBox, so the whole card scales with its width as one piece.
// At a 616px column that's ~700px tall, leaving room for the pool card below
// on a 1080px screen.
const W = 600, H_ALL = 680, SKY = 420, STRIP = 84, CH_TOP = SKY + STRIP;
// The sun's path sits top-middle, clear of the clock and the big number at every hour.
const ARC = { x0: 270, x1: W - 126, base: 150, peak: 40 };
const arcPoint = (f) => [ARC.x0 + (ARC.x1 - ARC.x0) * f, ARC.base - (ARC.base - ARC.peak) * Math.sin(Math.PI * f)];
// Thermometer down the right-hand side.
const TH = { cx: W - 64, top: 40, bot: SKY - 96 };
// Chart plot area.
const PLOT = { x0: 18, x1: W - 22, y0: CH_TOP + 44, y1: CH_TOP + 144 };

const ICONS = {
  humidity: '<path d="M12 3c3.5 4.2 6 7.4 6 10.5A6 6 0 0 1 6 13.5C6 10.4 8.5 7.2 12 3z" fill="none" stroke="#60a5fa" stroke-width="2"/>',
  feels: '<path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0z" fill="none" stroke="#f472b6" stroke-width="2"/>',
  aqi: '<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round"/>',
  rise: '<path d="M5 18a7 7 0 0 1 14 0M3 21h18M12 4v6M9 7l3-3 3 3" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"/>',
  set: '<path d="M5 18a7 7 0 0 1 14 0M3 21h18M12 4v6M9 7l3 3 3-3" fill="none" stroke="#fb923c" stroke-width="2" stroke-linecap="round"/>',
};

/* ------------------------------------------------------------------ *
 * Styles
 * ------------------------------------------------------------------ */

const STYLE = `
  :host { display: block; }
  ha-card { overflow: hidden; }
  svg { display: block; width: 100%; height: auto; }

  .time  { font-size: 62px; font-weight: 600; letter-spacing: -1px; fill: #f1f5f9; }
  .date  { font-size: 18px; fill: #a9b8cc; }
  .label { font-size: 13px; font-weight: 700; letter-spacing: 3px; fill: #a9b8cc; }
  .temp  { font-size: 156px; font-weight: 700; letter-spacing: -6px; transition: fill 1s; }
  .temp .unit { font-size: 54px; letter-spacing: 0; }
  .sub   { font-size: 20px; fill: #d5dde8; }

  .k   { font-size: 11.5px; font-weight: 700; letter-spacing: 2px; fill: var(--secondary-text-color, #8a94a6); }
  .v   { font-size: 27px; font-weight: 600; fill: var(--primary-text-color, #e5e7eb); }
  .v .s { font-size: 14px; fill: var(--secondary-text-color, #8a94a6); }
  .hd  { font-size: 11.5px; font-weight: 700; letter-spacing: 2px; fill: var(--secondary-text-color, #8a94a6); }
  .ax  { font-size: 12px; fill: var(--secondary-text-color, #8a94a6); }
  .empty { font-size: 15px; fill: var(--secondary-text-color, #8a94a6); }
  .rule { stroke: var(--divider-color, rgba(255, 255, 255, .1)); stroke-width: 1; }

  .skyday, .sun { transition: opacity 1.2s; }
  .stars, .moon { opacity: 0; transition: opacity 1.2s; }
  .night .skyday, .night .sun { opacity: 0; }
  .night .stars, .night .moon { opacity: 1; }
  .hill1 { fill: #1b3553; transition: fill 1.2s; }
  .hill2 { fill: #132840; transition: fill 1.2s; }
  .house { fill: #10233a; transition: fill 1.2s; }
  .win   { fill: #1d3a5c; transition: fill 1.2s; }
  .night .hill1 { fill: #0a1526; }
  .night .hill2 { fill: #070f1c; }
  .night .house { fill: #060d18; }
  .night .win   { fill: #fbbf24; }

  .twinkle { animation: tw 3.4s ease-in-out infinite; }
  .rays  { transform-box: fill-box; transform-origin: center; animation: spin 60s linear infinite; }
  .pulse { transform-box: fill-box; transform-origin: center; animation: pulse 2s ease-out infinite; }
  @keyframes tw    { 50% { opacity: .25; } }
  @keyframes spin  { to { transform: rotate(360deg); } }
  @keyframes pulse { 0% { transform: scale(1); opacity: .7; } 100% { transform: scale(3.2); opacity: 0; } }

  .no-anim * { animation: none !important; }
  @media (prefers-reduced-motion: reduce) { .oc * { animation: none !important; } }
`;

/* ------------------------------------------------------------------ *
 * Scene: everything that never changes shape. Live values are patched in.
 * ------------------------------------------------------------------ */

// `u` prefixes every id so two cards on one dashboard can't share gradients.
// `cells` lists the strip's columns; `scale` is the thermometer's [min, max].
function scene(u, cells, scale) {
  let arc = `M${ARC.x0},${ARC.base}`;
  for (let i = 1; i <= 40; i++) {
    const [x, y] = arcPoint(i / 40);
    arc += ` L${x.toFixed(1)},${y.toFixed(1)}`;
  }

  const STARS = [[70, 40], [150, 120], [240, 36], [330, 96], [420, 26], [470, 132], [300, 186], [120, 214], [210, 150]];
  const stars = STARS.map(([x, y], i) =>
    `<circle class="twinkle" cx="${x}" cy="${y}" r="${1.2 + (i % 3) * .4}" fill="#e2e8f0" style="animation-delay:${(i * .45).toFixed(2)}s"/>`).join("");

  // Thermometer ticks, every tenth of the scale.
  const [lo, hi] = scale;
  const step = (hi - lo) / 4;
  let ticks = "";
  for (let i = 0; i <= 4; i++) {
    const t = lo + step * i, y = TH.bot - (TH.bot - TH.top) * i / 4;
    ticks += `<line x1="${TH.cx - 18}" x2="${TH.cx - 12}" y1="${y}" y2="${y}" stroke="#8fa1bb" stroke-width="2"/>`
      + `<text x="${TH.cx - 22}" y="${y + 4}" text-anchor="end" font-size="12" fill="#8fa1bb">${Math.round(t)}</text>`;
  }

  // Strip: equal columns with a rule between each.
  const cw = W / Math.max(1, cells.length);
  const strip = cells.map((c, i) => {
    const x = i * cw + 16;
    return (i ? `<line class="rule" x1="${i * cw}" x2="${i * cw}" y1="${SKY}" y2="${CH_TOP}"/>` : "")
      + `<svg x="${x}" y="${SKY + 17}" width="16" height="16" viewBox="0 0 24 24">${ICONS[c.icon]}</svg>`
      + `<text class="k" x="${x + 23}" y="${SKY + 30}">${esc(c.label)}</text>`
      + `<text class="v" x="${x}" y="${SKY + 66}" data-el="v-${c.key}">—</text>`;
  }).join("");

  const H = SKY;
  return `
<svg viewBox="0 0 ${W} ${H_ALL}" role="img">
  <defs>
    <linearGradient id="${u}-skyD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#15325a"/><stop offset="1" stop-color="#2b5f92"/></linearGradient>
    <linearGradient id="${u}-skyN" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050a14"/><stop offset="1" stop-color="#0f1d35"/></linearGradient>
    <radialGradient id="${u}-sun"><stop offset="0" stop-color="#ffd66b" stop-opacity=".55"/><stop offset="1" stop-color="#ffd66b" stop-opacity="0"/></radialGradient>
    <linearGradient id="${u}-glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f59e0b" stop-opacity="0"/><stop offset="1" stop-color="#f59e0b" stop-opacity=".55"/></linearGradient>
    <mask id="${u}-moon"><circle r="14" fill="#fff"/><circle cx="7" cy="-5" r="12" fill="#000"/></mask>
    <clipPath id="${u}-sky"><rect width="${W}" height="${H}"/></clipPath>
    <linearGradient id="${u}-line" data-el="lineGrad" gradientUnits="userSpaceOnUse" x1="0" y1="${PLOT.y0}" x2="0" y2="${PLOT.y1}"></linearGradient>
  </defs>

  <g clip-path="url(#${u}-sky)">
    <rect width="${W}" height="${H}" fill="url(#${u}-skyN)"/>
    <rect class="skyday" width="${W}" height="${H}" fill="url(#${u}-skyD)"/>
    <rect data-el="glow" y="${H * .45}" width="${W}" height="${H * .55}" fill="url(#${u}-glow)" opacity="0"/>
    <g class="stars">${stars}</g>

    <g data-el="arc">
      <path d="M${ARC.x0 - 14},${ARC.base} H${ARC.x1 + 14}" stroke="#fff" stroke-opacity=".12" stroke-width="2" stroke-linecap="round"/>
      <path d="${arc}" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="2" stroke-dasharray="3 9" stroke-linecap="round"/>
      <g data-el="orb" transform="translate(${ARC.x0},${ARC.base})">
        <g class="sun">
          <circle r="46" fill="url(#${u}-sun)"/>
          <g class="rays"><path d="M0,-30V-22M0,30V22M-30,0H-22M30,0H22M-21,-21L-16,-16M21,21L16,16M-21,21L-16,16M21,-21L16,-16"
            stroke="#ffd66b" stroke-width="3" stroke-linecap="round" opacity=".7"/></g>
          <circle data-el="sunCore" r="14" fill="#ffd66b"/>
        </g>
        <g class="moon"><circle r="14" fill="#e2e8f0" mask="url(#${u}-moon)"/></g>
      </g>
    </g>

    <path class="hill1" d="M0,${H - 44} C${W * .18},${H - 72} ${W * .34},${H - 50} ${W * .5},${H - 60} S${W * .82},${H - 78} ${W},${H - 52} V${H} H0Z"/>
    <path class="hill2" d="M0,${H - 26} C${W * .25},${H - 44} ${W * .55},${H - 20} ${W},${H - 36} V${H} H0Z"/>
    <g class="house" transform="translate(${W * .6},${H - 58})">
      <rect x="0" y="0" width="54" height="30"/><path d="M-6,1 L27,-20 L60,1Z"/>
      <rect class="win" x="18" y="10" width="12" height="10"/>
      <circle cx="84" cy="-6" r="20"/><rect x="81" y="8" width="6" height="22"/>
    </g>

    <g data-el="thermo">
      ${ticks}
      <rect x="${TH.cx - 12}" y="${TH.top - 10}" width="24" height="${TH.bot - TH.top + 22}" rx="12" fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.35)" stroke-width="1.5"/>
      <rect data-el="band" x="${TH.cx - 5}" width="10" rx="5" fill="#fff" opacity=".1" y="${TH.bot}" height="0"/>
      <rect data-el="merc" x="${TH.cx - 6}" width="12" rx="6" y="${TH.bot}" height="12" fill="${UNKNOWN}"/>
      <circle data-el="bulb" cx="${TH.cx}" cy="${TH.bot + 26}" r="21" fill="${UNKNOWN}" stroke="rgba(255,255,255,.35)" stroke-width="1.5"/>
      <circle cx="${TH.cx - 6}" cy="${TH.bot + 20}" r="6" fill="#fff" opacity=".35"/>
      <circle data-el="mPulse" class="pulse" cx="${TH.cx}" cy="${TH.bot}" r="9" fill="${UNKNOWN}" opacity=".45"/>
      <g data-el="hiMark" style="display:none"><path d="M0,0 l9,-6 v12z"/><text x="12" y="5" font-size="13" font-weight="700"></text></g>
      <g data-el="loMark" style="display:none"><path d="M0,0 l9,-6 v12z"/><text x="12" y="5" font-size="13" font-weight="700"></text></g>
    </g>
  </g>

  <text class="time" data-el="time" x="28" y="80"></text>
  <text class="date" data-el="date" x="30" y="112"></text>
  <text class="label" data-el="label" x="30" y="190"></text>
  <text class="temp" data-el="temp" x="22" y="330"><tspan data-el="tempVal">—</tspan><tspan class="unit" data-el="tempUnit" dx="8" dy="-82"></tspan></text>
  <text class="sub" data-el="sub" x="30" y="372"></text>

  <line class="rule" x1="0" x2="${W}" y1="${SKY + .5}" y2="${SKY + .5}"/>
  <line class="rule" x1="0" x2="${W}" y1="${CH_TOP - .5}" y2="${CH_TOP - .5}"/>
  ${strip}

  <text class="hd" x="${PLOT.x0}" y="${CH_TOP + 28}" data-el="chartTitle"></text>
  <text class="hd" x="${W - 18}" y="${CH_TOP + 28}" text-anchor="end" data-el="range"></text>
  <g data-el="chart"></g>
</svg>`;
}

/* ------------------------------------------------------------------ *
 * Card
 * ------------------------------------------------------------------ */

const num = (v, d) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? d : Number(v));
const HISTORY_REFRESH = 10 * 60e3;

class OutsideCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._built = false;
    this._els = null;
    this._last = {};
    this._hist = null;          // [{t, v}] readings, oldest first
    this._histVersion = 0;
    this._fetchedAt = 0;
    this._fetching = false;
    this._timer = null;
    this._minute = -1;
    this._uid = "oc" + Math.random().toString(36).slice(2, 8);
  }

  connectedCallback() {
    // The clock and the sun move on their own; everything else follows hass.
    if (!this._timer) this._timer = setInterval(() => this._tick(), 1000);
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    this._timer = null;
  }

  static getConfigElement() {
    return document.createElement("outside-card-editor");
  }

  static getStubConfig(hass) {
    const find = (re) => (hass && hass.states
      ? Object.keys(hass.states).find((id) => id.startsWith("sensor.") && re.test(id)) : undefined);
    return {
      type: "custom:outside-card",
      entity: find(/(outdoor|outside).*temp/i),
      humidity_entity: find(/(outdoor|outside).*humid/i),
    };
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    if (!config.entity) throw new Error("Define entity (the outdoor temperature sensor)");
    const prev = this._config;
    this._config = Object.assign(
      {
        entity: null,
        humidity_entity: null,
        feels_like_entity: null,
        aqi_entity: null,
        sun_entity: "sun.sun",
        name: "Outside",
        show_clock: true,
        time_format: 24,
        locale: null,
        hours_to_show: 24,
        round: 1,
        min: null,
        max: null,
        animate: true,
      },
      config
    );
    this._config.hours_to_show = Math.max(1, Math.min(168, num(this._config.hours_to_show, 24)));
    if (!prev || prev.entity !== this._config.entity || prev.hours_to_show !== this._config.hours_to_show) {
      this._hist = null;
      this._fetchedAt = 0;
    }
    this._built = false;
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    // The picture never changes shape, so updates are targeted patches: a
    // rebuild would restart the sun, stars and pulse on every sensor tick.
    if (!this._built) this._render();
    else this._apply();
    this._maybeFetch();
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    return 7;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  /* --------------------------- readings --------------------------- */

  _st(id) {
    if (!id || !this._hass || !this._hass.states) return undefined;
    return this._hass.states[id];
  }

  _num(id) {
    const st = this._st(id);
    if (!st) return null;
    const v = parseFloat(st.state);
    return Number.isFinite(v) ? v : null;
  }

  _unit() {
    const st = this._st(this._config.entity);
    return (st && st.attributes && st.attributes.unit_of_measurement) || "°C";
  }

  // Colours are chosen in Celsius whatever the sensor reports.
  _colour(v) {
    if (v === null || v === undefined) return UNKNOWN;
    return tempColour(/F/i.test(this._unit()) ? (v - 32) * 5 / 9 : v);
  }

  _cells() {
    const c = this._config, out = [];
    if (c.humidity_entity) out.push({ key: "hum", icon: "humidity", label: "HUMIDITY" });
    if (c.aqi_entity) out.push({ key: "aqi", icon: "aqi", label: "AIR" });
    if (this._sun()) {
      out.push({ key: "rise", icon: "rise", label: "SUNRISE" });
      out.push({ key: "set", icon: "set", label: "SUNSET" });
    }
    return out;
  }

  _sun() {
    const st = this._st(this._config.sun_entity);
    if (!st || !st.attributes) return null;
    const rise = Date.parse(st.attributes.next_rising), set = Date.parse(st.attributes.next_setting);
    return Number.isFinite(rise) && Number.isFinite(set) ? { st, rise, set } : null;
  }

  // Where the sun (or moon) is along its arc, 0 = rise, 1 = set. By day today's
  // sunrise is a day before the next one; by night the sunset just passed is a
  // day before the next.
  _sunState(now) {
    const s = this._sun();
    if (!s) return null;
    const day = s.st.state === "above_horizon";
    let f, low = 0;
    if (day) {
      const rise = s.rise - 24 * HOUR, set = s.set;
      f = (now - rise) / (set - rise);
      low = Math.max(0, 1 - Math.min(now - rise, set - now) / (1.6 * HOUR));
    } else {
      const set = s.set - 24 * HOUR, rise = s.rise;
      f = (now - set) / (rise - set);
    }
    return { day, f: Math.max(0, Math.min(1, f)), low: Math.min(1, low), rise: s.rise, set: s.set };
  }

  _lang() {
    const h = this._hass;
    return this._config.locale || (h && h.locale && h.locale.language) || (h && h.language) || "en-GB";
  }

  _fmtTime(ms) {
    const d = new Date(ms);
    if (Number(this._config.time_format) === 12) return `${d.getHours() % 12 || 12}:${pad(d.getMinutes())}`;
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /* ---------------------------- history --------------------------- */

  _maybeFetch() {
    if (!this._hass || !this._config || this._fetching || typeof this._hass.callWS !== "function") return;
    if (this._hist && Date.now() - this._fetchedAt < HISTORY_REFRESH) return;
    this._fetch();
  }

  async _fetch() {
    const id = this._config.entity, hours = this._config.hours_to_show;
    this._fetching = true;
    const end = Date.now(), start = end - hours * HOUR - 30 * 60e3;
    try {
      const res = await this._hass.callWS({
        type: "history/history_during_period",
        start_time: new Date(start).toISOString(),
        end_time: new Date(end).toISOString(),
        entity_ids: [id],
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      });
      const pts = [];
      for (const r of (res && res[id]) || []) {
        const v = parseFloat(r.s !== undefined ? r.s : r.state);
        const t = r.lu !== undefined ? r.lu * 1000 : r.lc !== undefined ? r.lc * 1000
          : Date.parse(r.last_updated || r.last_changed);
        if (Number.isFinite(v) && Number.isFinite(t)) pts.push({ t, v });
      }
      pts.sort((a, b) => a.t - b.t);
      // Ignore a late answer for an entity the config has since moved away from.
      if (this._config.entity === id) {
        this._hist = pts;
        this._histVersion++;
      }
    } catch (err) {
      if (!this._hist) this._hist = [];
    }
    this._fetchedAt = Date.now();
    this._fetching = false;
    if (this._built) this._apply();
  }

  // Live readings are appended between fetches, so the chart's right-hand end
  // is always the reading on screen.
  _appendLive() {
    const st = this._st(this._config.entity);
    if (!st || !this._hist) return;
    const v = parseFloat(st.state);
    const t = Date.parse(st.last_updated) || Date.now();
    const last = this._hist[this._hist.length - 1];
    if (!Number.isFinite(v) || (last && t <= last.t)) return;
    this._hist.push({ t, v });
    const cutoff = Date.now() - (this._config.hours_to_show + 2) * HOUR;
    while (this._hist.length > 2 && this._hist[1].t < cutoff) this._hist.shift();
    this._histVersion++;
  }

  // Readings inside the window, starting with the value carried in from before
  // it and ending with the current reading.
  _window(now) {
    const t0 = now - this._config.hours_to_show * HOUR, out = [];
    let before = null;
    for (const p of this._hist || []) {
      if (p.t < t0) before = p;
      else if (p.t <= now) out.push(p);
    }
    if (before) out.unshift({ t: t0, v: before.v });
    const cur = this._num(this._config.entity);
    if (cur !== null) out.push({ t: now, v: cur });
    return out;
  }

  /* ---------------------------- render ---------------------------- */

  _render() {
    if (!this._config || !this._hass) return;
    const c = this._config, f = /F/i.test(this._unit());
    this._scale = [num(c.min, f ? 30 : 0), num(c.max, f ? 110 : 40)];
    if (this._scale[1] <= this._scale[0]) this._scale[1] = this._scale[0] + 10;
    const cells = this._cells();
    this._cellSig = cells.map((x) => x.key).join(",");
    this.shadowRoot.innerHTML = `<style>${STYLE}</style><ha-card><div class="oc">${scene(this._uid, cells, this._scale)}</div></ha-card>`;
    const root = this.shadowRoot.querySelector(".oc");
    const els = { root, svg: root.querySelector("svg") };
    root.querySelectorAll("[data-el]").forEach((n) => { els[n.getAttribute("data-el")] = n; });
    this._els = els;
    this._last = {};
    this._built = true;
    this._apply();
  }

  _tick() {
    if (!this._built) return;
    const minute = Math.floor(Date.now() / 60000);
    if (minute === this._minute) return;
    this._minute = minute;
    this._apply();
  }

  _apply() {
    const e = this._els;
    if (!e || !this._hass) return;
    const c = this._config;
    // The strip's columns depend on which entities exist; rebuild if that changed.
    if (this._cells().map((x) => x.key).join(",") !== this._cellSig) return this._render();

    this._appendLive();
    const now = Date.now();
    const cur = this._num(c.entity), unit = this._unit();
    const r = Math.max(0, Math.min(2, Math.round(num(c.round, 1))));
    const pts = this._window(now);
    const vals = pts.map((p) => p.v);
    const lo = vals.length ? Math.min(...vals) : null, hi = vals.length ? Math.max(...vals) : null;

    e.root.classList.toggle("no-anim", c.animate === false);

    // Clock
    this._set("clock", c.show_clock !== false, (v) => { e.time.style.display = e.date.style.display = v ? "" : "none"; });
    this._text("time", this._fmtTime(now));
    this._text("date", new Date(now).toLocaleDateString(this._lang(), { weekday: "long", day: "numeric", month: "long" }));

    // The reading
    const col = this._colour(cur);
    this._text("label", String(c.name || "").toUpperCase());
    this._text("tempVal", cur === null ? "—" : cur.toFixed(r));
    this._text("tempUnit", cur === null ? "" : unit);
    this._set("tempFill", mix(col, "#ffffff", 0.15), (v) => { e.temp.style.fill = v; });
    let past = null;
    for (const p of pts) { if (p.t <= now - HOUR) past = p.v; else break; }
    const trend = cur !== null && past !== null ? cur - past : null;
    const feels = c.feels_like_entity ? this._num(c.feels_like_entity) : null;
    const sub = [];
    if (feels !== null) sub.push(`Feels like ${Math.round(feels)}°`);
    if (trend !== null) sub.push(`${trend >= 0 ? "▲" : "▼"} ${Math.abs(trend).toFixed(1)}° in the last hour`);
    this._text("sub", sub.join("  ·  "));

    // Thermometer
    const [a, b] = this._scale;
    const ty = (v) => TH.bot - Math.max(0, Math.min(1, (v - a) / (b - a))) * (TH.bot - TH.top);
    this._set("merc", cur === null ? "none" : `${ty(cur).toFixed(1)}|${col}`, () => {
      const y = cur === null ? TH.bot : ty(cur);
      e.merc.setAttribute("y", y);
      e.merc.setAttribute("height", TH.bot + 12 - y);
      e.merc.setAttribute("fill", col);
      e.bulb.setAttribute("fill", col);
      e.mPulse.setAttribute("cy", y);
      e.mPulse.setAttribute("fill", col);
      e.mPulse.style.display = cur === null ? "none" : "";
    });
    const mark = (el, v) => {
      el.style.display = v === null ? "none" : "";
      if (v === null) return;
      el.setAttribute("transform", `translate(${TH.cx + 16},${ty(v).toFixed(1)})`);
      el.setAttribute("fill", this._colour(v));
      el.querySelector("text").textContent = Math.round(v) + "°";
    };
    this._set("marks", `${lo}|${hi}`, () => {
      mark(e.hiMark, hi);
      mark(e.loMark, lo);
      e.band.setAttribute("y", hi === null ? TH.bot : ty(hi));
      e.band.setAttribute("height", hi === null ? 0 : ty(lo) - ty(hi));
    });

    // Sky
    const sun = this._sunState(now);
    e.root.classList.toggle("night", !!sun && !sun.day);
    this._set("arc", !!sun, (v) => { e.arc.style.display = v ? "" : "none"; });
    if (sun) {
      const [x, y] = arcPoint(sun.f);
      this._set("orb", `${x.toFixed(1)},${y.toFixed(1)}`, (v) => { e.orb.setAttribute("transform", `translate(${v})`); });
      this._set("glow", sun.day ? sun.low.toFixed(2) : "0", (v) => { e.glow.setAttribute("opacity", v); });
      this._set("core", sun.low > 0.4 ? "#ffb347" : "#ffd66b", (v) => { e.sunCore.setAttribute("fill", v); });
      this._html("v-rise", this._fmtTime(sun.rise));
      this._html("v-set", this._fmtTime(sun.set));
    }

    // Strip
    if (c.humidity_entity) {
      const h = this._num(c.humidity_entity);
      this._html("v-hum", h === null ? "—" : `${Math.round(h)}<tspan class="s" dx="4">%</tspan>`);
    }
    if (c.aqi_entity) {
      const q = this._num(c.aqi_entity);
      const [word, qc] = q === null ? ["", ""] : q <= 50 ? ["Good", "#4ade80"] : q <= 100 ? ["Moderate", "#fbbf24"] : ["Poor", "#f87171"];
      this._html("v-aqi", q === null ? "—" : `${Math.round(q)}<tspan class="s" dx="6" style="fill:${qc}">${word}</tspan>`);
    }

    // Chart: redrawn at most once a minute, or when new readings arrive.
    this._text("chartTitle", `LAST ${c.hours_to_show} HOURS`);
    this._text("range", lo === null ? "" : `LOW ${lo.toFixed(1)}° · HIGH ${hi.toFixed(1)}°`);
    this._set("chart", `${this._histVersion}|${cur}|${Math.floor(now / 60000)}|${!!sun}`, () => {
      e.chart.innerHTML = this._chartSvg(pts, now, sun);
    });

    this._set("aria", `${c.name || "Outside"} ${cur === null ? "unavailable" : cur.toFixed(r) + unit}`,
      (v) => { e.svg.setAttribute("aria-label", v); });
  }

  _chartSvg(pts, now, sun) {
    if (pts.length < 2 || this._hist === null) {
      const msg = this._hist === null ? "Loading history…" : "Not enough history yet";
      return `<text class="empty" x="${W / 2}" y="${(PLOT.y0 + PLOT.y1) / 2}" text-anchor="middle">${msg}</text>`;
    }
    const span = this._config.hours_to_show * HOUR, t0 = now - span;
    const vals = pts.map((p) => p.v);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const mn = Math.floor(lo - 1), mx = Math.ceil(hi + 1);
    const X = (t) => PLOT.x0 + (t - t0) / span * (PLOT.x1 - PLOT.x0);
    const Y = (v) => PLOT.y0 + (mx - v) / (mx - mn) * (PLOT.y1 - PLOT.y0);

    let stops = "";
    for (let i = 0; i <= 6; i++) stops += `<stop offset="${i / 6}" stop-color="${this._colour(mx - (mx - mn) * i / 6)}"/>`;
    this._els.lineGrad.innerHTML = stops;

    // Thin the line to one point per few minutes; keep the extremes exact.
    const stepMs = Math.max(60e3, span / 300);
    const line = [];
    let bucket = -1;
    pts.forEach((p, i) => {
      const k = Math.floor((p.t - t0) / stepMs);
      if (k !== bucket || i === pts.length - 1 || p.v === lo || p.v === hi) line.push(p);
      bucket = k;
    });
    const d = line.map((p, i) => (i ? "L" : "M") + X(p.t).toFixed(1) + "," + Y(p.v).toFixed(1)).join(" ");

    // Night shading, from the sun's times of day.
    let night = "";
    if (sun) {
      const setH = new Date(sun.set), riseH = new Date(sun.rise);
      for (let k = -2; k <= 1; k++) {
        const day = new Date(now);
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() + k);
        const s = new Date(day); s.setHours(setH.getHours(), setH.getMinutes());
        const e = new Date(day); e.setDate(e.getDate() + 1); e.setHours(riseH.getHours(), riseH.getMinutes());
        const xa = Math.max(PLOT.x0, X(s.getTime())), xb = Math.min(PLOT.x1, X(e.getTime()));
        if (xb > xa) night += `<rect x="${xa.toFixed(1)}" y="${PLOT.y0 - 6}" width="${(xb - xa).toFixed(1)}" height="${PLOT.y1 - PLOT.y0 + 6}" fill="#94a3b8" opacity=".07" rx="4"/>`;
      }
    }

    let labels = "";
    for (let i = 0; i <= 4; i++) {
      const t = t0 + span * i / 4;
      const anchor = i === 0 ? "start" : i === 4 ? "end" : "middle";
      labels += `<text class="ax" x="${X(t).toFixed(1)}" y="${PLOT.y1 + 22}" text-anchor="${anchor}">${i === 4 ? "now" : this._fmtTime(t)}</text>`;
    }

    // Both labels sit above their point: below the low one would hit the time axis.
    const pick = (v) => pts.find((p) => p.v === v);
    const mark = (p) => {
      const cx = X(p.t), cy = Y(p.v), fill = this._colour(p.v);
      return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4" fill="${fill}"/>`
        + `<text x="${Math.min(PLOT.x1 - 8, Math.max(PLOT.x0 + 8, cx)).toFixed(1)}" y="${(cy - 10).toFixed(1)}" text-anchor="middle" font-size="12.5" font-weight="700" fill="${fill}">${p.v.toFixed(1)}°</text>`;
    };
    const last = pts[pts.length - 1], nx = X(last.t), ny = Y(last.v), nc = this._colour(last.v);
    const u = this._uid;
    return `${night}
      <path d="${d} L${nx.toFixed(1)},${PLOT.y1} L${PLOT.x0},${PLOT.y1}Z" fill="url(#${u}-line)" opacity=".2"/>
      <path d="${d}" fill="none" stroke="url(#${u}-line)" stroke-width="3" stroke-linejoin="round"/>
      ${mark(pick(hi))}${lo !== hi ? mark(pick(lo)) : ""}
      <circle class="pulse" cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="6" fill="${nc}"/>
      <circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="5.5" fill="${nc}" stroke="var(--card-background-color, #1d1e21)" stroke-width="2"/>
      ${labels}`;
  }

  // Write only what changed: sensors tick often, and most ticks change nothing.
  _set(key, value, fn) {
    if (this._last[key] === value) return;
    this._last[key] = value;
    fn(value);
  }

  _text(key, value) {
    if (this._els[key]) this._set(key, value, (v) => { this._els[key].textContent = v; });
  }

  _html(key, value) {
    if (this._els[key]) this._set(key, value, (v) => { this._els[key].innerHTML = v; });
  }
}

/* ------------------------------------------------------------------ *
 * Visual editor
 * ------------------------------------------------------------------ */

const SCHEMA = [
  { name: "entity", selector: { entity: { domain: ["sensor"] } } },
  { name: "humidity_entity", selector: { entity: { domain: ["sensor"] } } },
  { name: "sun_entity", selector: { entity: { domain: ["sun"] } } },
  { name: "feels_like_entity", selector: { entity: { domain: ["sensor"] } } },
  { name: "aqi_entity", selector: { entity: { domain: ["sensor"] } } },
  { name: "name", selector: { text: {} } },
  {
    type: "grid",
    schema: [
      { name: "show_clock", selector: { boolean: {} } },
      { name: "animate", selector: { boolean: {} } },
      { name: "time_format", selector: { select: { mode: "dropdown", options: [{ value: "24", label: "24-hour" }, { value: "12", label: "12-hour" }] } } },
      { name: "locale", selector: { text: {} } },
      { name: "round", selector: { number: { min: 0, max: 2, mode: "box" } } },
      { name: "hours_to_show", selector: { number: { min: 1, max: 168, mode: "box" } } },
      { name: "min", selector: { number: { mode: "box", step: "any" } } },
      { name: "max", selector: { number: { mode: "box", step: "any" } } },
    ],
  },
];

const LABELS = {
  entity: "Outdoor temperature",
  humidity_entity: "Humidity (optional)",
  sun_entity: "Sun, for the sky and sunrise/sunset",
  feels_like_entity: "Feels-like temperature (optional)",
  aqi_entity: "Air quality index (optional)",
  name: "Label above the temperature",
  show_clock: "Show the clock",
  animate: "Animations",
  time_format: "Clock format",
  locale: "Date language, e.g. en-GB (blank = HA's)",
  round: "Decimal places",
  hours_to_show: "Chart hours",
  min: "Thermometer bottom (blank = auto)",
  max: "Thermometer top (blank = auto)",
};

// Toggles that default on would show as off while their key is absent.
const FORM_DEFAULTS = { show_clock: true, animate: true, time_format: "24" };

class OutsideCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._form = null;
  }

  setConfig(config) {
    this._config = Object.assign({}, config);
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
  }

  _render() {
    if (!this._form) {
      const form = document.createElement("ha-form");
      form.computeLabel = (s) => LABELS[s.name] || s.name;
      form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const next = Object.assign({}, ev.detail.value);
        Object.keys(next).forEach((k) => {
          if (next[k] === "" || next[k] === undefined || next[k] === null) delete next[k];
        });
        if (next.time_format !== undefined) next.time_format = Number(next.time_format);
        this._config = next;
        this.dispatchEvent(new CustomEvent("config-changed", {
          detail: { config: next }, bubbles: true, composed: true,
        }));
      });
      this.shadowRoot.appendChild(form);
      this._form = form;
    }
    this._form.schema = SCHEMA;
    const data = Object.assign({}, FORM_DEFAULTS, this._config);
    if (data.time_format !== undefined) data.time_format = String(data.time_format);
    this._form.data = data;
    if (this._hass) this._form.hass = this._hass;
  }
}

customElements.define("outside-card", OutsideCard);
customElements.define("outside-card-editor", OutsideCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "outside-card",
  name: "Outside Card",
  description: "Clock, outdoor temperature, the sun's path and the last 24 hours.",
  preview: true,
});

console.info(
  "%c OUTSIDE-CARD %c v" + CARD_VERSION + " ",
  "color: #06202a; background: #22d3ee; font-weight: 700;",
  "color: #22d3ee; background: #222; font-weight: 700;"
);
