// #play14 KL — character select logic.
// Runs only after the access gate decrypts the roster (see js/gate.js).
window.APP_INIT = function (roster) {
  "use strict";

  var grid = document.getElementById("grid");
  var flipper = document.getElementById("card-flipper");
  var selected = 0;
  var soundOn = true; // sound (theme music + blips) defaults ON
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var HEXAD_TYPES = ["Philanthropist", "Socialiser", "Free Spirit", "Achiever", "Disruptor", "Player"];
  // per-type colours matching the printed card's stat block
  var HEXAD_COLORS = {
    "Philanthropist": "#1e9e56",
    "Socialiser": "#2288cf",
    "Free Spirit": "#8a4fd8",
    "Achiever": "#e09410",
    "Disruptor": "#e8452f",
    "Player": "#6faa1f"
  };
  var FLIP_MS = 700; // keep in sync with .card-flipper transition duration

  var RADAR_MAX = 25; // fixed radial scale: HEXAD shares top out ~25

  // ---------- Render grid ----------

  roster.forEach(function (p, i) {
    var tile = document.createElement("div");
    tile.className = "tile";
    tile.setAttribute("role", "option");
    tile.setAttribute("aria-selected", "false");
    tile.setAttribute("tabindex", "-1");
    tile.dataset.index = i;

    var flag = document.createElement("span");
    flag.className = "p1-flag";
    flag.textContent = "P" + (i + 1);

    var img = document.createElement("img");
    // grid uses the small thumbnail by convention; falls back to full art
    img.src = p.avatar.replace(/([^\/]+)\.(\w+)$/, "thumbs/$1.jpg");
    img.onerror = function () { this.onerror = null; this.src = p.avatar; };
    img.alt = p.name;
    img.loading = "lazy";

    var name = document.createElement("div");
    name.className = "tile-name";
    name.textContent = p.name;

    tile.appendChild(flag);
    tile.appendChild(img);
    tile.appendChild(name);
    tile.addEventListener("click", function () { select(i); });
    grid.appendChild(tile);
  });

  // ---------- Details panel ----------

  // ALL types sharing the top score — ties are common and players want
  // every joint-highest listed, not the first one in some fixed order
  function topHexads(p) {
    if (p.hexadScores) {
      var best = -1;
      HEXAD_TYPES.forEach(function (t) {
        var v = p.hexadScores[t];
        if (typeof v === "number" && v > best) best = v;
      });
      return HEXAD_TYPES.filter(function (t) { return p.hexadScores[t] === best; });
    }
    return p.hexad ? [p.hexad] : [];
  }

  // Radar chart: hexagon, one axis per type, fixed 0–25 scale so shapes
  // compare across players. Labels/dots use the type colours; tied top
  // types get underlined names and ringed dots.
  function radarSVG(p, tops) {
    // tall-square geometry so the chart fills the panel's height at desktop
    var cx = 190, cy = 196, R = 112;
    var pts = [], dots = "", labels = "";
    HEXAD_TYPES.forEach(function (t, i) {
      var v = p.hexadScores[t] || 0;
      var a = (-90 + i * 60) * Math.PI / 180;
      var r = Math.min(v, RADAR_MAX) / RADAR_MAX * R;
      var x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      pts.push(x.toFixed(1) + "," + y.toFixed(1));
      var isTop = tops.indexOf(t) !== -1;
      dots += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (isTop ? 5 : 3.5) +
              '" fill="' + HEXAD_COLORS[t] + '"' + (isTop ? ' stroke="#17161c" stroke-width="1.5"' : "") + "/>";

      // label anchors per vertex position (top, right pair, bottom, left pair)
      var conf = [
        { x: cx, y: 58, a: "middle" }, { x: 296, y: 138, a: "start" },
        { x: 296, y: 250, a: "start" }, { x: cx, y: 330, a: "middle" },
        { x: 84, y: 250, a: "end" }, { x: 84, y: 138, a: "end" }
      ][i];
      labels += '<text x="' + conf.x + '" y="' + conf.y + '" text-anchor="' + conf.a +
                '" font-size="7.5" fill="' + HEXAD_COLORS[t] + '"' +
                (isTop ? ' text-decoration="underline"' : "") + ">" + t.toUpperCase() + "</text>" +
                '<text x="' + conf.x + '" y="' + (conf.y + 13) + '" text-anchor="' + conf.a +
                '" font-size="9.5" font-weight="bold" fill="#17161c">' + v.toFixed(1) + "</text>";
    });

    var rings = "";
    [5, 10, 15, 20, 25].forEach(function (lvl) {
      var ring = HEXAD_TYPES.map(function (t, i) {
        var a = (-90 + i * 60) * Math.PI / 180;
        var r = lvl / RADAR_MAX * R;
        return (cx + r * Math.cos(a)).toFixed(1) + "," + (cy + r * Math.sin(a)).toFixed(1);
      }).join(" ");
      rings += '<polygon points="' + ring + '" fill="none" stroke="#ddd9cc" stroke-width="1"/>';
    });
    var spokes = HEXAD_TYPES.map(function (t, i) {
      var a = (-90 + i * 60) * Math.PI / 180;
      return '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + R * Math.cos(a)).toFixed(1) +
             '" y2="' + (cy + R * Math.sin(a)).toFixed(1) + '" stroke="#ddd9cc" stroke-width="1"/>';
    }).join("");

    return '<svg viewBox="0 0 380 380" role="img" aria-label="HEXAD radar chart"' +
           ' preserveAspectRatio="xMidYMid meet"' +
           ' style="width:100%;max-height:100%;display:block;font-family:\'Press Start 2P\',monospace">' +
           rings + spokes +
           '<polygon points="' + pts.join(" ") + '" fill="rgba(123,75,196,0.22)"' +
           ' stroke="#7b4bc4" stroke-width="2" stroke-linejoin="round"/>' +
           dots + labels + "</svg>";
  }

  function renderStats(p) {
    var box = document.getElementById("hexad-stats");
    box.innerHTML = "";
    // radar mode lets the white panel stretch to fill the info column
    box.parentElement.classList.toggle("has-radar", !!p.hexadScores);
    if (!p.hexadScores) {
      var pending = document.createElement("p");
      pending.className = "stat-pending";
      pending.textContent = "HEXAD SCAN PENDING…";
      box.appendChild(pending);
      return;
    }
    box.innerHTML = radarSVG(p, topHexads(p));
  }

  function renderDetails(p) {
    document.getElementById("sel-avatar").src = p.avatar;
    document.getElementById("sel-avatar").alt = p.name + " card";
    document.getElementById("sel-name").textContent = p.name;
    document.getElementById("sel-tagline").textContent = p.tagline;
    document.getElementById("sel-tagline").parentElement.style.visibility = p.tagline ? "visible" : "hidden";
    document.getElementById("sel-class").textContent = p.class.toUpperCase();
    var tops = topHexads(p);
    var badge = document.getElementById("sel-hexad");
    if (tops.length) {
      badge.innerHTML = "HEXAD: " + tops.map(function (t) {
        return '<span style="color:' + HEXAD_COLORS[t] + '">' + t.toUpperCase() + "</span>";
      }).join('<span class="hexad-sep">, </span>');
    } else {
      badge.textContent = "HEXAD: ???";
    }
    document.getElementById("sel-blurb").textContent = p.blurb || "Player dossier incoming — bio syncs once the scouts report back.";
    document.getElementById("sel-env").textContent = p.environment.toUpperCase();
    document.getElementById("sel-attire").textContent = p.attire.toUpperCase();
    renderStats(p);
  }

  // ---------- Selection + back-reveal flip ----------
  // Full 360° Y-spin: the card back (pre-rotated 180°) faces the viewer
  // mid-spin; the front content swaps at the midpoint while hidden.
  // Interrupt-safe: key spam retargets the pending player; if selection
  // changes after the midpoint swap, a follow-up flip fires on landing.

  var flipping = false;
  var displayedIndex = 0; // player currently shown on the card front

  function highlight(i) {
    var tiles = grid.children;
    for (var t = 0; t < tiles.length; t++) {
      tiles[t].classList.toggle("selected", t === i);
      tiles[t].setAttribute("aria-selected", t === i ? "true" : "false");
    }
  }

  function startFlip() {
    flipping = true;
    flipper.style.transform = "rotateY(360deg)";

    setTimeout(function () {
      renderDetails(roster[selected]);
      displayedIndex = selected;
    }, FLIP_MS / 2);

    setTimeout(function () {
      // snap back to 0° without animating (visually identical to 360°)
      flipper.classList.add("no-anim");
      flipper.style.transform = "rotateY(0deg)";
      void flipper.offsetWidth; // force reflow so the snap isn't transitioned
      flipper.classList.remove("no-anim");
      flipping = false;
      if (displayedIndex !== selected) startFlip(); // selection moved after midpoint
    }, FLIP_MS);
  }

  function select(i, instant) {
    if (!roster.length) return;
    selected = (i + roster.length) % roster.length;
    highlight(selected);
    if (!instant) blip(660);

    if (instant || reducedMotion) {
      renderDetails(roster[selected]);
      displayedIndex = selected;
      return;
    }
    if (!flipping && displayedIndex !== selected) startFlip();
    // if already flipping, the midpoint swap / landing check picks up `selected`
  }

  // ---------- Keyboard navigation (row-aware) ----------

  function columns() {
    if (!grid.children.length) return 1;
    var style = window.getComputedStyle(grid);
    return style.gridTemplateColumns.split(" ").length;
  }

  document.addEventListener("keydown", function (e) {
    var cols = columns();
    switch (e.key) {
      case "ArrowRight": select(selected + 1); break;
      case "ArrowLeft": select(selected - 1); break;
      case "ArrowDown": select(selected + cols); break;
      case "ArrowUp": select(selected - cols); break;
      case "Enter": blip(880); break;
      default: return;
    }
    e.preventDefault();
  });

  // ---------- Sound (off by default) ----------

  var audioCtx = null;

  function blip(freq) {
    if (!soundOn) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.045, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } catch (err) { /* audio unavailable — stay silent */ }
  }

  // ---------- Theme music (loops; on by default) ----------
  // Browsers block un-gestured autoplay with sound, so: try immediately,
  // and if that's refused, start on the visitor's first interaction.

  var theme = document.getElementById("theme");
  theme.volume = 0.4;

  function startTheme() {
    if (!soundOn || !theme.paused) return;
    var p = theme.play();
    if (p && p.catch) p.catch(function () { /* still blocked — next gesture retries */ });
  }

  startTheme();
  ["pointerdown", "keydown", "touchstart"].forEach(function (ev) {
    document.addEventListener(ev, startTheme, { passive: true });
  });

  var toggle = document.getElementById("sound-toggle");
  toggle.addEventListener("click", function () {
    soundOn = !soundOn;
    toggle.setAttribute("aria-pressed", String(soundOn));
    toggle.textContent = soundOn ? "🔊 SOUND ON" : "🔇 SOUND OFF";
    if (soundOn) { startTheme(); blip(880); }
    else theme.pause();
  });

  // ---------- Casual-extraction deterrents (cosmetic, not security) ----------

  document.addEventListener("contextmenu", function (e) {
    if (e.target.tagName === "IMG") e.preventDefault();
  });
  document.addEventListener("dragstart", function (e) {
    if (e.target.tagName === "IMG") e.preventDefault();
  });

  // ---------- Init ----------

  select(0, true);
};
