/* Clicking the toolbar button opens the hub, or jumps to it if it's already open.
 * That is all this file does. */

async function openHub() {
  const url = chrome.runtime.getURL("hub.html");
  const open = await chrome.runtime.getContexts({ contextTypes: ["TAB"], documentUrls: [url] });
  const existing = open.find(function (c) { return c.tabId >= 0; });
  if (existing) {
    await chrome.tabs.update(existing.tabId, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: url });
  }
}

chrome.action.onClicked.addListener(openHub);

/* The hub lets portals be shown inside it by switching off the headers that stop
 * framing, but only for the hub's own tab (hub.js adds that rule, keyed by the
 * tab's id). Drop the rule when the tab closes. */
chrome.tabs.onRemoved.addListener(function (tabId) {
  chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] }).catch(function () { /* none to remove */ });
});
