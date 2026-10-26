(function (root) {
  "use strict";
  const questionKeys = ["question", "題目", "題幹", "prompt", "title"];
  const answerKeys = ["answer", "答案", "正確答案", "solution", "explanation", "解析"];

  function parseDelimited(text, separator) {
    const rows = [];
    let row = [], field = "", quoted = false;
    text = text.replace(/^\uFEFF/, "");
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted && c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = !quoted;
      else if (!quoted && c === separator) { row.push(field); field = ""; }
      else if (!quoted && (c === "\n" || c === "\r")) {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); if (row.some(x => x.trim())) rows.push(row);
        row = []; field = "";
      } else field += c;
    }
    if (quoted) throw new Error("CSV 引號未關閉");
    row.push(field); if (row.some(x => x.trim())) rows.push(row);
    if (!rows.length) return [];
    const headers = rows.shift().map(x => x.trim());
    return rows.map(cells => Object.fromEntries(headers.map((key, i) => [key, cells[i] || ""])));
  }

  function pick(item, keys) {
    const key = Object.keys(item).find(k => keys.includes(k.trim().toLowerCase()));
    return key ? String(item[key] ?? "").trim() : "";
  }

  function parseBank(text, filename) {
    let items;
    if (/\.html?$/i.test(filename)) {
      const doc = new DOMParser().parseFromString(text, "text/html");
      const subject = /作業系統/.test(doc.querySelector("#subject-title")?.textContent || "") ? "os" : "algorithm";
      items = [...doc.querySelectorAll("article.card[data-id]")].map(card => {
        const answerBlock = card.querySelector(".answer")?.textContent?.replace(/^正確答案\s*/, "").trim();
        const markedOptions = [...card.querySelectorAll(".option.correct")]
          .map(option => option.querySelector("span:nth-child(2)")?.textContent?.trim())
          .filter(Boolean).join(" | ");
        return {
          sourceId: card.getAttribute("data-id"),
          subject,
          category: card.querySelector(".meta span:nth-child(3)")?.textContent?.trim() || "",
          question: (card.querySelector(".structured-question") || card.querySelector("h2"))?.textContent?.trim() || "",
          answer: answerBlock || markedOptions || ""
        };
      });
    } else if (/\.json$/i.test(filename)) {
      const data = JSON.parse(text);
      items = Array.isArray(data) ? data : (data.questions || data.items);
    } else items = parseDelimited(text, /\.tsv$/i.test(filename) ? "\t" : ",");
    if (!Array.isArray(items)) throw new Error("題庫須為陣列，或含 questions/items 陣列");
    const bank = items.map((item, index) => ({
      id: index + 1,
      sourceId: item?.sourceId || "",
      subject: item?.subject || item?.科目 || "",
      category: item?.category || item?.章節 || item?.主題 || "",
      question: item && typeof item === "object" ? pick(item, questionKeys) : "",
      answer: item && typeof item === "object" ? pick(item, answerKeys) : ""
    })).filter(x => x.question);
    if (!bank.length) throw new Error("找不到題目欄位；請使用 question/題目/題幹");
    return bank;
  }

  function mergeBanks(base, extra) {
    const merged = new Map();
    for (const item of [...base, ...extra]) {
      const key = item.sourceId || normalize(item.question);
      if (key) merged.set(key, item);
    }
    return [...merged.values()];
  }

  function normalize(value) {
    return String(value).toLowerCase().normalize("NFKC").replace(/[\p{P}\p{S}\s]+/gu, "");
  }

  function grams(value) {
    const valueNorm = normalize(value), set = new Set();
    for (let i = 0; i < valueNorm.length - 1; i++) set.add(valueNorm.slice(i, i + 2));
    if (valueNorm.length === 1) set.add(valueNorm);
    return set;
  }

  function similarity(query, question) {
    const a = normalize(query), b = normalize(question);
    if (!a || !b) return 0;
    if (a.includes(b)) return 1;
    if (b.includes(a) && a.length >= 2) return 0.9;
    const terms = String(query).trim().split(/\s+/).map(normalize).filter(Boolean);
    if (terms.length >= 2 && terms.length <= 6 && a.length <= 60 && terms.every(term => term.length >= 2)) {
      if (!terms.every(term => b.includes(term))) return 0;
      return 0.82 + Math.min(0.12, a.length / Math.max(1, b.length) * 0.12);
    }
    const left = grams(a), right = grams(b);
    let common = 0;
    for (const gram of right) if (left.has(gram)) common++;
    return common / Math.max(1, right.size);
  }

  function search(bank, queries, limit = 12) {
    return bank.map(item => ({ ...item, score: Math.max(...queries.map(q => similarity(q, item.question)), 0) }))
      .filter(item => item.score >= 0.22)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  root.QuestionSearch = { parseBank, mergeBanks, search, normalize, similarity };
})(typeof globalThis !== "undefined" ? globalThis : window);
