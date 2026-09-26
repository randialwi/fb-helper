const ins = [document.getElementById("uid1"), document.getElementById("uid2")];
const st = document.getElementById("st");
const now = document.getElementById("now");
let active = 0;

function setStatus(text, ok) {
  st.textContent = text || "";
  st.style.color = ok === false ? "#d32f2f" : ok === true ? "#1b5e20" : "#65676b";
}

function saveUids() {
  const uids = ins.map((el) => el.value.trim());
  chrome.storage.local.set({ uids, uid: uids[active] || uids[0] || "" });
}

function setActive(i) {
  active = i;
  now.textContent = "Aktif: UID " + (i + 1) + (ins[i].value ? " (" + ins[i].value + ")" : " (kosong)");
  ins.forEach((el, idx) => { el.style.borderColor = idx === active ? "#1877f2" : "#ccd0d5"; });
}

chrome.storage.local.get(["uids", "uid"], (d) => {
  const list = Array.isArray(d.uids) ? d.uids : (d.uid ? [d.uid] : []);
  list.slice(0, 2).forEach((v, i) => { ins[i].value = v || ""; });
  setActive(0);
});

ins.forEach((el, i) => {
  el.addEventListener("focus", () => setActive(i));
  el.addEventListener("change", () => { setActive(i); saveUids(); });
  el.addEventListener("input", () => { setActive(i); saveUids(); });
});

document.getElementById("min").addEventListener("click", () => window.close());

async function facebookTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id || !/https?:\/\/([a-z0-9-]+\.)?facebook\.com\//i.test(tab.url || "")) return null;
  return tab;
}

async function sendToPage(msg) {
  const tab = await facebookTab();
  if (!tab) {
    setStatus("Buka tab Facebook dulu.", false);
    return null;
  }
  try {
    return await chrome.tabs.sendMessage(tab.id, msg);
  } catch (_) {
    setStatus("Skrip belum siap. Reload ekstensi, lalu refresh tab Facebook sekali.", false);
    return null;
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "STATUS" && msg.text) setStatus(msg.text);
});

document.querySelectorAll("button[data-s]").forEach((b) => {
  b.addEventListener("click", async () => {
    const n = Number(b.getAttribute("data-s"));
    saveUids();
    setStatus("Menjalankan langkah " + n + "…");
    const res = await sendToPage({ type: "RUN_STEP", step: n, uid: ins[active].value.trim() });
    if (res) setStatus(res.msg || "Selesai", !!res.ok);
  });
});

document.getElementById("isiNegara").addEventListener("click", async () => {
  setStatus("Mengambil list negara…");
  const res = await sendToPage({ type: "ISI_NEGARA" });
  if (res) setStatus(res.msg || "Selesai", !!res.ok);
});

document.getElementById("isiKomen").addEventListener("click", async () => {
  setStatus("Mengambil list blok komen…");
  const res = await sendToPage({ type: "ISI_KOMEN" });
  if (res) setStatus(res.msg || "Selesai", !!res.ok);
});

document.querySelectorAll("button.sc[data-url]").forEach((b) => {
  b.addEventListener("click", async () => {
    const url = b.getAttribute("data-url");
    if (!url) return;
    if (url.includes("randialwi.github.io")) {
      chrome.tabs.create({ url });
      return;
    }
    const tab = await facebookTab();
    if (tab) chrome.tabs.update(tab.id, { url });
    else chrome.tabs.create({ url });
  });
});

const notesBox = document.getElementById("notesBox");
const togNotes = document.getElementById("togNotes");
const ntitle = document.getElementById("ntitle");
const nbody = document.getElementById("nbody");
const tabBtns = Array.from(document.querySelectorAll(".tabs [data-n]"));
let notesOpen = false;
let notesI = 0;
let notesTitles = ["Negara", "Blok komen", "Lainnya"];
let notesBodies = ["", "", ""];

function saveNotes() {
  chrome.storage.local.set({ notesOpen, notesI, notesTitles, notesBodies });
}
function paintNotes() {
  ntitle.value = notesTitles[notesI] || "";
  nbody.value = notesBodies[notesI] || "";
  tabBtns.forEach((b, i) => {
    b.textContent = notesTitles[i] || ["A", "B", "C"][i];
    b.classList.toggle("on", i === notesI);
  });
  notesBox.style.display = notesOpen ? "block" : "none";
  togNotes.textContent = notesOpen ? "Catatan \u25be" : "Catatan \u25b8";
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
document.getElementById("ncopy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(nbody.value || "");
    setStatus("Catatan disalin.", true);
  } catch (_) {
    nbody.select();
    document.execCommand("copy");
    setStatus("Catatan disalin.", true);
  }
});
chrome.storage.local.get(["notesOpen", "notesI", "notesTitles", "notesBodies"], (d) => {
  if (typeof d.notesOpen === "boolean") notesOpen = d.notesOpen;
  if (typeof d.notesI === "number") notesI = Math.min(2, Math.max(0, d.notesI));
  if (Array.isArray(d.notesTitles) && d.notesTitles.length === 3) notesTitles = d.notesTitles.map((x) => String(x || ""));
  if (Array.isArray(d.notesBodies) && d.notesBodies.length === 3) notesBodies = d.notesBodies.map((x) => String(x || ""));
  paintNotes();
});
