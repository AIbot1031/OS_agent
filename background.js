chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

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
