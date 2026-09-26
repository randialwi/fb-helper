(function () {
  const DELAY_MS = 400;

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
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

  function findByText(text, tags) {
    const want = norm(text);
    const sel = (tags || ["button", "a", "div", "span", "[role='button']"]).join(",");
    const nodes = document.querySelectorAll(sel);
    const hits = [];
    for (const el of nodes) {
      if (!visible(el)) continue;
      const t = norm(el.innerText || el.textContent);
      if (t === want || t.startsWith(want)) hits.push(el);
    }
    return hits;
  }

  function ownText(el) {
    let t = "";
    for (const n of el.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) t += n.textContent;
    }
    return norm(t);
  }

  function clickableAncestor(el) {
    let cur = el;
    for (let i = 0; i < 10 && cur; i++) {
      const role = (cur.getAttribute && cur.getAttribute("role")) || "";
      if (
        cur.tagName === "BUTTON" ||
        cur.tagName === "A" ||
        role === "button" ||
        role === "link" ||
        (cur.tabIndex >= 0 && cur.tagName !== "INPUT")
      ) {
        return cur;
      }
      cur = cur.parentElement;
    }
    return el;
  }

  function clickEl(el) {
    if (!el) return false;
    const target = clickableAncestor(el);
    target.scrollIntoView({ block: "center", inline: "center" });
    const r = target.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y) || target;
    const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 };
    hit.dispatchEvent(new PointerEvent("pointerdown", opts));
    hit.dispatchEvent(new MouseEvent("mousedown", opts));
    hit.dispatchEvent(new PointerEvent("pointerup", opts));
    hit.dispatchEvent(new MouseEvent("mouseup", opts));
    hit.dispatchEvent(new MouseEvent("click", opts));
    target.style.outline = "2px solid #00e676";
    setTimeout(() => { try { target.style.outline = ""; } catch (_) {} }, 1500);
    return true;
  }

  /**
   * Langkah 1: klik "Tambahkan Baru" yang ATAS
   * yaitu di bagian "Orang yang memiliki akses Facebook"
   * (bukan "Orang yang memiliki akses tugas")
   */
  function findTambahBaruButtons() {
    const nodes = Array.from(
      document.querySelectorAll("button, a, [role='button'], span, div")
    );
    const hits = [];
    for (const el of nodes) {
      if (!visible(el)) continue;
      if (el.getAttribute("aria-hidden") === "true") continue;
      const t = norm(el.innerText || el.textContent);
      const own = ownText(el);
      if (
        t !== "tambahkan baru" &&
        own !== "tambahkan baru" &&
        t !== "add new" &&
        own !== "add new"
      ) continue;
      if (t.length > 40) continue;
      hits.push(clickableAncestor(el));
    }
    const uniq = [];
    for (const el of hits) {
      if (!uniq.includes(el)) uniq.push(el);
    }
    uniq.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    return uniq;
  }

  async function step1ClickTambahAtas() {
    const btns = findTambahBaruButtons();
    if (!btns.length) {
      return {
        ok: false,
        msg: "Tombol Tambahkan Baru atas belum ketemu. Refresh halaman lalu coba lagi.",
      };
    }
    const target = btns[0];
    clickEl(target);
    const dialog = await waitUntil(() => {
      const d = findDialog();
      if (!d || !visible(d)) return null;
      const t = norm(d.innerText);
      return t.includes("tambahkan baru") || t.includes("add new") || t.includes("akses facebook artinya") || t.includes("facebook access means") || t.includes("berikutnya") || t.includes("next") ? d : null;
    }, 12000, 300);
    if (!dialog) {
      return {
        ok: false,
        msg: "Tambahkan Baru diklik, dialog belum muncul (timeout). Coba lagi atau klik manual.",
      };
    }
    return step2KlikBerikutnya();
  }

  function findDialog() {
    const dialogs = Array.from(
      document.querySelectorAll("[role='dialog'], [aria-modal='true']")
    ).filter(visible);
    if (dialogs.length) return dialogs[dialogs.length - 1];
    return null;
  }

  function findExactControls(root, text) {
    const want = norm(text);
    const scope = root || document;
    const nodes = scope.querySelectorAll("button, a, [role='button'], span, div");
    const hits = [];
    for (const el of nodes) {
      if (!visible(el)) continue;
      if (el.getAttribute("aria-hidden") === "true") continue;
      const t = norm(el.innerText || el.textContent);
      const own = ownText(el);
      if (t !== want && own !== want) continue;
      if (t.length > want.length + 8) continue;
      hits.push(clickableAncestor(el));
    }
    const uniq = [];
    for (const el of hits) if (!uniq.includes(el)) uniq.push(el);
    uniq.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return rb.top - ra.top || rb.left - ra.left;
    });
    return uniq;
  }

  function findIn(root, text) {
    const exact = findExactControls(root, text);
    if (exact.length) return exact[0];
    const want = norm(text);
    const scope = root || document;
    const nodes = scope.querySelectorAll("button, a, [role='button'], span, div");
    const partial = [];
    for (const el of nodes) {
      if (!visible(el)) continue;
      const t = norm(el.innerText || el.textContent);
      if (!t) continue;
      if (t === want) exact.push(el);
      else if (t.startsWith(want) && t.length < want.length + 20) partial.push(el);
    }
    return exact[0] || partial[0] || null;
  }

  function findAny(root, names) {
    for (const s of names) {
      const hit = findExactControls(root, s)[0] || findIn(root, s) || findByText(s)[0];
      if (hit) return hit;
    }
    return null;
  }

  function dialogHasSearch() {
    const d = findDialog();
    if (!d) return false;
    const t = norm(d.innerText);
    if (t.includes("siapa yang akan memiliki akses") || t.includes("who will have facebook access") || t.includes("who will have access")) return true;
    return !!findSearchInput(d);
  }

  /** Langkah 2: klik tombol biru "Berikutnya" di dialog Tambahkan baru */
  async function step2KlikBerikutnya() {
    const btn = await waitUntil(() => {
      const dialog = findDialog();
      if (!dialog) return null;
      return findAny(dialog, ["Berikutnya", "Next"]);
    }, 12000, 300);
    if (!btn) {
      return { ok: false, msg: "Tombol Berikutnya belum muncul (timeout)." };
    }
    clickEl(btn);
    const ok = await waitUntil(() => dialogHasSearch(), 12000, 300);
    if (ok) return { ok: true, msg: "Tambahkan Baru + Berikutnya selesai. Isi UID di langkah 3." };
    return { ok: false, msg: "Berikutnya diklik, kolom cari belum muncul (timeout)." };
  }

  function nativeSetInput(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    el.focus();
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, data: value, inputType: "insertText" }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function findSearchInput(root) {
    const scope = root || document;
    const inputs = Array.from(scope.querySelectorAll("input, textarea")).filter(visible);
    const byPh = inputs.find((el) =>
      /cari|nama|email|search/i.test(el.getAttribute("placeholder") || "")
    );
    if (byPh) return byPh;
    const byAria = inputs.find((el) =>
      /cari|search|nama|email/i.test(
        (el.getAttribute("aria-label") || "") + " " + (el.getAttribute("name") || "")
      )
    );
    return byAria || inputs[0] || null;
  }

  async function waitFor(fn, tries, gap) {
    for (let i = 0; i < tries; i++) {
      const v = fn();
      if (v) return v;
      await sleep(gap);
    }
    return null;
  }

  function permissionScreenOpen() {
    const d = findDialog();
    if (!d) return false;
    const t = norm(d.innerText);
    return (
      t.includes("berikan akses") ||
      t.includes("give access") ||
      t.includes("grant access") ||
      t.includes("kontrol penuh") ||
      t.includes("full control") ||
      t.includes("mengelola hal berikut") ||
      t.includes("bisa mengelola") ||
      t.includes("will be able to manage")
    );
  }

  function findResultRow(scope, input) {
    const root = scope || document;
    const imgs = Array.from(root.querySelectorAll("img, image")).filter(visible);
    const inputBottom = input ? input.getBoundingClientRect().bottom : 0;
    const rows = [];
    for (const img of imgs) {
      const ir = img.getBoundingClientRect();
      if (ir.top < inputBottom - 4) continue;
      if (ir.width < 16 || ir.height < 16) continue;
      let row = img.closest("[role='option'], [role='listitem'], li") || img.parentElement;
      for (let i = 0; i < 8 && row; i++) {
        const t = (row.innerText || "").trim();
        const r = row.getBoundingClientRect();
        if (t && t.length < 80 && r.height >= 36 && r.height < 160 && r.width > 120) break;
        row = row.parentElement;
      }
      if (!row || (input && row.contains(input))) continue;
      const t = (row.innerText || "").trim();
      if (!t || /siapa yang akan|cari berdasarkan|tambahkan baru/.test(norm(t))) continue;
      if (!/[A-Za-zÀ-ÿĂăÂâÊêÔôƠơƯưÁáÀàẢảÃãẠạĐđÍíÌìỈỉĨĩỊịÓóÒòỎỏÕõỌọÚúÙùỦủŨũỤụÝý]/.test(t)) continue;
      rows.push(row);
    }
    rows.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    return rows[0] || null;
  }

  /** Langkah 3: isi UID ke kotak cari saja — nama diklik manual */
  async function step3CariUid(payload) {
    const uid = String(payload?.uid || "").trim();
    if (!uid) return { ok: false, msg: "UID aktif kosong. Pilih/isi salah satu kotak UID dulu." };
    if (permissionScreenOpen()) return { ok: true, msg: "Sudah di halaman izin. Klik nama tidak perlu." };

    const dialog = findDialog() || document;
    const input = findSearchInput(dialog);
    if (!input) {
      return { ok: false, msg: "Kotak cari belum ketemu. Pastikan dialog pencarian sudah terbuka (langkah 2)." };
    }

    clickEl(input);
    await sleep(120);
    nativeSetInput(input, "");
    await sleep(80);
    nativeSetInput(input, uid);

    const row = await waitFor(() => findResultRow(findDialog() || dialog, input), 24, 250);
    if (!row) {
      return {
        ok: false,
        msg: "UID " + uid + " sudah diisi, nama belum ketemu. Klik namanya manual, atau jalankan langkah 3 lagi.",
      };
    }

    const nameEl = Array.from(row.querySelectorAll("span, div")).find((el) => {
      const tx = (el.innerText || "").trim();
      return tx && tx.length < 80 && tx === (row.innerText || "").trim().split("\n")[0];
    });
    clickEl(nameEl || row);
    await sleep(700);
    if (permissionScreenOpen()) {
      return { ok: true, msg: "UID diisi dan nama diklik. Lanjut langkah 4." };
    }
    clickEl(row);
    await sleep(700);
    if (permissionScreenOpen()) {
      return { ok: true, msg: "UID diisi dan nama diklik. Lanjut langkah 4." };
    }
    return {
      ok: false,
      msg: "UID sudah diisi. Nama kebingkai hijau tapi belum pindah — klik namanya sekali secara manual.",
    };
  }

  function findSwitchNear(text) {
    const dialog = findDialog() || document;
    const want = norm(text);
    const nodes = Array.from(dialog.querySelectorAll("div, span, label, p")).filter(visible);
    const label = nodes.find((el) => {
      const t = norm(el.innerText);
      return t.includes(want) && t.length < 280;
    });
    const switches = Array.from(
      dialog.querySelectorAll("[role='switch'], input[type='checkbox'], [aria-checked]")
    ).filter(visible);
    if (label) {
      let root = label;
      for (let i = 0; i < 10 && root; i++) {
        const sw =
          root.querySelector("[role='switch']") ||
          root.querySelector("input[type='checkbox']") ||
          root.querySelector("[aria-checked]");
        if (sw) return sw;
        root = root.parentElement;
      }
    }
    return switches[switches.length - 1] || null;
  }

  function isOn(sw) {
    if (!sw) return false;
    if (sw.getAttribute("aria-checked") === "true") return true;
    if (sw.getAttribute("aria-pressed") === "true") return true;
    if (sw.checked === true) return true;
    return false;
  }

  function isFbBlue(el) {
    if (!el) return false;
    const st = getComputedStyle(el);
    for (const bg of [st.backgroundColor, st.borderTopColor]) {
      const m = (bg || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) continue;
      const r = +m[1], g = +m[2], b = +m[3];
      if (b > 180 && r < 100 && g > 60 && g < 200) return true;
    }
    return false;
  }

  function controlTitle() {
    const dialog = findDialog() || document;
    const nodes = Array.from(dialog.querySelectorAll("span, div, label")).filter(visible);
    return (
      nodes.find((el) => {
        const t = norm(el.innerText);
        return t === "izinkan orang ini untuk memiliki kontrol penuh" || t === "allow this person to have full control";
      }) ||
      nodes.find((el) => {
        const t = norm(el.innerText);
        return (
          (t.startsWith("izinkan orang ini untuk memiliki kontrol penuh") ||
            t.startsWith("allow this person to have full control")) &&
          t.length < 80
        );
      }) ||
      null
    );
  }

  function controlRow() {
    const dialog = findDialog() || document;
    const nodes = Array.from(dialog.querySelectorAll("span, div, label")).filter(visible);
    const title = nodes.find((el) => {
      const t = norm(el.innerText);
      return (
        (t.startsWith("izinkan orang ini untuk memiliki kontrol penuh") ||
          t.startsWith("allow this person to have full control")) &&
        t.length < 180
      );
    });
    if (!title) return null;
    let row = title;
    for (let i = 0; i < 8 && row; i++) {
      const r = row.getBoundingClientRect();
      if (r.width > 280 && r.height >= 28 && r.height < 140) return row;
      row = row.parentElement;
    }
    return title.parentElement;
  }

  function toggleLooksOn(row) {
    const dialog = findDialog() || document;
    const title = controlTitle();
    const switches = Array.from(dialog.querySelectorAll("[role='switch'], input[type='checkbox']"));
    if (switches.some(isOn)) return true;
    const root = title ? title.parentElement : row;
    if (!root) return false;
    const tr = (title || root).getBoundingClientRect();
    for (const el of [root, ...root.querySelectorAll("*")]) {
      const tx = norm(el.innerText || "");
      if (/give access|berikan akses|grant access|berikutnya|next/.test(tx) && tx.length < 24) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 120 || r.height > 48) continue;
      if (title && r.left + r.width / 2 < tr.right) continue;
      if (isOn(el) || isFbBlue(el)) return true;
    }
    return false;
  }

  function clickKnob(row) {
    const title = controlTitle();
    const box = row || (title && title.parentElement);
    if (!box) return;
    box.scrollIntoView({ block: "center" });
    const dialog = findDialog() || document;
    const scoped = title ? title.parentElement || box : box;
    const sw =
      scoped.querySelector("[role='switch']") ||
      box.querySelector("[role='switch']") ||
      dialog.querySelector("[role='switch']") ||
      scoped.querySelector("input[type='checkbox']") ||
      box.querySelector("input[type='checkbox']");
    if (sw && sw.tagName === "INPUT") {
      try {
        const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked");
        if (proto && proto.set) proto.set.call(sw, true);
        else sw.checked = true;
        sw.dispatchEvent(new Event("input", { bubbles: true }));
        sw.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (_) {}
    }
    if (sw) {
      clickAt(sw);
      return;
    }
    const tr = (title || box).getBoundingClientRect();
    const rr = box.getBoundingClientRect();
    const pts = [
      [rr.right - 18, tr.top + 10],
      [rr.right - 28, tr.top + tr.height / 2],
      [rr.right - 18, tr.top + tr.height / 2],
    ];
    for (const [x, y] of pts) {
      const hit = document.elementFromPoint(x, y);
      if (hit && box.contains(hit)) {
        clickAt(hit);
        return;
      }
    }
  }

  const grantedOnce = new Set();
  let confirmOnce = false;
  let busy = false;

  function clickSubmit(el) {
    return clickEl(el);
  }

  /** Langkah 4: nyalakan kontrol penuh DULU, baru Berikan akses */
  async function step4KontrolDanBerikan(payload) {
    const dialog = findDialog();
    if (dialog) dialog.scrollTop = dialog.scrollHeight;
    await sleep(400);

    const row = controlRow();
    if (!row) {
      return { ok: false, msg: "Saklar kontrol penuh belum ketemu. Scroll dialog ke bawah dulu." };
    }

    if (!toggleLooksOn(row)) {
      clickKnob(row);
      await sleep(600);
    }

    if (!toggleLooksOn(controlRow() || row)) {
      return {
        ok: false,
        msg: "Saklar belum centang/biru. Geser 'Allow this person / Izinkan orang ini' manual sampai ON, baru tekan 4 lagi. Berikan akses tidak diklik.",
      };
    }

    const uidKey = String(payload?.uid || "").trim() || "__unknown__";
    if (grantedOnce.has(uidKey)) {
      return { ok: false, msg: "UID ini sudah pernah diklik Berikan akses di sesi ini. Tidak diklik ulang (cegah undangan dobel)." };
    }

    const alreadyPassword = norm((findDialog() || document).innerText || "");
    if (
      alreadyPassword.includes("masukkan kembali kata sandi") ||
      alreadyPassword.includes("re-enter your facebook") ||
      alreadyPassword.includes("facebook profile password") ||
      alreadyPassword.includes("enter your facebook password") ||
      alreadyPassword.includes("re-enter your password") ||
      (alreadyPassword.includes("kata sandi") && alreadyPassword.includes("demi keamanan"))
    ) {
      return { ok: true, msg: "Dialog sandi sudah terbuka. Jangan klik Berikan akses lagi. Isi sandi lalu langkah 5." };
    }

    await sleep(400);
    const btn =
      findAny(dialog || findDialog(), ["Berikan akses", "Give access", "Grant access"]);
    if (!btn) return { ok: false, msg: "Kontrol penuh sudah ON, tapi tombol Berikan akses belum ketemu." };
    clickSubmit(btn);
    await sleep(900);
    const t = norm((findDialog() || document).innerText || "");
    if (
      t.includes("masukkan kembali kata sandi") ||
      t.includes("re-enter your facebook") ||
      t.includes("facebook profile password") ||
      t.includes("enter your facebook password") ||
      t.includes("re-enter your password") ||
      (t.includes("kata sandi") && t.includes("konfirmasi"))
    ) {
      grantedOnce.add(uidKey);
      return { ok: true, msg: "Berikan akses sekali. Isi sandi lalu langkah 5." };
    }
    return {
      ok: false,
      msg: "Tombol Berikan akses kebingkai hijau tapi dialog sandi belum muncul. Jangan spam klik. Coba langkah 4 sekali lagi, atau klik Berikan akses manual sekali.",
    };
  }

  /** Langkah 5: hanya klik Konfirmasi — password diketik manual */
  async function step5Konfirmasi() {
    if (confirmOnce) {
      return { ok: false, msg: "Konfirmasi sudah diklik di sesi ini. Refresh halaman kalau mau ulang." };
    }
    await sleep(200);
    const dialog = findDialog();
    const btn =
      findAny(dialog, ["Konfirmasi", "Confirm"]);
    if (!btn) {
      return { ok: false, msg: "Tombol Konfirmasi belum ketemu. Isi kata sandi dulu secara manual." };
    }
    confirmOnce = true;
    clickSubmit(btn);
    return { ok: true, msg: "Konfirmasi diklik sekali." };
  }

  function clickAt(el) {
    if (!el) return false;
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
    el.style.outline = "2px solid #00e676";
    setTimeout(() => { try { el.style.outline = ""; } catch (_) {} }, 1500);
    return true;
  }

  function findAccountButton() {
    const skip = /notif|lonceng|bell|menu|grid|launcher|messenger|chat|pesan/;
    const header = document.querySelector("[role='banner']") || document;
    const imgs = Array.from(header.querySelectorAll("image, img")).filter((el) => {
      if (!visible(el)) return false;
      const r = el.getBoundingClientRect();
      if (r.top > 72 || r.width < 20 || r.height < 20) return false;
      if (r.right < window.innerWidth - 160) return false;
      let lab = "";
      let n = el;
      for (let i = 0; i < 5 && n; i++) {
        lab += " " + (n.getAttribute && (n.getAttribute("aria-label") || "") || "");
        n = n.parentElement;
      }
      return !skip.test(norm(lab));
    });
    imgs.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
    return imgs[0] || null;
  }

  function profileRows(dialog) {
    const root = dialog || findDialog() || document;
    const rows = [];
    const nodes = Array.from(root.querySelectorAll("[role='listitem'], [role='option'], a, div")).filter(visible);
    for (const el of nodes) {
      const t = (el.innerText || "").trim();
      const n = norm(t);
      if (!t || t.length > 80) continue;
      if (/lihat semua profil|lihat profil selengkapnya|see all profiles|see more profiles|cari profil|search profiles|profil & halaman|profiles and pages|your profiles/.test(n)) continue;
      if (/setelan|bantuan|laporkan|logout|tampilkan/.test(n)) continue;
      const lines = t.split("\n").map((s) => s.trim()).filter(Boolean);
      if (!lines.length) continue;
      const name = lines[0];
      if (name.split(" ").length > 6) continue;
      if (!/[A-Za-zÀ-ÿ]/.test(name)) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 28 || r.height > 90) continue;
      rows.push({ el: clickableAncestor(el), top: r.top, name });
    }
    rows.sort((a, b) => a.top - b.top);
    const uniq = [];
    const seen = new Set();
    for (const row of rows) {
      if (seen.has(row.name)) continue;
      seen.add(row.name);
      uniq.push(row);
    }
    return uniq;
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

  function moreProfilesBtn(root) {
    const d = root || findDialog() || document;
    return (
      findAny(d, ["Lihat Profil Selengkapnya", "See more profiles", "See More Profiles"]) ||
      null
    );
  }

  async function step6GantiHalaman() {
    const acc = findAccountButton();
    if (!acc) return { ok: false, msg: "Foto akun kanan atas belum ketemu." };
    clickAt(acc);

    const allBtn = await waitUntil(
      () =>
        findAny(document, ["Lihat semua profil", "See all profiles", "See All Profiles"]),
      8000,
      300
    );
    if (!allBtn) {
      return { ok: false, msg: "Menu akun terbuka? 'Lihat semua profil' belum ketemu (timeout)." };
    }
    clickEl(allBtn);

    const dialogReady = await waitUntil(() => {
      const d = findDialog();
      if (!d) return null;
      const tx = norm(d.innerText);
      return tx.includes("profil & halaman") || tx.includes("cari profil") || tx.includes("profiles and pages") || tx.includes("your profiles") || tx.includes("search profiles") ? d : null;
    }, 10000, 300);
    if (!dialogReady) return { ok: false, msg: "Dialog Profil & Halaman belum muncul (koneksi lambat?)." };

    for (let i = 0; i < 25; i++) {
      const more = moreProfilesBtn(findDialog());
      if (!more) break;
      const before = profileRows(findDialog()).length;
      more.scrollIntoView({ block: "center" });
      clickEl(more);
      await waitUntil(() => {
        if (!moreProfilesBtn(findDialog())) return true;
        return profileRows(findDialog()).length > before;
      }, 8000, 300);
    }

    const list = profileRows(findDialog() || document);
    if (!list.length) return { ok: false, msg: "Daftar halaman kosong." };
    const last = list[list.length - 1];
    last.el.scrollIntoView({ block: "center" });
    clickEl(last.el);

    await waitUntil(() => {
      const d = findDialog();
      if (!d || !visible(d)) return true;
      const tx = norm(d.innerText);
      return !(tx.includes("profil & halaman") || tx.includes("profiles and pages") || tx.includes("your profiles"));
    }, 15000, 400);

    return { ok: true, msg: "Pindah ke halaman paling bawah: " + last.name + ". Loading ditunggu." };
  }

  const STEPS = {
    1: step1ClickTambahAtas,
    2: step2KlikBerikutnya,
    3: step3CariUid,
    4: step4KontrolDanBerikan,
    5: step5Konfirmasi,
    6: step6GantiHalaman,
  };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== "RUN_STEP") return;
    const fn = STEPS[msg.step];
    if (!fn) {
      sendResponse({ ok: false, msg: "Langkah " + msg.step + " belum ada." });
      return;
    }
    Promise.resolve(fn(msg))
      .then((res) => sendResponse(res))
      .catch((e) => sendResponse({ ok: false, msg: String(e) }));
    return true;
  });


  async function loadPublicCountries() {
    const res = await fetch("https://randialwi.github.io/tier1/", { cache: "no-store" });
    if (!res.ok) throw new Error("List negara gagal dimuat (" + res.status + ").");
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const ta = doc.getElementById("negaraList") || doc.getElementById("list");
    const raw = (ta && (ta.textContent || "")) || "";
    return raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }

  function findCountryInput() {
    const inputs = Array.from(document.querySelectorAll("input")).filter(visible);
    return (
      inputs.find((el) => /search countr|cari negara/i.test(el.getAttribute("placeholder") || "")) ||
      inputs.find((el) => /search countr|cari negara/i.test(el.getAttribute("aria-label") || "")) ||
      null
    );
  }

  function exactOption(name) {
    const want = norm(name);
    const nodes = Array.from(document.querySelectorAll("[role='option'], [role='listbox'] *")).filter(visible);
    const hits = nodes.filter((el) => norm(el.innerText || el.textContent) === want);
    hits.sort((a, b) => (a.innerText || "").length - (b.innerText || "").length);
    return hits[0] || null;
  }

  function countryChipOn(name) {
    const want = norm(name);
    const nodes = Array.from(document.querySelectorAll("div, span, button")).filter(visible);
    return nodes.some((el) => {
      const tx = norm(el.innerText || "");
      if (!(tx === want || tx === want + " ×" || tx === want + " x")) return false;
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

  async function isiNegaraPublik(onStatus) {
    const list = await loadPublicCountries();
    if (!list.length) return { ok: false, msg: "Daftar negara kosong di github.io." };
    const input = findCountryInput();
    if (!input) {
      return { ok: false, msg: "Kotak Search countries belum kelihatan. Buka Country restrictions dulu." };
    }
    let done = 0;
    for (const name of list) {
      if (countryChipOn(name)) {
        done += 1;
        if (onStatus) onStatus(name + " sudah ada (" + done + "/" + list.length + ")");
        continue;
      }
      if (onStatus) onStatus("Ketik: " + name + " (" + (done + 1) + "/" + list.length + ")");
      input.scrollIntoView({ block: "center" });
      await typeCountry(input, name);
      const opt = await waitUntil(() => exactOption(name), 8000, 250);
      if (!opt) {
        return { ok: false, msg: "Opsi persis tidak ketemu: " + name + ". Berhenti. Sudah " + done + " negara." };
      }
      clickEl(opt);
      const chip = await waitUntil(() => countryChipOn(name), 8000, 250);
      if (!chip) {
        return { ok: false, msg: "Chip tidak muncul: " + name + ". Berhenti. Sudah " + done + " negara." };
      }
      done += 1;
      await sleep(350);
    }
    return { ok: true, msg: "Selesai " + done + " negara. Tombol Save Facebook masih manual." };
  }

  async function loadPublicKomen() {
    const res = await fetch("https://randialwi.github.io/tier1/", { cache: "no-store" });
    if (!res.ok) throw new Error("List blok komen gagal dimuat (" + res.status + ").");
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const ta = doc.getElementById("komenList");
    return ((ta && ta.textContent) || "").trim();
  }

  function findKeywordBox() {
    const nodes = Array.from(document.querySelectorAll("textarea, input, [contenteditable='true'], [role='textbox']")).filter(visible);
    return (
      nodes.find((el) => /keyword|kata kunci|1,000|1000/i.test(
        (el.getAttribute("placeholder") || "") + " " +
        (el.getAttribute("aria-label") || "") + " " +
        (el.getAttribute("aria-placeholder") || "")
      )) || null
    );
  }

  async function isiKomenPublik() {
    const text = await loadPublicKomen();
    if (!text) return { ok: false, msg: "List blok komen kosong di github.io." };
    const box = findKeywordBox();
    if (!box) return { ok: false, msg: "Kotak keywords belum kelihatan. Buka Hide comments dulu." };
    box.focus();
    if (box.tagName === "TEXTAREA" || box.tagName === "INPUT") {
      nativeSetInput(box, text);
    } else {
      box.focus();
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, text);
    }
    await sleep(200);
    box.focus();
    const enter = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
    box.dispatchEvent(new KeyboardEvent("keydown", enter));
    box.dispatchEvent(new KeyboardEvent("keypress", enter));
    box.dispatchEvent(new KeyboardEvent("keyup", enter));
    return { ok: true, msg: "Keywords terisi lalu Enter. Save masih manual." };
  }

  function mountPanel() {
    if (document.getElementById("fb-akses-helper-root")) return;
    const host = document.createElement("div");
    host.id = "fb-akses-helper-root";
    host.style.cssText = "position:fixed;bottom:24px;left:16px;top:auto;right:auto;z-index:2147483647;width:270px;";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .box { font-family: system-ui,sans-serif; background:#fff; color:#050505;
          border-radius:12px; box-shadow:0 8px 28px rgba(0,0,0,.25); padding:12px;
          border:1px solid #ddd; }
        h1 { font-size:14px; margin:0 0 6px; cursor:move; }
        p, label, .st { font-size:11px; color:#65676b; margin:0 0 4px; }
        input { width:100%; box-sizing:border-box; padding:5px; border:1px solid #ccd0d5; border-radius:6px; margin:2px 0 5px; }
        button { width:100%; margin-top:4px; border:0; border-radius:7px; padding:7px; background:#1877f2; color:#fff; font-weight:600; cursor:pointer; font-size:12px; }
        button:hover { background:#166fe5; }
        .hr { border:0; border-top:1px solid #e4e6eb; margin:8px 0 4px; }
        .row { display:flex; gap:6px; }
        .row button { flex:1; }
        button.sc { background:#e4e6eb; color:#050505; font-size:11px; padding:6px 4px; }
        button.sc:hover { background:#d8dadf; }
        #togNotes { background:#e4e6eb; color:#050505; text-align:left; }
        #togNotes:hover { background:#d8dadf; }
        .tabs { display:flex; gap:4px; margin:6px 0 4px; }
        .tabs button { flex:1; background:#e4e6eb; color:#050505; padding:5px 2px; font-size:10px; }
        .tabs button.on { background:#1877f2; color:#fff; }
        #ntitle, #nbody { width:100%; box-sizing:border-box; padding:5px; border:1px solid #ccd0d5; border-radius:6px; font-size:11px; font-family:inherit; }
        #nbody { min-height:72px; resize:vertical; margin-top:4px; }
        #ncopy { background:#e4e6eb; color:#050505; }
        #ncopy:hover { background:#d8dadf; }
        .st { min-height:16px; margin-top:8px; }
        .hide { float:right; background:#eee; color:#333; width:auto; padding:2px 8px; margin:0; }
      </style>
      <div class="box" id="box">
        <button class="hide" id="min">sembunyi</button>
        <button class="hide" id="reset" style="margin-right:6px">reset posisi</button>
        <h1 id="drag">FB Helper</h1>
        <label>UID 1</label><input id="uid1" type="text" />
        <label>UID 2</label><input id="uid2" type="text" />
        <p id="now">Aktif: UID 1</p>
        <button data-s="1">1. Tambahkan Baru + Berikutnya</button>
        <button data-s="3">3. Isi UID aktif + klik nama</button>
        <button data-s="4">4. Kontrol penuh + Berikan akses</button>
        <button data-s="5">5. Konfirmasi</button>
        <button data-s="6">6. Ganti halaman (paling bawah)</button>
        <button id="isiNegara">Isi negara (list publik)</button>
        <button id="isiKomen">Isi blok komen (list publik)</button>
        <hr class="hr" />
        <div class="row">
          <button class="sc" data-url="https://www.facebook.com/help/delete_account">Hapus halaman</button>
          <button class="sc" data-url="https://www.facebook.com/settings/?tab=profile_access">Undang admin</button>
        </div>
        <div class="row">
          <button class="sc" data-url="https://www.facebook.com/pages/?category=invites&ref=bookmarks">Cek undangan</button>
          <button class="sc" data-url="https://www.facebook.com/profile.php?id=&sk=reels_tab">Cek reels</button>
        </div>
        <div class="row">
          <button class="sc" data-url="https://www.facebook.com/settings/?tab=profile_quality&show_dialog=0&ref=account_status&referrer=three_dot_menu_settings">Cek rekomendasi</button>
          <button class="sc" data-url="https://www.facebook.com/settings/reactivation">Cek nonaktif</button>
        </div>
        <div class="row">
          <button class="sc" data-url="https://www.facebook.com/settings/?tab=applications">Acc tester</button>
          <button class="sc" data-url="https://www.facebook.com/profile.php">My profile</button>
        </div>
        <div class="row">
          <button class="sc" data-url="https://www.facebook.com/settings/?tab=followers_and_public_content">Blok negara</button>
          <button class="sc" data-url="https://randialwi.github.io/tier1/#negara">List negara</button>
        </div>
        <div class="row">
          <button class="sc" data-url="https://randialwi.github.io/tier1/#komen">List blok komen</button>
        </div>
        <button id="togNotes">Catatan ▸</button>
        <div id="notesBox" style="display:none">
          <div class="tabs">
            <button data-n="0" class="on">Negara</button>
            <button data-n="1">Blok komen</button>
            <button data-n="2">Lainnya</button>
          </div>
          <input id="ntitle" type="text" placeholder="Judul paket" />
          <textarea id="nbody" placeholder="Isi catatan / keywords"></textarea>
          <button id="ncopy">Salin</button>
        </div>
        <div class="st" id="st"></div>
      </div>
    `;
    document.documentElement.appendChild(host);

    const ins = [shadow.getElementById("uid1"), shadow.getElementById("uid2")];
    const st = shadow.getElementById("st");
    const now = shadow.getElementById("now");
    let active = 0;

    function saveUids() {
      const uids = ins.map((el) => el.value.trim());
      try { chrome.storage.local.set({ uids, uid: uids[active] || uids[0] || "" }); } catch (_) {}
    }
    function setActive(i) {
      active = i;
      now.textContent = "Aktif: UID " + (i + 1) + (ins[i].value ? " (" + ins[i].value + ")" : " (kosong)");
      ins.forEach((el, idx) => { el.style.borderColor = idx === active ? "#1877f2" : "#ccd0d5"; });
    }
    function currentUid() { return ins[active].value.trim(); }

    try {
      chrome.storage.local.get(["uids", "uid"], (d) => {
        const list = Array.isArray(d.uids) ? d.uids : (d.uid ? [d.uid] : []);
        list.slice(0, 2).forEach((v, i) => { ins[i].value = v || ""; });
        setActive(0);
      });
    } catch (_) { setActive(0); }

    ins.forEach((el, i) => {
      el.addEventListener("focus", () => setActive(i));
      el.addEventListener("change", () => { setActive(i); saveUids(); });
      el.addEventListener("input", () => { setActive(i); saveUids(); });
    });

    const notesBox = shadow.getElementById("notesBox");
    const togNotes = shadow.getElementById("togNotes");
    const ntitle = shadow.getElementById("ntitle");
    const nbody = shadow.getElementById("nbody");
    const tabBtns = Array.from(shadow.querySelectorAll(".tabs [data-n]"));
    let notesOpen = false;
    let notesI = 0;
    let notesTitles = ["Negara", "Blok komen", "Lainnya"];
    let notesBodies = ["", "", ""];

    function saveNotes() {
      try {
        chrome.storage.local.set({ notesOpen, notesI, notesTitles, notesBodies });
      } catch (_) {}
    }
    function paintNotes() {
      ntitle.value = notesTitles[notesI] || "";
      nbody.value = notesBodies[notesI] || "";
      tabBtns.forEach((b, i) => {
        b.textContent = notesTitles[i] || ["A", "B", "C"][i];
        b.classList.toggle("on", i === notesI);
      });
      notesBox.style.display = notesOpen ? "block" : "none";
      togNotes.textContent = notesOpen ? "Catatan ▾" : "Catatan ▸";
    }
    togNotes.addEventListener("click", () => {
      notesOpen = !notesOpen;
      paintNotes();
      saveNotes();
    });
    tabBtns.forEach((b) => {
      b.addEventListener("click", () => {
        notesI = Number(b.getAttribute("data-n"));
        paintNotes();
        saveNotes();
      });
    });
    ntitle.addEventListener("input", () => {
      notesTitles[notesI] = ntitle.value;
      tabBtns[notesI].textContent = ntitle.value || ["A", "B", "C"][notesI];
      saveNotes();
    });
    nbody.addEventListener("input", () => {
      notesBodies[notesI] = nbody.value;
      saveNotes();
    });
    shadow.getElementById("ncopy").addEventListener("click", async () => {
      const text = nbody.value || "";
      try {
        await navigator.clipboard.writeText(text);
        st.textContent = "Catatan disalin.";
        st.style.color = "#1b5e20";
      } catch (_) {
        nbody.select();
        document.execCommand("copy");
        st.textContent = "Catatan disalin.";
        st.style.color = "#1b5e20";
      }
    });
    try {
      chrome.storage.local.get(["notesOpen", "notesI", "notesTitles", "notesBodies"], (d) => {
        if (typeof d.notesOpen === "boolean") notesOpen = d.notesOpen;
        if (typeof d.notesI === "number") notesI = Math.min(2, Math.max(0, d.notesI));
        if (Array.isArray(d.notesTitles) && d.notesTitles.length === 3) notesTitles = d.notesTitles.map((x) => String(x || ""));
        if (Array.isArray(d.notesBodies) && d.notesBodies.length === 3) notesBodies = d.notesBodies.map((x) => String(x || ""));
        paintNotes();
      });
    } catch (_) { paintNotes(); }

    async function say(n, extra) {
      st.textContent = extra || ("Menjalankan langkah " + n + "…");
      st.style.color = "#65676b";
      const uid = currentUid();
      saveUids();
      const res = await STEPS[n]({ uid });
      st.textContent = res.msg || "Selesai";
      st.style.color = res.ok ? "#1b5e20" : "#d32f2f";
      return res;
    }

    shadow.querySelectorAll("button.sc[data-url]").forEach((b) => {
      b.addEventListener("click", () => {
        const url = b.getAttribute("data-url");
        if (!url) return;
        if (url.includes("randialwi.github.io/tier1")) window.open(url, "_blank", "noopener");
        else location.href = url;
      });
    });

    shadow.querySelectorAll("button[data-s]").forEach((b) => {
      b.addEventListener("click", async () => {
        try { await say(Number(b.getAttribute("data-s"))); }
        catch (e) { st.textContent = String(e); st.style.color = "#d32f2f"; }
      });
    });

    shadow.getElementById("isiNegara").addEventListener("click", async () => {
      try {
        st.style.color = "#65676b";
        st.textContent = "Mengambil list negara…";
        const res = await isiNegaraPublik((m) => { st.textContent = m; st.style.color = "#65676b"; });
        st.textContent = res.msg || "Selesai";
        st.style.color = res.ok ? "#1b5e20" : "#d32f2f";
      } catch (e) {
        st.textContent = String(e);
        st.style.color = "#d32f2f";
      }
    });

    shadow.getElementById("isiKomen").addEventListener("click", async () => {
      try {
        st.style.color = "#65676b";
        st.textContent = "Mengambil list blok komen…";
        const res = await isiKomenPublik();
        st.textContent = res.msg || "Selesai";
        st.style.color = res.ok ? "#1b5e20" : "#d32f2f";
      } catch (e) {
        st.textContent = String(e);
        st.style.color = "#d32f2f";
      }
    });

    const box = shadow.getElementById("box");

    const helper = document.createElement("div");
    helper.id = "fb-akses-helper-tab";
    helper.style.cssText = "position:fixed;left:16px;bottom:24px;top:auto;right:auto;z-index:2147483647;display:none;";
    const hBtn = document.createElement("button");
    hBtn.textContent = "FB Helper";
    hBtn.style.cssText = "border:0;border-radius:20px;padding:8px 12px;background:#1877f2;color:#fff;font-weight:700;cursor:move;box-shadow:0 4px 16px rgba(0,0,0,.25);font-family:system-ui,sans-serif";
    helper.appendChild(hBtn);
    document.documentElement.appendChild(helper);

    function clamp(el, left, top) {
      const w = el.offsetWidth || 80;
      const maxL = Math.max(8, window.innerWidth - w - 8);
      const maxT = Math.max(8, window.innerHeight - 48);
      const l = Math.min(maxL, Math.max(8, left));
      const t = Math.min(maxT, Math.max(8, top));
      el.style.left = l + "px";
      el.style.top = t + "px";
      el.style.right = "auto";
      el.style.bottom = "auto";
      return { l, t };
    }
    function saveLayout(extra) {
      const pr = host.getBoundingClientRect();
      const hr = helper.getBoundingClientRect();
      const data = Object.assign({
        panelHidden: helper.style.display === "block",
        panelLeft: pr.left,
        panelTop: pr.top,
        helperLeft: hr.left,
        helperTop: hr.top
      }, extra || {});
      try { chrome.storage.local.set(data); } catch (_) {}
    }
    function hidePanel() {
      host.style.display = "none";
      helper.style.display = "block";
      saveLayout({ panelHidden: true });
    }
    function showPanel() {
      helper.style.display = "none";
      host.style.display = "block";
      saveLayout({ panelHidden: false });
    }
    function resetPos() {
      host.style.display = "block";
      helper.style.display = "none";
      host.style.top = "auto";
      host.style.left = "16px";
      host.style.right = "auto";
      host.style.bottom = "24px";
      helper.style.top = "auto";
      helper.style.left = "16px";
      helper.style.right = "auto";
      helper.style.bottom = "24px";
      try {
        chrome.storage.local.set({
          panelHidden: false,
          panelLeft: null,
          panelTop: null,
          helperLeft: null,
          helperTop: null
        });
      } catch (_) {}
    }

    shadow.getElementById("min").addEventListener("click", hidePanel);
    shadow.getElementById("reset").addEventListener("click", (e) => {
      e.stopPropagation();
      resetPos();
    });

    let helperMoved = false;
    hBtn.addEventListener("click", () => {
      if (helperMoved) return;
      showPanel();
    });

    function makeDrag(handle, el, kind) {
      let sx, sy, ox, oy, down = false;
      handle.addEventListener("mousedown", (e) => {
        down = true;
        helperMoved = false;
        sx = e.clientX; sy = e.clientY;
        const r = el.getBoundingClientRect();
        ox = r.left; oy = r.top;
        e.preventDefault();
      });
      window.addEventListener("mousemove", (e) => {
        if (!down) return;
        if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 4) helperMoved = true;
        clamp(el, ox + (e.clientX - sx), oy + (e.clientY - sy));
      });
      window.addEventListener("mouseup", () => {
        if (down) saveLayout(kind === "helper" ? { panelHidden: true } : { panelHidden: host.style.display !== "none" ? false : true });
        down = false;
      });
    }
    makeDrag(shadow.getElementById("drag"), host, "panel");
    makeDrag(hBtn, helper, "helper");

    try {
      chrome.storage.local.get(["panelHidden", "panelLeft", "panelTop", "helperLeft", "helperTop"], (d) => {
        if (typeof d.panelLeft === "number" && typeof d.panelTop === "number") clamp(host, d.panelLeft, d.panelTop);
        if (typeof d.helperLeft === "number" && typeof d.helperTop === "number") clamp(helper, d.helperLeft, d.helperTop);
        if (d.panelHidden) {
          host.style.display = "none";
          helper.style.display = "block";
        }
      });
    } catch (_) {}

    window.addEventListener("resize", () => {
      const r = host.getBoundingClientRect();
      if (host.style.display !== "none" && (r.top < 8 || r.left < 8 || r.top > window.innerHeight - 40)) resetPos();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountPanel);
  } else {
    mountPanel();
  }
})();
