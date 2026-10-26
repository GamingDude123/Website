const key = document.getElementById("key");
chrome.storage.local.get("apiKey").then(({ apiKey }) => { if (apiKey) key.value = apiKey; });
document.getElementById("save").onclick = async () => {
  await chrome.storage.local.set({ apiKey: key.value.trim() });
  document.getElementById("msg").textContent = "Saved";
};
