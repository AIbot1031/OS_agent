"use strict";
const fileInput = document.querySelector("#bankFile");
const imageFileInput = document.querySelector("#imageFile");
const pasteZone = document.querySelector("#pasteZone");
const bankCount = document.querySelector("#bankCount");
const status = document.querySelector("#status");
const results = document.querySelector("#results");
const query = document.querySelector("#query");
const subjectInput = document.querySelector("#subject");
const unitInput = document.querySelector("#unit");
const chapterInput = document.querySelector("#chapter");
let bank = [];
let customBank = [];
let bankReady;
const siteView = document.querySelector("#siteView");
const searchView = document.querySelector("#searchView");
const showSite = document.querySelector("#showSite");
const showSearch = document.querySelector("#showSearch");

function switchView(view) {
  const site = view === "site";
  siteView.hidden = !site;
  searchView.hidden = site;
  showSite.classList.toggle("active", site);
  showSearch.classList.toggle("active", !site);
  showSite.setAttribute("aria-pressed", String(site));
  showSearch.setAttribute("aria-pressed", String(!site));
}
showSite.addEventListener("click", () => switchView("site"));
showSearch.addEventListener("click", () => switchView("search"));
document.querySelector("#openSite").addEventListener("click", () =>
  chrome.tabs.create({ url: "https://os-study-notebook.shij.chatgpt.site/" })
);

function setStatus(message) { status.textContent = message; }

function updateUnits() {
  const previous = unitInput.value;
  const scoped = bank.filter(item => !subjectInput.value || item.subject === subjectInput.value);
  const units = [...new Map(scoped.filter(item => item.unit).map(item => [String(item.unit), item.unitLabel || `第 ${item.unit} 單元`])).entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  unitInput.replaceChildren(new Option("全部單元", ""), ...units.map(([value, label]) => new Option(label, value)));
  if (units.some(([value]) => value === previous)) unitInput.value = previous;
}

function updateChapters() {
  const previous = chapterInput.value;
  const scoped = bank.filter(item =>
    (!subjectInput.value || item.subject === subjectInput.value) &&
    (!unitInput.value || String(item.unit) === unitInput.value)
  );
  const categories = [...new Set(scoped.map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hant"));
  chapterInput.replaceChildren(new Option("全部主題", ""), ...categories.map(category => new Option(category, category)));
  if (categories.includes(previous)) chapterInput.value = previous;
}

function render(matches) {
  results.replaceChildren();
  if (!matches.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "沒有找到相似題目。可試著選取題幹或輸入更完整的文字。";
    results.append(empty);
    return;
  }
  for (const item of matches) {
    const card = document.createElement("article");
    card.className = "card";
    const title = document.createElement("h3");
    title.textContent = item.question;
    const score = document.createElement("span");
    score.className = "score";
    score.textContent = `${item.subject === "os" ? "作業系統" : item.subject === "algorithm" ? "演算法" : "未分類"} · ${item.unitLabel || "未分單元"} · ${item.category || "未分類"} · 相似度 ${Math.round(item.score * 100)}%`;
    card.append(title, score);
    if (item.answer) {
      const answer = document.createElement("div");
      answer.className = "answer-block";
      const label = document.createElement("strong");
      label.textContent = "答案";
      answer.append(label);
      const parts = item.answer.split(/\s+\|\s+/).map(part => part.trim()).filter(Boolean);
      if (parts.length > 1) {
        const list = document.createElement("ul");
        for (const part of parts) { const li = document.createElement("li"); li.textContent = part; list.append(li); }
        answer.append(list);
      } else {
        const value = document.createElement("p");
        value.textContent = item.answer;
        answer.append(value);
      }
      card.append(answer);
    }
    results.append(card);
  }
}

function runSearch(queries) {
  if (!bank.length) { setStatus("請先匯入題庫。"); return; }
  const cleaned = queries.map(s => s.trim()).filter(Boolean);
  if (!cleaned.length) { setStatus("找不到可搜尋的題目文字。"); return; }
  const scoped = bank.filter(item =>
    (!subjectInput.value || item.subject === subjectInput.value) &&
    (!unitInput.value || String(item.unit) === unitInput.value) &&
    (!chapterInput.value || item.category === chapterInput.value)
  );
  const matches = QuestionSearch.search(scoped, cleaned);
  render(matches);
  setStatus(`搜尋 ${cleaned.length} 段文字，找到 ${matches.length} 筆相似題目。`);
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    const parsed = QuestionSearch.parseBank(await file.text(), file.name);
    customBank = QuestionSearch.mergeBanks(customBank, parsed);
    await chrome.storage.local.set({ customBank });
    bank = QuestionSearch.mergeBanks(bank, parsed);
    updateUnits();
    updateChapters();
    bankCount.textContent = `目前可搜尋 ${bank.length} 題（新增題庫儲存在本機）`;
    setStatus(`已加入 ${parsed.length} 題。`);
  } catch (error) { setStatus(`匯入失敗：${error.message}`); }
});

async function waitForTab(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (tab.status === "complete") return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { chrome.tabs.onUpdated.removeListener(onUpdate); reject(new Error("網站載入逾時")); }, 30000);
    function onUpdate(updatedId, change) {
      if (updatedId !== tabId || change.status !== "complete") return;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdate);
      resolve();
    }
    chrome.tabs.onUpdated.addListener(onUpdate);
    chrome.tabs.get(tabId).then(current => {
      if (current.status === "complete") onUpdate(tabId, { status: "complete" });
    }).catch(reject);
  });
}

document.querySelector("#syncSite").addEventListener("click", async () => {
  let tab;
  const button = document.querySelector("#syncSite");
  button.disabled = true;
  setStatus("正在開啟題庫網站並讀取兩科題目…");
  try {
    await bankReady;
    tab = await chrome.tabs.create({ url: "https://os-study-notebook.shij.chatgpt.site/", active: false });
    await waitForTab(tab.id);
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["site-sync.js"] });
    if (!Array.isArray(result?.result) || !result.result.length) throw new Error("網站沒有回傳題目");
    const before = bank.length;
    customBank = QuestionSearch.mergeBanks(customBank, result.result);
    await chrome.storage.local.set({ customBank });
    bank = QuestionSearch.mergeBanks(bank, result.result);
    updateUnits(); updateChapters();
    bankCount.textContent = `目前可搜尋 ${bank.length} 題（網站同步資料儲存在本機）`;
    setStatus(`同步完成：讀取 ${result.result.length} 題，新增 ${bank.length - before} 題。`);
  } catch (error) {
    setStatus(`網站同步失敗：${error.message}。可繼續使用內建題庫或匯入 HTML。`);
  } finally {
    if (tab?.id) chrome.tabs.remove(tab.id).catch(() => {});
    button.disabled = false;
  }
});

document.querySelector("#search").addEventListener("click", () => runSearch([query.value]));
subjectInput.addEventListener("change", () => { updateUnits(); updateChapters(); if (query.value.trim()) runSearch([query.value]); });
unitInput.addEventListener("change", () => { updateChapters(); if (query.value.trim()) runSearch([query.value]); });
chapterInput.addEventListener("change", () => { if (query.value.trim()) runSearch([query.value]); });
document.querySelector("#scan").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("找不到目前分頁");
    const [injection] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["scanner.js"] });
    const passages = injection.result || [];
    if (passages.length) query.value = passages[0];
    runSearch(passages);
  } catch (error) {
    setStatus(`無法讀取此頁面：${error.message}。請在一般網頁上重試，或手動輸入題目。`);
  }
});

async function recognizeAndSearch(image) {
  switchView("search");
  setStatus("正在載入本機 OCR 辨識模型，第一次使用可能需要一些時間…");
  try {
    const text = (await LocalOCR.recognize(image, setStatus)).trim();
    if (!text) { setStatus("截圖中沒有辨識出文字。請裁切到題目區域後重試。"); return; }
    query.value = text.slice(0, 3000);
    await bankReady;
    runSearch(LocalOCR.passages(text));
  } catch (error) {
    setStatus(`截圖辨識失敗：${error.message}`);
  }
}

document.querySelector("#capture").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || tab.windowId === undefined) throw new Error("找不到目前分頁");
    const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    await recognizeAndSearch(screenshot);
  } catch (error) {
    setStatus(`無法擷取畫面：${error.message}。也可以上傳截圖檔案。`);
  }
});

imageFileInput.addEventListener("change", () => {
  const file = imageFileInput.files?.[0];
  if (file) recognizeAndSearch(file);
});

pasteZone.addEventListener("click", () => pasteZone.focus());
document.addEventListener("paste", event => {
  const image = [...(event.clipboardData?.items || [])]
    .find(item => item.kind === "file" && item.type.startsWith("image/"))?.getAsFile();
  if (!image) return;
  event.preventDefault();
  recognizeAndSearch(image);
});

let consumingScreenshot = false;
async function consumePendingScreenshot() {
  if (consumingScreenshot) return;
  consumingScreenshot = true;
  try {
    const data = await chrome.storage.session.get(["pendingScreenshot", "captureError"]);
    if (data.pendingScreenshot) {
      await chrome.storage.session.remove(["pendingScreenshot", "captureError"]);
      await recognizeAndSearch(data.pendingScreenshot);
    } else if (data.captureError) {
      await chrome.storage.session.remove("captureError");
      switchView("search");
      setStatus(`快捷鍵截圖失敗：${data.captureError}`);
    }
  } finally { consumingScreenshot = false; }
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && (changes.pendingScreenshot || changes.captureError)) consumePendingScreenshot();
});
consumePendingScreenshot();

bankReady = Promise.all([
  Promise.all(["bank.json", "os-bank.json"].map(name =>
    fetch(chrome.runtime.getURL(name)).then(response => response.json())
  )).then(parts => parts.flat()),
  chrome.storage.local.get(["customBank", "bank"])
]).then(([builtIn, data]) => {
  customBank = Array.isArray(data.customBank) ? data.customBank : (Array.isArray(data.bank) ? data.bank : []);
  bank = QuestionSearch.mergeBanks(builtIn, customBank);
  updateUnits();
  updateChapters();
  const algorithmCount = builtIn.filter(item => item.subject === "algorithm").length;
  const osCount = builtIn.filter(item => item.subject === "os").length;
  bankCount.textContent = `目前可搜尋 ${bank.length} 題（內建演算法 ${algorithmCount} 題、作業系統 ${osCount} 題）`;
}).catch(() => setStatus("題庫載入失敗，請重新開啟側邊面板。"));
