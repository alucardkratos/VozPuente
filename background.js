const APP_URL = chrome.runtime.getURL("app.html");

function openApp() {
  chrome.tabs.create({ url: APP_URL });
}

chrome.action.onClicked.addListener(openApp);

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") openApp();
});
