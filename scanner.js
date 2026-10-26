(() => {
  const selected = window.getSelection()?.toString().trim();
  if (selected && selected.length >= 4) return [selected.slice(0, 1200)];
  const selectors = [
    "[data-question]", ".question-text", ".question-title", ".question",
    "[class*='question']", "[class*='Question']", "main h2", "main h3",
    "article h2", "article h3"
  ];
  const candidates = new Set();
  for (const selector of selectors) {
    for (const node of document.querySelectorAll(selector)) {
      if (node.closest("nav, header, footer, aside")) continue;
      const text = (node.innerText || "").replace(/\s+/g, " ").trim();
      if (text.length >= 8 && text.length <= 1200) candidates.add(text);
      if (candidates.size >= 60) break;
    }
  }
  if (!candidates.size) {
    const root = document.querySelector("main") || document.body;
    const lines = (root.innerText || "").split(/\n+/).map(x => x.trim());
    for (const line of lines) {
      if (line.length >= 12 && line.length <= 500) candidates.add(line);
      if (candidates.size >= 60) break;
    }
  }
  return [...candidates];
})()
