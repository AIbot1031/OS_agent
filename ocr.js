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
  root.LocalOCR = { recognize, passages };
})(globalThis);
