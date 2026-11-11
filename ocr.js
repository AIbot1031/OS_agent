(function (root) {
  "use strict";
  let workerPromise;
  const local = path => chrome.runtime.getURL(path);

  async function enhanceSmallImage(image) {
    const blob = image instanceof Blob ? image : await (await fetch(image)).blob();
    const bitmap = await createImageBitmap(blob);
    try {
      const scale = Math.min(2, Math.sqrt(3600000 / (bitmap.width * bitmap.height)));
      if (scale < 1.3) return null;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let brightness = 0, samples = 0;
      for (let i = 0; i < pixels.data.length; i += 160) {
        brightness += (pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2]) / 3;
        samples++;
      }
      const invert = brightness / Math.max(1, samples) < 115;
      for (let i = 0; i < pixels.data.length; i += 4) {
        let gray = pixels.data[i] * .299 + pixels.data[i + 1] * .587 + pixels.data[i + 2] * .114;
        if (invert) gray = 255 - gray;
        gray = Math.max(0, Math.min(255, (gray - 128) * 1.18 + 128));
        pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = gray;
      }
      ctx.putImageData(pixels, 0, 0);
      return await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    } finally { bitmap.close(); }
  }

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
    let result = await worker.recognize(image);
    if ((result.data.confidence || 0) < 65 || (result.data.text || "").trim().length < 12) {
      try {
        const enhanced = await enhanceSmallImage(image);
        if (enhanced) {
          progress("圖片較小或辨識不清，正在嘗試增強辨識…");
          const second = await worker.recognize(enhanced);
          if ((second.data.confidence || 0) > (result.data.confidence || 0) + 4 ||
              ((result.data.text || "").trim().length < 12 && (second.data.text || "").trim().length > (result.data.text || "").trim().length)) {
            result = second;
          }
        }
      } catch (_) { /* Keep the original OCR result if image enhancement is unavailable. */ }
    }
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

  const optionPattern = /^\s*(?:([A-HＡ-Ｈ])[.):：﹕.．。、]|[（(]\s*([A-HＡ-Ｈ])\s*[)）]|([1-9１-９])[.):：﹕.．。、]|([①-⑩]))\s*(.*)$/i;
  const answerPattern = /^(?:正\s*確\s*答\s*案|參\s*考\s*答\s*案|標\s*準\s*答\s*案|correct\s+answers?)\s*[:：﹕.．。]?\s*(.*)$/i;
  const stopPattern = /^(?:解析|說明|你的答案|得分|下一題|下一頁|題目\s*\d*\s*[:：﹕.．。]|explanation|score)/i;
  const linesOf = text => String(text).split(/\r?\n/).map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean);

  function optionParts(line) {
    const match = line.match(optionPattern);
    if (!match) return null;
    const label = (match[1] || match[2] || match[3] || match[4]).normalize("NFKC").toUpperCase();
    return { label, text: match[5].trim() };
  }

  function extractQuestion(text) {
    const lines = linesOf(text);
    const questionStart = lines.findIndex(line => /^(?:題目|問題|question)\s*\d*\s*[:：﹕.．。]/i.test(line));
    const start = questionStart >= 0 ? questionStart : Math.max(0, lines.findIndex(line => line.length >= 12));
    const selected = [];
    const end = /^(?:正確答案|你的答案|答案|解析|得分|選項|answer|explanation)\s*[:：﹕.．。]?/i;
    for (const line of lines.slice(start)) {
      if (optionParts(line) || answerPattern.test(line) || end.test(line) || (selected.length && /^[A-DＡ-Ｄ]\s{1,3}\S/.test(line))) break;
      const withoutPrefix = line.replace(/^(?:題目|問題|question)\s*\d*\s*[:：﹕.．。]\s*/i, "");
      const inlineOption = withoutPrefix.search(/\s(?:A[.):：﹕.．。、]|[（(]A[)）])\s*/i);
      const questionLine = inlineOption > 0 ? withoutPrefix.slice(0, inlineOption) : withoutPrefix;
      if (questionLine) selected.push(questionLine);
      if (inlineOption > 0) break;
      if (selected.join(" ").length >= 1200) break;
    }
    return selected.join(" ").trim().slice(0, 1200);
  }

  function extractStudyItem(text) {
    const lines = linesOf(text);
    const answerIndex = lines.findIndex(line => answerPattern.test(line));
    let answer = "";
    if (answerIndex >= 0) {
      const parts = [];
      const inline = lines[answerIndex].match(answerPattern)?.[1]?.trim();
      if (inline) parts.push(inline);
      for (const line of lines.slice(answerIndex + 1)) {
        if (stopPattern.test(line) || answerPattern.test(line)) break;
        parts.push(line.replace(/^[•●○✓✔]\s*/, ""));
        if (parts.join(" ").length >= 1000) break;
      }
      answer = parts.join(" | ").trim().slice(0, 1000);
    }
    const optionStart = lines.findIndex(line => optionParts(line));
    const optionEnd = answerIndex >= 0 ? answerIndex : lines.length;
    const parsedOptions = [];
    if (optionStart >= 0 && optionStart < optionEnd) {
      for (const line of lines.slice(optionStart, optionEnd)) {
        if (/^(?:你的答案|答案|解析|得分)\s*[:：﹕.．。]?/.test(line)) break;
        const option = optionParts(line);
        if (option) parsedOptions.push(option);
        else if (parsedOptions.length && line.length <= 180) parsedOptions[parsedOptions.length - 1].text += ` ${line}`;
      }
    }
    const options = parsedOptions.map(option => `${option.label}. ${option.text}`).join("\n").slice(0, 2000);
    if (answer && parsedOptions.length) {
      const compact = answer.normalize("NFKC").replace(/\bAND\b/gi, "").replace(/[\s,，、;；/|&+及與和()（）]/g, "");
      if (/^[A-H1-9]+$/i.test(compact)) {
        const mapped = [...compact.toUpperCase()].map(label => parsedOptions.find(option => option.label === label))
          .filter(Boolean).map(option => `${option.label}. ${option.text}`);
        if (mapped.length === compact.length) answer = mapped.join(" | ");
      }
    }
    return { question: extractQuestion(text), options, answer, answerFound: answerIndex >= 0 };
  }
  root.LocalOCR = { recognize, passages, extractQuestion, extractStudyItem };
})(globalThis);
