(() => {
  "use strict";
  if (document.getElementById("os-agent-ocr-entry")) return;
  const host = document.createElement("div");
  host.id = "os-agent-ocr-entry";
  host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647";
  const shadow = host.attachShadow({ mode: "closed" });
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "📷 截圖辨識題目";
  button.title = "開啟擴充功能側欄，貼上或上傳題目截圖";
  button.setAttribute("aria-label", "開啟題目截圖辨識側欄");
  button.style.cssText = "padding:11px 16px;border:1px solid #5ec8ff;border-radius:999px;background:#142033;color:white;font:600 14px system-ui,sans-serif;box-shadow:0 5px 20px #0007;cursor:pointer";
  button.addEventListener("click", () => {
    button.disabled = true;
    chrome.runtime.sendMessage({ type: "open-ocr-panel" }, response => {
      button.disabled = false;
      if (chrome.runtime.lastError || !response?.ok) {
        button.textContent = "無法開啟，請按擴充功能圖示";
        setTimeout(() => { button.textContent = "📷 截圖辨識題目"; }, 3500);
      }
    });
  });
  shadow.append(button);
  document.documentElement.append(host);
})();
