chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "open-ocr-panel" || !sender.tab?.id) return;
  chrome.sidePanel.open({ tabId: sender.tab.id })
    .then(() => chrome.storage.session.set({ openOcrPanel: true }))
    .then(() => sendResponse({ ok: true }))
    .catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});

chrome.commands.onCommand.addListener(async command => {
  if (command !== "capture-search") return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || tab.windowId === undefined) return;
    const screenshotPromise = chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const panelPromise = chrome.sidePanel.open({ tabId: tab.id });
    const screenshot = await screenshotPromise;
    await chrome.storage.session.set({ pendingScreenshot: screenshot });
    await panelPromise;
  } catch (error) {
    await chrome.storage.session.set({ captureError: error.message });
  }
});
