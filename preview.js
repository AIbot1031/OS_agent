"use strict";
const queryInput = document.querySelector("#query");
const subjectInput = document.querySelector("#subject");
const unitInput = document.querySelector("#unit");
const chapterInput = document.querySelector("#chapter");
const results = document.querySelector("#results");
const status = document.querySelector("#status");
let bank = [];

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

function search() {
  const query = queryInput.value.trim();
  results.replaceChildren();
  if (!query) { status.textContent = "請輸入題目或關鍵字。"; return; }
  const scoped = bank.filter(item =>
    (!subjectInput.value || item.subject === subjectInput.value) &&
    (!unitInput.value || String(item.unit) === unitInput.value) &&
    (!chapterInput.value || item.category === chapterInput.value)
  );
  const matches = QuestionSearch.search(scoped, [query]);
  status.textContent = `找到 ${matches.length} 筆相似題目`;
  for (const item of matches) {
    const card = document.createElement("article"); card.className = "result";
    const title = document.createElement("h3"); title.textContent = item.question;
    const meta = document.createElement("div"); meta.className = "meta";
    meta.textContent = `${item.subject === "os" ? "作業系統" : "演算法"} · ${item.unitLabel || "未分單元"} · ${item.category || "未分類"} · ${Math.round(item.score * 100)}% 相似`;
    card.append(title, meta);
    if (item.answer) { const answer = document.createElement("p"); answer.textContent = `答案：${item.answer}`; card.append(answer); }
    results.append(card);
  }
}
document.querySelector("#search").addEventListener("click", search);
document.querySelector("#sampleSearch").addEventListener("click", () => { queryInput.value = document.querySelector("#sample").textContent; search(); });
queryInput.addEventListener("keydown", event => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) search(); });
subjectInput.addEventListener("change", () => { updateUnits(); updateChapters(); search(); });
unitInput.addEventListener("change", () => { updateChapters(); search(); });
chapterInput.addEventListener("change", search);
Promise.all(["bank.json", "os-bank.json"].map(name => fetch(name).then(response => response.json())))
  .then(([algorithm, os]) => {
    bank = [...algorithm, ...os];
    updateUnits();
    updateChapters();
    search();
  }).catch(error => { status.textContent = `題庫載入失敗：${error.message}`; });
