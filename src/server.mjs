import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { checkTools, createProject, validateRequest } from "./pipeline.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, "../public");
const jobs = new Map();

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body) });
  res.end(body);
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 100_000) throw new Error("Request is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) {
      return json(res, 403, { error: "Use this app from its local address." });
    }
    if (req.method === "GET" && url.pathname === "/api/health") {
      return json(res, 200, { tools: await checkTools() });
    }
    if (req.method === "POST" && url.pathname === "/api/jobs") {
      const input = await body(req);
      validateRequest(input);
      const id = randomUUID();
      const job = { id, state: "queued", messages: [], result: null, error: null };
      jobs.set(id, job);
      json(res, 202, { id });
      void createProject(input, { onProgress(message) { job.messages.push(message); if (job.messages.length > 100) job.messages.shift(); job.state = "running"; } })
        .then((result) => { job.state = "complete"; job.result = result; })
        .catch((error) => { job.state = "failed"; job.error = error.message; });
      return;
    }
    if (req.method === "GET" && url.pathname.startsWith("/api/jobs/")) {
      const job = jobs.get(url.pathname.slice("/api/jobs/".length));
      if (!job) return json(res, 404, { error: "Job not found." });
      return json(res, 200, job);
    }
    const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (!/^[a-zA-Z0-9._-]+$/.test(file)) return json(res, 404, { error: "Not found." });
    const content = await readFile(path.join(publicDir, file));
    const type = file.endsWith(".css") ? "text/css" : file.endsWith(".js") ? "text/javascript" : "text/html";
    res.writeHead(200, { "content-type": `${type}; charset=utf-8` });
    res.end(content);
  } catch (error) {
    json(res, 400, { error: error.message });
  }
});

server.listen(4173, "127.0.0.1", () => {
  console.log("Video Downloader: http://127.0.0.1:4173");
});
