(function () {
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function nodes() {
    return [
      document.getElementById("fb-akses-helper-root"),
      document.getElementById("fb-akses-helper-tab"),
    ];
  }

  function hide() {
    for (const n of nodes()) {
      if (!n) continue;
      n.style.setProperty("display", "none", "important");
    }
  }

  hide();
  new MutationObserver(hide).observe(document.documentElement, { childList: true, subtree: true });

  function shadow() {
    const n = document.getElementById("fb-akses-helper-root");
    return n && n.shadowRoot;
  }

  function visible(el) {
    if (!el) return false;
    const s = window.getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function norm(t) {
    return (t || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function clickEl(el) {
    if (!el) return false;
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y) || el;
    const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 };
    hit.dispatchEvent(new PointerEvent("pointerdown", opts));
    hit.dispatchEvent(new MouseEvent("mousedown", opts));
    hit.dispatchEvent(new PointerEvent("pointerup", opts));
    hit.dispatchEvent(new MouseEvent("mouseup", opts));
    hit.dispatchEvent(new MouseEvent("click", opts));
    return true;
  }

  async function waitUntil(fn, timeoutMs, gap) {
    const t0 = Date.now();
    let last;
    while (Date.now() - t0 < timeoutMs) {
      last = fn();
      if (last) return last;
      await sleep(gap || 250);
    }
    return last;
  }

  function status(text) {
    try { chrome.runtime.sendMessage({ type: "STATUS", text }); } catch (_) {}
  }

  const ID_NAMES = {
    "United States": ["Amerika Serikat"],
    "United Kingdom": ["Inggris", "Britania Raya"],
    "Canada": ["Kanada"],
    "Australia": ["Australia"],
    "New Zealand": ["Selandia Baru"],
    "Germany": ["Jerman"],
    "Switzerland": ["Swiss"],
    "Norway": ["Norwegia"],
    "Sweden": ["Swedia"],
    "Denmark": ["Denmark"],
    "Netherlands": ["Belanda"],
    "Ireland": ["Irlandia"],
    "Austria": ["Austria"],
    "Belgium": ["Belgia"],
    "France": ["Prancis", "Perancis"],
    "Finland": ["Finlandia"],
    "Singapore": ["Singapura"],
    "Japan": ["Jepang"],
    "United Arab Emirates": ["Uni Emirat Arab"],
  };

  function findCountryInput() {
    const inputs = Array.from(document.querySelectorAll("input")).filter(visible);
    return (
      inputs.find((el) => /search countr|cari negara/i.test(el.getAttribute("placeholder") || "")) ||
      inputs.find((el) => /search countr|cari negara/i.test(el.getAttribute("aria-label") || "")) ||
      null
    );
  }

  function pageIsIndonesian(input) {
    const ph = ((input && input.getAttribute("placeholder")) || "") + " " + ((input && input.getAttribute("aria-label")) || "");
    if (/cari negara/i.test(ph)) return true;
    if (/search countr/i.test(ph)) return false;
    return /batasan negara|cari negara/i.test(document.body.innerText || "");
  }

  function exactOption(name) {
    const want = norm(name);
    const nodes = Array.from(document.querySelectorAll("[role='option'], [role='listbox'] *")).filter(visible);
    const hits = nodes.filter((el) => {
      const tx = norm(el.innerText || el.textContent);
      const first = norm((el.innerText || "").split("\n")[0]);
      return tx === want || first === want;
    });
    hits.sort((a, b) => (a.innerText || "").length - (b.innerText || "").length);
    return hits[0] || null;
  }

  function countryChipOn(name) {
    const want = norm(name);
    const nodes = Array.from(document.querySelectorAll("div, span, button")).filter(visible);
    return nodes.some((el) => {
      const tx = norm(el.innerText || "");
      if (!(tx === want || tx === want + " \u00d7" || tx === want + " x")) return false;
      const r = el.getBoundingClientRect();
      return r.height > 14 && r.height < 52 && r.width < 360;
    });
  }

  async function typeCountry(el, text) {
    el.focus();
    clickEl(el);
    await sleep(80);
    try { el.select(); } catch (_) {}
    document.execCommand("selectAll", false, null);
    document.execCommand("delete", false, null);
    await sleep(60);
    for (const ch of text) {
      const ok = document.execCommand("insertText", false, ch);
      if (!ok) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(el, (el.value || "") + ch);
        el.dispatchEvent(new InputEvent("input", { bubbles: true, data: ch, inputType: "insertText" }));
      }
      await sleep(80);
    }
  }

  async function loadPublicCountries() {
    const res = await fetch("https://randialwi.github.io/tier1/", { cache: "no-store" });
    if (!res.ok) throw new Error("List negara gagal dimuat (" + res.status + ").");
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const ta = doc.getElementById("negaraList") || doc.getElementById("list");
    const raw = (ta && (ta.textContent || "")) || "";
    return raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }

  async function isiNegara(sendResponse) {
    try {
      status("Mengambil list negara\u2026");
      const list = await loadPublicCountries();
      if (!list.length) {
        sendResponse({ ok: false, msg: "Daftar negara kosong di github.io." });
        return;
      }
      const input = findCountryInput();
      if (!input) {
        sendResponse({ ok: false, msg: "Kotak Cari Negara / Search countries belum kelihatan. Buka Batasan Negara dulu." });
        return;
      }
      const indo = pageIsIndonesian(input);
      let done = 0;
      for (const en of list) {
        const names = indo ? (ID_NAMES[en] || [en]) : [en];
        if (names.some(countryChipOn) || countryChipOn(en)) {
          done += 1;
          status((names[0] || en) + " sudah ada (" + done + "/" + list.length + ")");
          continue;
        }
        let opt = null;
        let used = names[0];
        for (const name of names) {
          used = name;
          status("Ketik: " + name + " (" + (done + 1) + "/" + list.length + ")");
          input.scrollIntoView({ block: "center" });
          await typeCountry(input, name);
          opt = await waitUntil(() => exactOption(name), 7000, 250);
          if (opt) break;
        }
        if (!opt) {
          sendResponse({ ok: false, msg: "Opsi tidak ketemu: " + names.join(" / ") + ". Berhenti. Sudah " + done + " negara." });
          return;
        }
        clickEl(opt);
        const chip = await waitUntil(() => countryChipOn(used) || countryChipOn(en), 8000, 250);
        if (!chip) {
          sendResponse({ ok: false, msg: "Chip tidak muncul: " + used + ". Berhenti. Sudah " + done + " negara." });
          return;
        }
        done += 1;
        await sleep(350);
      }
      sendResponse({ ok: true, msg: "Selesai " + done + " negara" + (indo ? " (bahasa Indonesia)" : "") + ". Tombol Save Facebook masih manual." });
    } catch (e) {
      sendResponse({ ok: false, msg: String(e) });
    }
  }

  function watchStatus(sendResponse) {
    const root = shadow();
    const el = root && root.getElementById("st");
    if (!el) {
      sendResponse({ ok: false, msg: "Panel dalam halaman belum siap. Refresh Facebook sekali." });
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => {
      const text = (el.textContent || "").trim();
      const color = (el.style.color || "").toLowerCase();
      const ok = color === "#1b5e20" || color === "rgb(27, 94, 32)";
      const bad = color === "#d32f2f" || color === "rgb(211, 47, 47)";
      if ((ok || bad) && Date.now() - started > 500) {
        clearInterval(timer);
        sendResponse({ ok, msg: text || (ok ? "Selesai" : "Gagal") });
        return;
      }
      if (text) status(text);
      if (Date.now() - started > 180000) {
        clearInterval(timer);
        sendResponse({ ok: false, msg: text || "Timeout." });
      }
    }, 400);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || (msg.type !== "ISI_NEGARA" && msg.type !== "ISI_KOMEN")) return;
    if (msg.type === "ISI_NEGARA") {
      isiNegara(sendResponse);
      return true;
    }
    const root = shadow();
    const btn = root && root.getElementById("isiKomen");
    if (!btn) {
      sendResponse({ ok: false, msg: "Tombol belum ada. Refresh tab Facebook sekali." });
      return;
    }
    btn.click();
    watchStatus(sendResponse);
    return true;
  });
})();
