// Asks Claude for answers. The API key lives in chrome.storage.local and never reaches the page.
const MODEL = "claude-haiku-5-5";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "suggest") return;
  suggest(msg.prompt, msg.used || []).then(sendResponse, (e) => sendResponse({ error: String(e.message || e) }));
  return true;
});

async function suggest(prompt, used) {
  const { apiKey } = await chrome.storage.local.get("apiKey");
  if (!apiKey) throw new Error("No API key set. Right-click the extension > Options.");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 200,
      system:
        "You help in a turn-based category game: each player must name one valid member of the category before time runs out, with no repeats. " +
        "Reply with a JSON array of 6 short answers (1-3 words each), most obviously valid first. No prose.",
      messages: [
        {
          role: "user",
          content: `Category prompt: ${prompt}\nAlready used (do not repeat): ${used.join(", ") || "none"}`
        }
      ]
    })
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || "[]";
  const match = text.match(/\[[\s\S]*\]/);
  const answers = JSON.parse(match ? match[0] : "[]");
  return { answers: answers.filter((a) => typeof a === "string") };
}
