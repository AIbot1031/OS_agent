"use strict";
const queryInput = document.querySelector("#query");
const subjectInput = document.querySelector("#subject");
const results = document.querySelector("#results");
const status = document.querySelector("#status");
let bank = [];

function search() {
  const query = queryInput.value.trim();
  results.replaceChildren();
  if (!query) { status.textContent = "請輸入題目或關鍵字。"; return; }
  const scoped = bank.filter(item => !subjectInput.value || item.subject === subjectInput.value);
  const matches = QuestionSearch.search(scoped, [query]);
  status.textContent = `找到 ${matches.length} 筆相似題目`;
  for (const item of matches) {
    const card = document.createElement("article"); card.className = "result";
    const title = document.createElement("h3"); title.textContent = item.question;
    const meta = document.createElement("div"); meta.className = "meta";
    meta.textContent = `${item.subject === "os" ? "作業系統" : "演算法"} · ${Math.round(item.score * 100)}% 相似`;
    card.append(title, meta);
    if (item.answer) { const answer = document.createElement("p"); answer.textContent = `答案：${item.answer}`; card.append(answer); }
    results.append(card);
  }
}
document.querySelector("#search").addEventListener("click", search);
document.querySelector("#sampleSearch").addEventListener("click", () => { queryInput.value = document.querySelector("#sample").textContent; search(); });
queryInput.addEventListener("keydown", event => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) search(); });
subjectInput.addEventListener("change", search);
Promise.all(["bank.json", "os-bank.json"].map(name => fetch(name).then(response => response.json())))
  .then(([algorithm, os]) => {
    bank = [...algorithm.map(item => ({ ...item, subject: "algorithm" })), ...os.map(item => ({ ...item, subject: "os" }))];
    search();
  }).catch(error => { status.textContent = `題庫載入失敗：${error.message}`; });
