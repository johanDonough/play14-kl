// #play14 KL — access gate. Decrypts the roster (AES-GCM, key derived from
// the event access code via PBKDF2) and boots the app on success. The code
// is remembered per device so attendees only type it once.
(function () {
  "use strict";

  var enc = window.ROSTER_ENC;
  var gate = document.getElementById("gate");
  var input = document.getElementById("gate-input");
  var btn = document.getElementById("gate-btn");
  var err = document.getElementById("gate-err");
  var busy = false;

  function b64ToBytes(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function normalize(code) {
    return (code || "").toUpperCase().replace(/\s+/g, "");
  }

  function decryptRoster(code) {
    var encoder = new TextEncoder();
    return crypto.subtle.importKey("raw", encoder.encode(code), "PBKDF2", false, ["deriveKey"])
      .then(function (material) {
        return crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: b64ToBytes(enc.salt), iterations: enc.iterations, hash: "SHA-256" },
          material, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
      })
      .then(function (key) {
        return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(enc.iv) }, key, b64ToBytes(enc.data));
      })
      .then(function (buf) {
        return JSON.parse(new TextDecoder().decode(buf));
      });
  }

  function unlock(roster) {
    try { localStorage.setItem("p14kl_code", input.dataset.okCode); } catch (e) { /* private mode */ }
    document.body.classList.add("unlocked");
    window.APP_INIT(roster);
    setTimeout(function () { if (gate) gate.remove(); }, 700);
  }

  function attempt(code, silent) {
    code = normalize(code);
    if (!code || busy) return;
    busy = true;
    btn.textContent = "CHECKING…";
    err.classList.remove("show");
    decryptRoster(code).then(function (roster) {
      input.dataset.okCode = code;
      unlock(roster);
    }).catch(function () {
      busy = false;
      btn.textContent = "INSERT COIN";
      if (!silent) {
        err.classList.add("show");
        gate.querySelector(".gate-box").classList.remove("shake");
        void gate.offsetWidth;
        gate.querySelector(".gate-box").classList.add("shake");
        input.select();
      }
    });
  }

  btn.addEventListener("click", function () { attempt(input.value); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") attempt(input.value);
  });

  // returning device: try the remembered code silently
  var saved = null;
  try { saved = localStorage.getItem("p14kl_code"); } catch (e) { /* private mode */ }
  if (saved) {
    input.value = saved;
    attempt(saved, true);
  } else {
    input.focus();
  }
})();
