"use strict";
const fileInput = document.querySelector("#bankFile");
const imageFileInput = document.querySelector("#imageFile");
const pasteZone = document.querySelector("#pasteZone");
const bankCount = document.querySelector("#bankCount");
const manageStatus = document.querySelector("#manageStatus");
const ocrText = document.querySelector("#ocrText");
const questionBox = document.querySelector("#questionBox");
const questionText = document.querySelector("#questionText");
const questionSource = document.querySelector("#questionSource");
const copyStatus = document.querySelector("#copyStatus");
const status = document.querySelector("#status");
const results = document.querySelector("#results");
const addView = document.querySelector("#addView");
const addStatus = document.querySelector("#addStatus");
const addRawText = document.querySelector("#addRawText");
const addPasteZone = document.querySelector("#addPasteZone");
const addImageFile = document.querySelector("#addImageFile");
const newQuestion = document.querySelector("#newQuestion");
const newOptions = document.querySelector("#newOptions");
const newAnswer = document.querySelector("#newAnswer");
const newSubject = document.querySelector("#newSubject");
const newUnit = document.querySelector("#newUnit");
const newCategory = document.querySelector("#newCategory");
const saveStatus = document.querySelector("#saveStatus");
const manualCount = document.querySelector("#manualCount");
let bank = [];
let customBank = [];
let manualBank = [];
let bankReady;
const siteView = document.querySelector("#siteView");
const site2View = document.querySelector("#site2View");
const searchView = document.querySelector("#searchView");
const showSite = document.querySelector("#showSite");
const showSite2 = document.querySelector("#showSite2");
const showSearch = document.querySelector("#showSearch");
const showAdd = document.querySelector("#showAdd");
const site2Name = document.querySelector("#site2Name");
const site2Url = document.querySelector("#site2Url");
const bankSite2 = document.querySelector("#bankSite2");
const openSite2 = document.querySelector("#openSite2");
const site2Status = document.querySelector("#site2Status");
const defaultSecondSite = {
  url: "https://yocheng06.github.io/course-library/submit.html?v=theme-toggle-20261027",
  name: "題庫網站 2"
};
const originalSiteUrl = "https://os-study-notebook.shij.chatgpt.site/";

function switchView(view) {
  for (const [name, panel, button] of [
    ["site", siteView, showSite], ["site2", site2View, showSite2], ["search", searchView, showSearch], ["add", addView, showAdd]
  ]) {
    const active = view === name;
    panel.hidden = !active;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}
showSite.addEventListener("click", () => switchView("site"));
showSite2.addEventListener("click", () => switchView("site2"));
showSearch.addEventListener("click", () => switchView("search"));
showAdd.addEventListener("click", () => switchView("add"));
document.querySelector("#openSite").addEventListener("click", () =>
  chrome.tabs.create({ url: "https://os-study-notebook.shij.chatgpt.site/" })
);

function validSiteUrl(value) {
  const parsed = new URL(value.trim());
  if (parsed.protocol !== "https:") throw new Error("請輸入 https:// 開頭的網站網址");
  return parsed.href;
}

function displaySite2(url, name) {
  site2Name.value = name || "題庫網站 2";
  showSite2.textContent = site2Name.value;
  site2Url.value = url || "";
  bankSite2.title = site2Name.value;
  bankSite2.hidden = !url;
  openSite2.hidden = !url;
  if (url) bankSite2.src = url;
  else bankSite2.removeAttribute("src");
}

document.querySelector("#saveSite2").addEventListener("click", async () => {
  try {
    const url = validSiteUrl(site2Url.value);
    const name = site2Name.value.trim() || "題庫網站 2";
    await chrome.storage.local.set({ secondSite: { url, name } });
    displaySite2(url, name);
    site2Status.textContent = "已儲存。若網站拒絕在側欄顯示，可按下方按鈕在新分頁開啟。";
  } catch (error) { site2Status.textContent = error.message; }
});
openSite2.addEventListener("click", () => {
  try { chrome.tabs.create({ url: validSiteUrl(site2Url.value) }); }
  catch (error) { site2Status.textContent = error.message; }
});
chrome.storage.local.get("secondSite").then(data => {
  const site = data.secondSite?.url ? data.secondSite : defaultSecondSite;
  displaySite2(site.url, site.name);
});

function setStatus(message) { status.textContent = message; }

function render(matches) {
  results.replaceChildren();
  if (!matches.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "沒有找到相似題目。請裁切出題目區域，或換一張清晰的截圖重試。";
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
    if (item.options) {
      const options = document.createElement("details");
      const heading = document.createElement("summary");
      heading.textContent = "查看選項";
      const value = document.createElement("pre");
      value.className = "option-list";
      value.textContent = item.options;
      options.append(heading, value);
      card.append(options);
    }
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
    if (item.subject === "algorithm" || item.subject === "os") {
      const openOnSite = document.createElement("button");
      openOnSite.className = "secondary";
      openOnSite.textContent = "在原題庫網站查看這題";
      openOnSite.addEventListener("click", () => showQuestionOnSite(item));
      card.append(openOnSite);
    }
    results.append(card);
  }
}

async function showQuestionOnSite(item) {
  try {
    const tabs = await chrome.tabs.query({ url: "https://os-study-notebook.shij.chatgpt.site/*" });
    const tab = tabs[0] || await chrome.tabs.create({ url: originalSiteUrl, active: true });
    await chrome.tabs.update(tab.id, { active: true });
    await waitForTab(tab.id);
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async ({ subject, question }) => {
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        const wanted = subject === "os" ? "作業系統" : "演算法";
        for (let i = 0; i < 100 && !document.querySelector("#home-button"); i++) await sleep(100);
        if (document.querySelector("#subject-title")?.textContent?.trim() !== wanted || document.querySelector("#study")?.hidden) {
          document.querySelector("#home-button")?.click();
          for (let i = 0; i < 100 && document.querySelector("#home")?.hidden; i++) await sleep(100);
          document.querySelector(`[data-subject="${subject}"]`)?.click();
        }
        for (let i = 0; i < 100 && document.querySelector("#subject-title")?.textContent?.trim() !== wanted; i++) await sleep(100);
        document.querySelector('.unit-button[data-unit="all"]')?.click();
        document.querySelector("#lookup")?.click();
        const input = document.querySelector("input#search");
        if (!input) throw new Error("網站搜尋欄不存在");
        input.value = question;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.scrollIntoView({ behavior: "smooth", block: "center" });
        return true;
      },
      args: [{ subject: item.subject, question: item.question }]
    });
    if (!result?.result) throw new Error("無法在網站搜尋此題");
    setStatus("已在原題庫網站搜尋這題。");
  } catch (error) { setStatus(`開啟題目失敗：${error.message}`); }
}

function runSearch(queries) {
  if (!bank.length) { setStatus("題庫尚未載入。"); return []; }
  const cleaned = queries.map(s => s.trim()).filter(Boolean);
  if (!cleaned.length) { setStatus("找不到可搜尋的題目文字。"); return []; }
  const matches = QuestionSearch.search(bank, cleaned);
  render(matches);
  setStatus(`搜尋 ${cleaned.length} 段文字，找到 ${matches.length} 筆相似題目。`);
  return matches;
}

document.querySelector("#copyQuestion").addEventListener("click", async () => {
  const text = questionText.value.trim();
  if (!text) { copyStatus.textContent = "沒有可複製的題目文字。"; return; }
  try {
    await navigator.clipboard.writeText(text);
    copyStatus.textContent = "已複製題目文字。";
  } catch (error) { copyStatus.textContent = `複製失敗：${error.message}`; }
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    const parsed = QuestionSearch.parseBank(await file.text(), file.name);
    customBank = QuestionSearch.mergeBanks(customBank, parsed);
    await chrome.storage.local.set({ customBank });
    bank = QuestionSearch.mergeBanks(bank, parsed);
    bankCount.textContent = `目前可搜尋 ${bank.length} 題（新增題庫儲存在本機）`;
    manageStatus.textContent = `已加入 ${parsed.length} 題。`;
  } catch (error) { manageStatus.textContent = `匯入失敗：${error.message}`; }
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
  manageStatus.textContent = "正在開啟題庫網站並讀取兩科題目…";
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
    bankCount.textContent = `目前可搜尋 ${bank.length} 題（網站同步資料儲存在本機）`;
    manageStatus.textContent = `同步完成：讀取 ${result.result.length} 題，新增 ${bank.length - before} 題。`;
  } catch (error) {
    manageStatus.textContent = `網站同步失敗：${error.message}。可繼續使用內建題庫或匯入 HTML。`;
  } finally {
    if (tab?.id) chrome.tabs.remove(tab.id).catch(() => {});
    button.disabled = false;
  }
});

async function recognizeAndSearch(image) {
  switchView("search");
  ocrText.textContent = "";
  questionBox.hidden = true;
  copyStatus.textContent = "";
  setStatus("正在載入本機 OCR 辨識模型，第一次使用可能需要一些時間…");
  try {
    const text = (await LocalOCR.recognize(image, setStatus)).trim();
    if (!text) { setStatus("截圖中沒有辨識出文字。請裁切到題目區域後重試。"); return; }
    ocrText.textContent = text.slice(0, 3000);
    await bankReady;
    const parsedQuestion = LocalOCR.extractQuestion(text);
    const primary = parsedQuestion ? runSearch([parsedQuestion]) : [];
    const matches = primary[0]?.score >= 0.8 ? primary : runSearch(LocalOCR.passages(text));
    const bankQuestion = matches[0]?.score >= 0.8 ? matches[0].question : "";
    const extracted = bankQuestion || parsedQuestion;
    if (extracted) {
      questionText.value = extracted;
      questionSource.textContent = bankQuestion ? "已使用題庫中匹配的完整題幹。" : "由截圖文字擷取，複製前請確認。";
      questionBox.hidden = false;
    }
  } catch (error) {
    setStatus(`截圖辨識失敗：${error.message}`);
  }
}

async function recognizeForAdd(image) {
  switchView("add");
  addStatus.textContent = "正在辨識截圖…";
  addRawText.textContent = "";
  saveStatus.textContent = "";
  newQuestion.value = "";
  newOptions.value = "";
  newAnswer.value = "";
  try {
    const text = (await LocalOCR.recognize(image, message => { addStatus.textContent = message; })).trim();
    if (!text) { addStatus.textContent = "截圖中沒有辨識出文字。請裁切到題目區域後重試。"; return; }
    const item = LocalOCR.extractStudyItem(text);
    addRawText.textContent = text.slice(0, 6000);
    newQuestion.value = item.question;
    newOptions.value = item.options;
    newAnswer.value = item.answer;
    addStatus.textContent = item.answerFound
      ? "已讀取題目與標示的正確答案；請核對後儲存。"
      : "已讀取題目。截圖沒有明確標示正確答案，請自行核對並填寫。";
  } catch (error) { addStatus.textContent = `辨識失敗：${error.message}`; }
}

document.querySelector("#addCapture").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || tab.windowId === undefined) throw new Error("找不到目前分頁");
    await recognizeForAdd(await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }));
  } catch (error) { addStatus.textContent = `無法擷取畫面：${error.message}`; }
});

addImageFile.addEventListener("change", () => {
  const file = addImageFile.files?.[0];
  if (file) recognizeForAdd(file);
});
addPasteZone.addEventListener("click", () => addPasteZone.focus());

document.querySelector("#addSave").addEventListener("click", async () => {
  const question = newQuestion.value.trim();
  const answer = newAnswer.value.trim();
  const unit = newUnit.value ? Number(newUnit.value) : null;
  if (!question) { saveStatus.textContent = "請先確認題目文字。"; return; }
  if (!answer) { saveStatus.textContent = "請先填寫並確認正確答案。"; return; }
  if (unit !== null && (!Number.isInteger(unit) || unit < 1)) { saveStatus.textContent = "網站單元須為正整數。"; return; }
  try {
    await bankReady;
    if (bank.some(item => item.subject === newSubject.value && QuestionSearch.normalize(item.question) === QuestionSearch.normalize(question))) {
      saveStatus.textContent = "題庫已有相同題目，請確認後再新增。";
      return;
    }
    const item = {
      sourceId: `local-${crypto.randomUUID()}`,
      question, options: newOptions.value.trim(), answer,
      subject: newSubject.value,
      unit, unitLabel: unit ? `第 ${unit} 單元` : "",
      category: newCategory.value.trim() || "自行新增"
    };
    const nextManualBank = [...manualBank, item];
    await chrome.storage.local.set({ manualBank: nextManualBank });
    manualBank = nextManualBank;
    bank = QuestionSearch.mergeBanks(bank, [item]);
    bankCount.textContent = `目前可搜尋 ${bank.length} 題（含自行新增 ${manualBank.length} 題）`;
    manualCount.textContent = `自行新增 ${manualBank.length} 題，儲存在本機瀏覽器。`;
    saveStatus.textContent = "已加入本機題庫。";
  } catch (error) { saveStatus.textContent = `儲存失敗：${error.message}`; }
});

document.querySelector("#exportAdded").addEventListener("click", () => {
  if (!manualBank.length) { saveStatus.textContent = "目前沒有自行新增的題目。"; return; }
  const url = URL.createObjectURL(new Blob([JSON.stringify(manualBank, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "OS_agent_自行新增題庫.json";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
});

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
  if (!addView.hidden) recognizeForAdd(image);
  else recognizeAndSearch(image);
});

let consumingScreenshot = false;
async function consumePendingScreenshot() {
  if (consumingScreenshot) return;
  consumingScreenshot = true;
  try {
    const data = await chrome.storage.session.get(["pendingScreenshot", "captureError", "openOcrPanel"]);
    if (data.pendingScreenshot) {
      await chrome.storage.session.remove(["pendingScreenshot", "captureError"]);
      await recognizeAndSearch(data.pendingScreenshot);
    } else if (data.captureError) {
      await chrome.storage.session.remove("captureError");
      switchView("search");
      setStatus(`快捷鍵截圖失敗：${data.captureError}`);
    } else if (data.openOcrPanel) {
      await chrome.storage.session.remove("openOcrPanel");
      switchView("search");
      pasteZone.focus();
      setStatus("請複製題目截圖後按 Ctrl+V，或在上方選擇圖片檔案。");
    }
  } finally { consumingScreenshot = false; }
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && (changes.pendingScreenshot || changes.captureError || changes.openOcrPanel)) consumePendingScreenshot();
});
consumePendingScreenshot();

bankReady = Promise.all([
  Promise.all(["bank.json", "os-bank.json"].map(name =>
    fetch(chrome.runtime.getURL(name)).then(response => response.json())
  )).then(parts => parts.flat()),
  chrome.storage.local.get(["customBank", "bank", "manualBank"])
]).then(([builtIn, data]) => {
  customBank = Array.isArray(data.customBank) ? data.customBank : (Array.isArray(data.bank) ? data.bank : []);
  manualBank = Array.isArray(data.manualBank) ? data.manualBank : [];
  bank = QuestionSearch.mergeBanks(QuestionSearch.mergeBanks(builtIn, customBank), manualBank);
  manualCount.textContent = `自行新增 ${manualBank.length} 題，儲存在本機瀏覽器。`;
  const algorithmCount = builtIn.filter(item => item.subject === "algorithm").length;
  const osCount = builtIn.filter(item => item.subject === "os").length;
  bankCount.textContent = `目前可搜尋 ${bank.length} 題（內建演算法 ${algorithmCount} 題、作業系統 ${osCount} 題）`;
}).catch(() => setStatus("題庫載入失敗，請重新開啟側邊面板。"));
