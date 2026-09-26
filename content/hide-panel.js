(function () {
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
      if (text) {
        try { chrome.runtime.sendMessage({ type: "STATUS", text }); } catch (_) {}
      }
      if (Date.now() - started > 180000) {
        clearInterval(timer);
        sendResponse({ ok: false, msg: text || "Timeout." });
      }
    }, 400);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || (msg.type !== "ISI_NEGARA" && msg.type !== "ISI_KOMEN")) return;
    const root = shadow();
    const id = msg.type === "ISI_NEGARA" ? "isiNegara" : "isiKomen";
    const btn = root && root.getElementById(id);
    if (!btn) {
      sendResponse({ ok: false, msg: "Tombol belum ada. Refresh tab Facebook sekali." });
      return;
    }
    btn.click();
    watchStatus(sendResponse);
    return true;
  });
})();
