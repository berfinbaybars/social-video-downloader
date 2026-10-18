import test from "node:test";
import assert from "node:assert/strict";
import { filenameLabelFromTikTokUrl, filenameLabelFromVideoUrl, platformFromUrl, validateRequest } from "../src/pipeline.mjs";

test("validates one authorized TikTok link", () => {
  const items = [{ url: "https://www.tiktok.com/@creator/video/1", title: "Title 1" }];
  assert.equal(validateRequest({ name: "Demo", items, rightsConfirmed: true }).items.length, 1);
});

test("validates twenty authorized TikTok links", () => {
  const items = Array.from({ length: 20 }, (_, i) => ({ url: `https://www.tiktok.com/@creator/video/${i}`, title: `Title ${i}` }));
  assert.equal(validateRequest({ name: "Demo", items, rightsConfirmed: true }).items.length, 20);
});

test("rejects more than twenty links", () => {
  const items = Array.from({ length: 21 }, (_, i) => ({ url: `https://www.tiktok.com/@creator/video/${i}`, title: `Title ${i}` }));
  assert.throws(() => validateRequest({ name: "Demo", items, rightsConfirmed: true }), /between 1 and 20/);
});

test("rejects non-TikTok links", () => {
  const items = [{ url: "https://example.com/a", title: "Title" }];
  assert.throws(() => validateRequest({ name: "Demo", items, rightsConfirmed: true }), /TikTok or Instagram/);
});

test("accepts links without filename labels", () => {
  const items = [{ url: "https://www.tiktok.com/@creator/video/1" }];
  const result = validateRequest({ name: "Downloads", items, rightsConfirmed: true });
  assert.equal(result.items[0].title, "");
});

test("preserves the entered link order", () => {
  const items = [
    { url: "https://www.tiktok.com/@creator/video/2", title: "second" },
    { url: "https://www.tiktok.com/@creator/video/1", title: "first" }
  ];
  const result = validateRequest({ name: "Downloads", items, rightsConfirmed: true });
  assert.match(result.items[0].url, /video\/2$/);
  assert.match(result.items[1].url, /video\/1$/);
});

test("builds a filename label from TikTok creator and video id", () => {
  assert.equal(
    filenameLabelFromTikTokUrl("https://www.tiktok.com/@donias_bkh_cats/video/7691024844003052832"),
    "@donias_bkh_cats_76910"
  );
});

test("accepts mixed platforms and derives Instagram filenames", () => {
  const result = validateRequest({ name: "Mixed", rightsConfirmed: true, items: [
    { url: "https://www.instagram.com/reel/ABC_123/?igsh=example" },
    { url: "https://vm.tiktok.com/ABC/" }
  ] });
  assert.deepEqual(result.items.map((item) => item.platform), ["instagram", "tiktok"]);
  assert.equal(filenameLabelFromVideoUrl(result.items[0].url), "instagram_ABC_123");
  assert.throws(() => platformFromUrl("https://instagram.com.example.com/reel/abc"));
  assert.throws(() => platformFromUrl("ftp://instagram.com/reel/abc"));
});
