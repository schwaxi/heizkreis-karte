// heizkreis-karte v1.0.1
// Einzeln installierbares Modul (Home Assistant Marketplace / HACS, Kategorie Dashboard).
window.customCards = window.customCards || [];
window.customCardFeatures = window.customCardFeatures || [];
// Eigener Block: Namen bleiben lokal, auch wenn mehrere Karten zusammen geladen werden.
{
// ---------------------------------------------------------------------------
// Heizkreis-Karte: Heizkoerper (Radiator) oder Fussbodenheizung als Grafik,
// eingefaerbt nach Vorlauftemperatur; laeuft die Pumpe, fliesst das Wasser und es steigt Waerme auf.
//
//   type: custom:heizkreis-karte
//   titel: Heizkreis Altbau
//   typ: radiator              # radiator | fussboden
//   vorlauf: sensor.heizkreis_vorlauf_isttemperatur
//   vorlauf_soll: sensor.heizkreis_vorlauf_solltemperatur   # optional
//   pumpe: binary_sensor.heizkreis_pumpe_an_aus             # optional
//   raum / aussen: sensor.x    # optional
//   betriebsart: select.x      # optional
//   min / max: Farbskala in °C # optional (Radiator 20..70, Fussboden 20..45)

const TYPE12 = "heizkreis-karte";

class HeizkreisKarte extends HTMLElement {
  setConfig(config) {
    if (!config?.vorlauf) throw new Error("vorlauf (Vorlauftemperatur) wird benoetigt");
    const typ = config.typ === "fussboden" ? "fussboden" : "radiator";
    this._config = { titel: "Heizkreis", ...(typ === "fussboden" ? { min: 20, max: 45 } : { min: 20, max: 70 }), ...config, typ };
    this._render();
  }

  set hass(hass) { this._hass = hass; this._update(); }

  _zahl(id) {
    const s = id && this._hass?.states[id];
    const v = s ? Number(s.state) : NaN;
    return isNaN(v) ? null : v;
  }
  _fmt(v, st = 1) { return v == null ? "–" : v.toLocaleString("de-DE", { maximumFractionDigits: st }); }
  _farbe(t) {
    const c = this._config;
    const x = Math.min(1, Math.max(0, (t - c.min) / (c.max - c.min)));
    return `hsl(${Math.round(220 - 220 * x)}, 80%, 48%)`;
  }
  _info(id) {
    if (!id) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  _grafik() {
    const wellen = (y) => `
      <g class="waerme">
        <path class="welle" d="M30 ${y} q4 -6 0 -12 q-4 -6 0 -12"/>
        <path class="welle b" d="M52 ${y} q4 -6 0 -12 q-4 -6 0 -12"/>
        <path class="welle c" d="M74 ${y} q4 -6 0 -12 q-4 -6 0 -12"/>
      </g>`;
    if (this._config.typ === "fussboden") {
      // Querschnitt: Raum, Estrich mit Rohrschlangen (von oben gesehen als Maeander), Daemmung
      let d = "M12 66";
      for (let i = 0; i < 6; i++) d += i % 2 === 0 ? " h80 a6 6 0 0 1 0 12" : " h-80 a6 6 0 0 0 0 12";
      return `
        <svg class="bild" viewBox="0 0 104 150">
          ${wellen(50)}
          <rect x="4" y="56" width="96" height="84" rx="6" class="estrich"/>
          <path class="rohr grund" d="${d} h80"/>
          <path class="rohr fluss" d="${d} h80"/>
          <rect x="4" y="56" width="96" height="84" rx="6" fill="none" stroke="var(--divider-color, #888)" stroke-width="2"/>
          <rect x="4" y="142" width="96" height="6" rx="2" fill="var(--divider-color, #999)" opacity=".5"/>
        </svg>`;
    }
    // Radiator: Rippen nebeneinander, oben/unten Sammelrohr, Ventil links
    const rippen = Array.from({ length: 7 }, (_, i) => `<rect class="rippe" x="${14 + i * 11.5}" y="50" width="9" height="84" rx="4.5"/>`).join("");
    return `
      <svg class="bild" viewBox="0 0 104 150">
        ${wellen(42)}
        <rect class="sammel" x="10" y="54" width="86" height="6" rx="3"/>
        <rect class="sammel" x="10" y="124" width="86" height="6" rx="3"/>
        ${rippen}
        <rect x="2" y="52" width="10" height="10" rx="2" fill="var(--secondary-text-color)" opacity=".6"/>
        <rect x="5" y="44" width="4" height="8" rx="1" fill="var(--secondary-text-color)" opacity=".6"/>
        <rect x="18" y="136" width="4" height="10" fill="var(--divider-color, #999)"/>
        <rect x="84" y="136" width="4" height="10" fill="var(--divider-color, #999)"/>
      </svg>`;
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 12px 16px 14px; height: 100%; box-sizing: border-box; }
        .kopf { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .titel { flex: 1; font-size: 15px; font-weight: 500; color: var(--primary-text-color); }
        .chip { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 12px; cursor: pointer; white-space: nowrap;
          background: var(--secondary-background-color, rgba(127,127,127,.15)); color: var(--secondary-text-color); display: flex; align-items: center; gap: 4px; }
        .chip ha-icon { --mdc-icon-size: 16px; }
        .chip.an { background: rgba(255,112,0,.18); color: #ff7a1a; }
        .chip.an ha-icon { animation: dreh 1.6s linear infinite; }
        @keyframes dreh { to { transform: rotate(360deg); } }
        .inhalt { display: flex; gap: 16px; align-items: flex-start; }
        svg.bild { width: 104px; height: 150px; flex: none; cursor: pointer; }
        .werte { flex: 1; display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; align-content: start; min-width: 0; }
        .werte .l { font-size: 12px; color: var(--secondary-text-color); align-self: center; white-space: nowrap; }
        .werte .v { font-size: 15px; font-weight: 600; color: var(--primary-text-color); cursor: pointer; text-align: right; white-space: nowrap; }
        .temp { margin-bottom: 6px; grid-column: 1 / -1; cursor: pointer; }
        .temp .zeile { display: flex; align-items: baseline; gap: 6px; }
        .temp .gross { font-size: 26px; font-weight: 600; color: var(--primary-text-color); }
        .temp .klein { font-size: 12px; color: var(--secondary-text-color); }
        .temp .soll { font-size: 12px; color: var(--secondary-text-color); margin-left: auto; }
        .balken { position: relative; height: 8px; border-radius: 4px; background: var(--divider-color, rgba(127,127,127,.25)); margin-top: 4px; }
        .balken .f { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; transition: width .6s, background .6s; }
        .balken .m { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--primary-text-color); opacity: .7; border-radius: 1px; }

        .rippe, .sammel { fill: var(--hk-farbe, #888); stroke: rgba(0,0,0,.25); stroke-width: 1; transition: fill .6s; }
        .estrich { fill: var(--secondary-background-color, #ddd); }
        .rohr { fill: none; stroke-width: 4.5; stroke-linecap: round; }
        .rohr.grund { stroke: var(--hk-farbe, #888); transition: stroke .6s; }
        .rohr.fluss { stroke: rgba(255,255,255,.55); stroke-width: 2; stroke-dasharray: 3 14; opacity: 0; }
        .an .rohr.fluss { opacity: 1; animation: fluss 2.2s linear infinite; }
        @keyframes fluss { to { stroke-dashoffset: -34; } }
        .welle { fill: none; stroke: var(--hk-farbe, #888); stroke-width: 2.5; stroke-linecap: round; opacity: 0; }
        .an .welle { animation: steig 2.6s ease-in infinite; }
        .an .welle.b { animation-delay: .85s; } .an .welle.c { animation-delay: 1.7s; }
        @keyframes steig { 0% { transform: translateY(8px); opacity: 0; } 30% { opacity: .8; } 100% { transform: translateY(-12px); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .welle, .rohr.fluss, .chip ha-icon { animation: none !important; } }
      </style>
      <ha-card>
        <div class="kopf"><span class="titel"></span><span class="chip"><ha-icon icon="mdi:pump"></ha-icon><span class="ct"></span></span></div>
        <div class="inhalt">
          <div class="g">${this._grafik()}</div>
          <div class="werte"></div>
        </div>
      </ha-card>`;
    const r = this.shadowRoot;
    r.querySelector(".titel").textContent = this._config.titel;
    r.querySelector(".chip").addEventListener("click", () => this._info(this._config.pumpe));
    r.querySelector("svg.bild").addEventListener("click", () => this._info(this._config.vorlauf));
    this._update();
  }

  _update() {
    if (!this._hass || !this.shadowRoot || !this._config) return;
    const c = this._config, r = this.shadowRoot, h = this._hass;
    const t = this._zahl(c.vorlauf), soll = this._zahl(c.vorlauf_soll);
    const ps = c.pumpe ? h.states[c.pumpe] : null;
    const n = ps ? Number(ps.state) : NaN;
    const an = ps ? (!isNaN(n) ? n > 0 : ps.state === "on") : (t != null && soll != null && t > c.min + 2);

    const g = r.querySelector(".g");
    g.classList.toggle("an", !!an);
    g.style.setProperty("--hk-farbe", t != null ? this._farbe(t) : "var(--disabled-text-color, #888)");

    const chip = r.querySelector(".chip");
    chip.style.display = ps ? "" : "none";
    chip.classList.toggle("an", !!an);
    r.querySelector(".ct").textContent = ps ? (an ? (!isNaN(n) ? `Pumpe ${Math.round(n)} %` : "Pumpe läuft") : "Pumpe aus") : "";

    const w = r.querySelector(".werte");
    w.innerHTML = "";
    const d = document.createElement("div");
    d.className = "temp";
    const einheit = h.states[c.vorlauf]?.attributes?.unit_of_measurement || "°C";
    d.innerHTML = `<div class="zeile"><span class="gross"></span><span class="klein">Vorlauf</span><span class="soll"></span></div><div class="balken"><div class="f"></div><div class="m"></div></div>`;
    d.querySelector(".gross").textContent = t != null ? `${this._fmt(t)} ${einheit}` : "–";
    d.querySelector(".soll").textContent = soll != null ? `Soll ${this._fmt(soll)} ${einheit}` : "";
    const anteil = (v) => Math.min(100, Math.max(0, ((v - c.min) / (c.max - c.min)) * 100));
    const f = d.querySelector(".f");
    f.style.width = t != null ? `${anteil(t)}%` : "0";
    f.style.background = t != null ? this._farbe(t) : "transparent";
    const m = d.querySelector(".m");
    m.style.display = soll != null ? "" : "none";
    if (soll != null) m.style.left = `calc(${anteil(soll)}% - 1px)`;
    d.addEventListener("click", () => this._info(c.vorlauf));
    w.appendChild(d);

    const zeilen = [["Raum", c.raum, 1], ["Außen", c.aussen, 1], ["Betriebsart", c.betriebsart, 0]];
    if (t != null && soll != null) zeilen.splice(0, 0, ["Abweichung", null, 1, t - soll]);
    for (const [l, id, st, wert] of zeilen) {
      if (wert == null && (!id || !h.states[id])) continue;
      const a = document.createElement("span"); a.className = "l"; a.textContent = l;
      const b = document.createElement("span"); b.className = "v";
      if (wert != null) b.textContent = `${wert > 0 ? "+" : ""}${this._fmt(wert)} K`;
      else {
        const v = this._zahl(id), e = h.states[id].attributes?.unit_of_measurement || "";
        b.textContent = v != null ? `${this._fmt(v, st)} ${e}`.trim() : h.states[id].state;
        b.addEventListener("click", () => this._info(id));
      }
      w.append(a, b);
    }
  }

  getCardSize() { return 4; }
  getGridOptions() { return { columns: 12, rows: "auto", min_columns: 6 }; }
  static getStubConfig(hass) {
    const ids = Object.keys(hass?.states ?? {});
    const f = (re, dom = "sensor.") => ids.find((id) => id.startsWith(dom) && re.test(id));
    const cfg = { titel: "Heizkreis", typ: "radiator", vorlauf: f(/hk1.*vorlauf_ist|vorlauf.*ist/), vorlauf_soll: f(/hk1.*vorlauf_soll|vorlauf.*soll/),
      pumpe: f(/hk1.*pumpe/, "binary_sensor."), aussen: f(/aussentemperatur$/) };
    return Object.fromEntries(Object.entries(cfg).filter(([, v]) => v));
  }
  static getConfigForm() {
    const ent = (domain) => ({ entity: { filter: { domain } } });
    const labels = { titel: "Titel", typ: "Art", vorlauf: "Vorlauf-Isttemperatur", vorlauf_soll: "Vorlauf-Solltemperatur (optional)",
      pumpe: "Heizkreispumpe (optional)", raum: "Raumtemperatur (optional)", aussen: "Außentemperatur (optional)",
      betriebsart: "Betriebsart (optional)", min: "Farbskala von", max: "Farbskala bis" };
    return {
      schema: [
        { name: "titel", selector: { text: {} } },
        { name: "typ", selector: { select: { mode: "dropdown", options: [{ value: "radiator", label: "Heizkörper (Radiator)" }, { value: "fussboden", label: "Fußbodenheizung" }] } } },
        { name: "vorlauf", required: true, selector: ent("sensor") },
        { name: "vorlauf_soll", selector: ent(["sensor", "number"]) },
        { name: "pumpe", selector: ent(["binary_sensor", "sensor", "switch"]) },
        { type: "expandable", name: "weitere", flatten: true, title: "Weitere Werte (optional)", schema: [
          { name: "raum", selector: ent("sensor") }, { name: "aussen", selector: ent("sensor") },
          { name: "betriebsart", selector: ent(["select", "sensor"]) },
          { type: "grid", name: "", schema: [
            { name: "min", selector: { number: { min: 0, max: 100, mode: "box", unit_of_measurement: "°C" } } },
            { name: "max", selector: { number: { min: 0, max: 120, mode: "box", unit_of_measurement: "°C" } } },
          ] },
        ] },
      ],
      computeLabel: (s) => labels[s.name] ?? s.name,
      computeHelper: (s) => (s.name === "min" || s.name === "max" ? "Standard: Heizkörper 20–70 °C, Fußboden 20–45 °C" : undefined),
    };
  }
}

if (!customElements.get(TYPE12)) customElements.define(TYPE12, HeizkreisKarte);
if (!window.customCards.some((c) => c.type === TYPE12)) {
  window.customCards.push({ type: TYPE12, name: "Heizkreis-Karte", description: "Heizkörper oder Fußbodenheizung, eingefärbt nach Vorlauftemperatur, mit Pumpe und Sollwert", preview: true });
}
}

console.info("%c heizkreis-karte %c v1.0.0 ", "color:#fff;background:#03a9f4;font-weight:700", "color:#03a9f4");
