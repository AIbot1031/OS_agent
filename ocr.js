(function (root) {
  "use strict";
  let workerPromise;
  const local = path => chrome.runtime.getURL(path);

  async function recognize(image, progress) {
    if (!workerPromise) {
      workerPromise = Tesseract.createWorker(["chi_tra", "eng"], 1, {
        workerPath: local("vendor/ocr/worker.min.js"),
        corePath: local("vendor/ocr/core"),
        langPath: local("vendor/ocr/lang"),
        workerBlobURL: false,
        gzip: true,
        logger: message => {
          if (message.status) progress(`${message.status} ${Math.round((message.progress || 0) * 100)}%`);
        }
      }).catch(error => { workerPromise = undefined; throw error; });
    }
    const worker = await workerPromise;
    const result = await worker.recognize(image);
    return result.data.text || "";
  }

  function passages(text) {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length >= 6 && line.length <= 350);
    const parts = [];
    for (let i = 0; i < lines.length && parts.length < 120; i++) {
      parts.push(lines[i]);
      if (i + 1 < lines.length) parts.push(`${lines[i]} ${lines[i + 1]}`);
      if (i + 2 < lines.length && lines[i].length < 100) parts.push(`${lines[i]} ${lines[i + 1]} ${lines[i + 2]}`);
    }
    return parts;
  }

  function extractQuestion(text) {
    const lines = String(text).split(/\r?\n/).map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean);
    const questionStart = lines.findIndex(line => /^(?:題目|問題|question)\s*\d*\s*[:：]/i.test(line));
    const start = questionStart >= 0 ? questionStart : Math.max(0, lines.findIndex(line => line.length >= 12));
    const selected = [];
    const option = /^(?:[A-HＡ-Ｈ][.)．、]|[（(][A-HＡ-Ｈ][)）]|[1-9１-９][.)．、]|[①-⑩])\s*/i;
    const end = /^(?:正確答案|你的答案|答案|解析|得分|選項|answer|explanation)\s*[:：]?/i;
    for (const line of lines.slice(start)) {
      if (option.test(line) || end.test(line) || (selected.length && /^[A-DＡ-Ｄ]\s{1,3}\S/.test(line))) break;
      const withoutPrefix = line.replace(/^(?:題目|問題|question)\s*\d*\s*[:：]\s*/i, "");
      const inlineOption = withoutPrefix.search(/\s(?:A[.)．、]|[（(]A[)）])\s*/i);
      const questionLine = inlineOption > 0 ? withoutPrefix.slice(0, inlineOption) : withoutPrefix;
      if (questionLine) selected.push(questionLine);
      if (inlineOption > 0) break;
      if (selected.join(" ").length >= 1200) break;
    }
    return selected.join(" ").trim().slice(0, 1200);
  }
  root.LocalOCR = { recognize, passages, extractQuestion };
})(globalThis);
