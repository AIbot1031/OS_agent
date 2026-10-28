(async () => {
  "use strict";
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function waitFor(test, message, timeout = 20000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const value = test();
      if (value) return value;
      await delay(150);
    }
    throw new Error(message);
  }
  const clean = value => (value || "").replace(/\s+/g, " ").trim();
  await waitFor(() => document.querySelector("#home-button") && document.querySelector('[data-subject="algorithm"]'), "題庫網站未載入完成");
  const subjects = [
    { key: "algorithm", title: "演算法" },
    { key: "os", title: "作業系統" }
  ];
  const output = [];
  for (const subject of subjects) {
    document.querySelector("#home-button").click();
    await waitFor(() => !document.querySelector("#home")?.hidden, "無法切換題庫科目");
    document.querySelector(`[data-subject="${subject.key}"]`).click();
    await waitFor(() => clean(document.querySelector("#subject-title")?.textContent) === subject.title, `無法開啟${subject.title}題庫`);
    const allButton = await waitFor(() => document.querySelector('.unit-button[data-unit="all"]'), "找不到全部單元");
    allButton.click();
    const expected = Number(clean(allButton.querySelector("span:last-child")?.textContent).match(/\d+/)?.[0]);
    await waitFor(() => document.querySelectorAll("#results article.card[data-id]").length === expected, `${subject.title}題目未載入完整`);
    const items = [...document.querySelectorAll("#results article.card[data-id]")].map(card => {
      const answerBlock = card.querySelector(".answer");
      const answerList = [...(answerBlock?.querySelectorAll("li") || [])].map(li => clean(li.textContent)).filter(Boolean);
      const markedOptions = [...card.querySelectorAll(".option.correct")]
        .map(option => clean(option.querySelector("span:nth-child(2)")?.textContent)).filter(Boolean);
      return {
        sourceId: card.getAttribute("data-id"),
        question: clean((card.querySelector(".structured-question") || card.querySelector("h2"))?.textContent),
        answer: answerList.length ? answerList.join(" | ") : clean(answerBlock?.textContent).replace(/^正確答案\s*/, "") || markedOptions.join(" | "),
        subject: subject.key,
        category: clean(card.querySelector(".meta span:nth-child(3)")?.textContent),
        unit: null,
        unitLabel: ""
      };
    }).filter(item => item.sourceId && item.question);
    const byId = new Map(items.map(item => [item.sourceId, item]));
    const units = [...document.querySelectorAll(".unit-button[data-unit]")]
      .map(button => button.dataset.unit).filter(value => value !== "all");
    for (const unitValue of units) {
      const button = document.querySelector(`.unit-button[data-unit="${unitValue}"]`);
      const unit = Number(unitValue);
      const unitLabel = clean(button.querySelector("span")?.textContent);
      const unitCount = Number(clean(button.querySelector("span:last-child")?.textContent).match(/\d+/)?.[0]);
      button.click();
      await waitFor(() => button.classList.contains("active") && document.querySelectorAll("#results article.card[data-id]").length === unitCount, `${subject.title}${unitLabel}未載入完整`);
      for (const card of document.querySelectorAll("#results article.card[data-id]")) {
        const item = byId.get(card.getAttribute("data-id"));
        if (item) { item.unit = unit; item.unitLabel = unitLabel; }
      }
    }
    if (items.some(item => !item.unit)) throw new Error(`${subject.title}有題目未分配到單元`);
    output.push(...items);
  }
  return output;
})()
