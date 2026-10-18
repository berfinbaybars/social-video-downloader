const items = document.querySelector("#items");
const add = document.querySelector("#add");
const form = document.querySelector("#form");
const statusBox = document.querySelector("#status");
const stateBox = document.querySelector("#state");
const log = document.querySelector("#log");
const submitButton = document.querySelector("#submit");

function row(index) {
  const article = document.createElement("article");
  article.innerHTML = `<span class="number"></span><label>TikTok or Instagram link<input class="url" type="url" required placeholder="Paste a TikTok video or Instagram Reel link"></label><label>Filename label (optional)<input class="title" maxlength="80" placeholder="funny-cat"></label><button type="button" class="remove" aria-label="Remove video">Remove</button>`;
  article.querySelector(".remove").addEventListener("click", () => {
    if (items.children.length === 1) return;
    article.remove();
    renumber();
  });
  return article;
}
function renumber() {
  [...items.children].forEach((el, index) => {
    el.querySelector(".number").textContent = String(index + 1).padStart(2, "0");
    el.querySelector(".remove").hidden = items.children.length === 1;
  });
  add.hidden = items.children.length >= 20;
}
items.append(row(0));
renumber();
add.addEventListener("click", () => {
  if (items.children.length < 20) items.append(row(items.children.length));
  renumber();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitButton.disabled) return;
  const payload = {
    name: document.querySelector("#name").value,
    rightsConfirmed: document.querySelector("#rights").checked,
    items: [...items.children].map((el) => ({ url: el.querySelector(".url").value, title: el.querySelector(".title").value }))
  };
  statusBox.hidden = false;
  stateBox.textContent = "Starting…";
  log.textContent = "";
  submitButton.disabled = true;
  try {
    const response = await fetch("/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const job = await response.json();
    if (!response.ok) throw new Error(job.error);
    const timer = setInterval(async () => {
      const result = await fetch(`/api/jobs/${job.id}`).then((r) => r.json());
      stateBox.textContent = result.state;
      log.textContent = result.messages.join("\n");
      if (result.state === "complete" || result.state === "failed") {
        clearInterval(timer);
        if (result.error) log.textContent += `\n\n${result.error}`;
        if (result.result) log.textContent += `\n\nReady for CapCut:\n${result.result.videosFolder}`;
      }
    }, 1000);
  } catch (error) { stateBox.textContent = "failed"; log.textContent = error.message; }
  finally { submitButton.disabled = false; }
});
