"use strict";
const fileInput = document.querySelector("#bankFile");
const bankCount = document.querySelector("#bankCount");
const status = document.querySelector("#status");
const results = document.querySelector("#results");
const query = document.querySelector("#query");
let bank = [];
let customBank = [];

function setStatus(message) { status.textContent = message; }

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
    score.textContent = `相似度 ${Math.round(item.score * 100)}%`;
    card.append(title, score);
    if (item.answer) {
      const answer = document.createElement("p");
      answer.className = "answer";
      answer.textContent = `答案：${item.answer}`;
      card.append(answer);
    }
    results.append(card);
  }
}

function runSearch(queries) {
  if (!bank.length) { setStatus("請先匯入題庫。"); return; }
  const cleaned = queries.map(s => s.trim()).filter(Boolean);
  if (!cleaned.length) { setStatus("找不到可搜尋的題目文字。"); return; }
  const matches = QuestionSearch.search(bank, cleaned);
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
    bankCount.textContent = `目前可搜尋 ${bank.length} 題（新增題庫儲存在本機）`;
    setStatus(`已加入 ${parsed.length} 題。`);
  } catch (error) { setStatus(`匯入失敗：${error.message}`); }
});

document.querySelector("#search").addEventListener("click", () => runSearch([query.value]));
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

Promise.all([
  Promise.all(["bank.json", "os-bank.json"].map(name =>
    fetch(chrome.runtime.getURL(name)).then(response => response.json())
  )).then(parts => parts.flat()),
  chrome.storage.local.get(["customBank", "bank"])
]).then(([builtIn, data]) => {
  customBank = Array.isArray(data.customBank) ? data.customBank : (Array.isArray(data.bank) ? data.bank : []);
  bank = QuestionSearch.mergeBanks(builtIn, customBank);
  bankCount.textContent = `目前可搜尋 ${bank.length} 題（內建演算法 439 題、作業系統 891 題）`;
}).catch(() => setStatus("題庫載入失敗，請重新開啟側邊面板。"));
