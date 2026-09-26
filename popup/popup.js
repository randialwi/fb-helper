const statusEl = document.getElementById("status");
const uidEl = document.getElementById("uid");

chrome.storage.local.get(["uid"], (d) => {
  if (d.uid) uidEl.value = d.uid;
});

uidEl.addEventListener("change", () => {
  chrome.storage.local.set({ uid: uidEl.value.trim() });
});

function setStatus(text, ok) {
  statusEl.textContent = text;
  statusEl.style.color = ok === false ? "#d32f2f" : ok === true ? "#1b5e20" : "#65676b";
}

async function runStep(n) {
  const uid = uidEl.value.trim();
  chrome.storage.local.set({ uid });
  setStatus("Menjalankan langkah " + n + "…");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    setStatus("Tidak ada tab aktif.", false);
    return;
  }
  if (!/facebook\.com/i.test(tab.url || "")) {
    setStatus("Buka dulu halaman Facebook settings.", false);
    return;
  }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "RUN_STEP", step: n, uid });
    setStatus(res && res.msg ? res.msg : "Selesai.", !!res?.ok);
  } catch (e) {
    setStatus("Content script belum siap. Refresh Facebook + Reload ekstensi.", false);
  }
}

[1, 3, 4, 5, 6].forEach((i) => {
  const el = document.getElementById("step" + i);
  if (el) el.addEventListener("click", () => runStep(i));
});
