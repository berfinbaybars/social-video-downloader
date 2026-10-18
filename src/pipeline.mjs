import { spawn } from "node:child_process";
import { access, mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_ITEMS = 20;
const MIN_ITEMS = 1;

function safeName(value, fallback = "compilation") {
  const cleaned = String(value ?? "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9@ _-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  return cleaned || fallback;
}

export function filenameLabelFromTikTokUrl(value) {
  try {
    const parsed = new URL(String(value));
    const parts = parsed.pathname.split("/").filter(Boolean);
    const creator = parts.find((part) => part.startsWith("@"));
    const videoIndex = parts.findIndex((part) => part === "video");
    const videoId = videoIndex >= 0 ? parts[videoIndex + 1] : "";
    const idPrefix = /^\d+$/.test(videoId) ? videoId.slice(0, 5) : "";
    return safeName([creator, idPrefix].filter(Boolean).join("_"), "video");
  } catch {
    return "video";
  }
}

export function platformFromUrl(value) {
  const parsed = new URL(String(value).trim());
  if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("Use an HTTP or HTTPS video link.");
  const host = parsed.hostname.toLowerCase();
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
  throw new Error("Use a TikTok or Instagram video URL.");
}

export function filenameLabelFromVideoUrl(value) {
  if (platformFromUrl(value) === "tiktok") return filenameLabelFromTikTokUrl(value);
  const parts = new URL(value).pathname.split("/").filter(Boolean);
  const index = parts.findIndex((part) => ["reel", "reels", "p", "tv"].includes(part));
  return safeName(`instagram_${index >= 0 ? parts[index + 1] || "video" : "video"}`);
}

const toolCache = new Map();

async function resolveTool(command) {
  if (toolCache.has(command)) return toolCache.get(command);
  const executable = process.platform === "win32" && !command.endsWith(".exe") ? `${command}.exe` : command;
  for (const folder of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!folder) continue;
    const candidate = path.join(folder, executable);
    try { await access(candidate); toolCache.set(command, candidate); return candidate; } catch {}
  }
  toolCache.set(command, command);
  return command;
}

export async function checkTools() {
  const result = {};
  for (const name of ["ffmpeg", "ffprobe", "yt-dlp"]) {
    const executable = await resolveTool(name);
    try {
      const version = await run(name, [name === "yt-dlp" ? "--version" : "-version"]);
      result[name] = { available: true, executable, version: (version.stdout || version.stderr).split(/\r?\n/)[0] };
    } catch (error) {
      result[name] = { available: false, executable, error: error.message };
    }
  }
  return result;
}

async function run(command, args, { cwd, onLine = () => {} } = {}) {
  const executable = await resolveTool(command);
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, windowsHide: true, shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      const value = chunk.toString();
      stdout += value;
      value.split(/\r?\n/).filter(Boolean).forEach(onLine);
    });
    child.stderr.on("data", (chunk) => {
      const value = chunk.toString();
      stderr += value;
      value.split(/\r?\n/).filter(Boolean).forEach(onLine);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited with code ${code}\n${stderr.slice(-3000)}`));
    });
  });
}

export function validateRequest(input) {
  const name = String(input.name ?? "").trim();
  const items = Array.isArray(input.items) ? input.items : [];
  if (!name) throw new Error("Enter a project name.");
  if (items.length < MIN_ITEMS || items.length > MAX_ITEMS) {
    throw new Error(`Add between ${MIN_ITEMS} and ${MAX_ITEMS} videos.`);
  }
  for (const [index, item] of items.entries()) {
    const title = String(item.title ?? "").trim();
    let parsed;
    try { parsed = new URL(String(item.url ?? "")); } catch { throw new Error(`Video ${index + 1} has an invalid URL.`); }
    try { platformFromUrl(parsed.href); }
    catch (error) { throw new Error(`Video ${index + 1}: ${error.message}`); }
  }
  if (input.rightsConfirmed !== true) throw new Error("Confirm that you are authorized to use the supplied videos.");
  return { name, items: items.map((item) => ({ url: String(item.url).trim(), platform: platformFromUrl(item.url), title: String(item.title ?? "").trim() })) };
}

export async function createProject(input, options = {}) {
  const data = validateRequest(input);
  const root = options.outputRoot ?? fileURLToPath(new URL("../output/", import.meta.url));
  const projectDir = path.join(root, `${safeName(data.name)}-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  const videos = path.join(projectDir, "videos");
  await mkdir(videos, { recursive: true });

  const clips = [];
  for (const [index, item] of data.items.entries()) {
    const number = String(index + 1).padStart(2, "0");
    const label = item.title ? safeName(item.title, "video") : filenameLabelFromVideoUrl(item.url);
    options.onProgress?.(`Downloading ${item.platform === "instagram" ? "Instagram" : "TikTok"} video ${number} of ${data.items.length}`);
    const outputTemplate = path.join(videos, `.source_${number}.%(ext)s`);
    const { stdout } = await run("yt-dlp", ["--no-playlist", "--restrict-filenames", "--print", "after_move:filepath", "-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b", "--merge-output-format", "mp4", "-o", outputTemplate, item.url], { onLine: options.onProgress });
    const downloaded = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
    if (!downloaded) throw new Error(`Downloader did not return a file for item ${number}.`);
    const finalFile = path.join(videos, `${number}_${label}.mp4`);
    options.onProgress?.(`Preparing thumbnail-friendly MP4 ${number} of ${data.items.length}`);
    await run("ffmpeg", [
      "-y", "-i", downloaded,
      "-map", "0:v:0", "-map", "0:a?",
      "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", finalFile
    ], { onLine: options.onProgress });
    await unlink(downloaded).catch(() => {});
    clips.push({ order: index + 1, platform: item.platform, url: item.url, title: item.title, file: finalFile });
  }
  await writeFile(path.join(projectDir, "downloads.json"), JSON.stringify({ createdAt: new Date().toISOString(), name: data.name, clips }, null, 2), "utf8");
  options.onProgress?.("Downloads ready for CapCut");
  return { projectDir, videosFolder: videos, files: clips.map((clip) => clip.file), clips: clips.length };
}
