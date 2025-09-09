/*
 * Optimized message handler for downloading/sending Zalo images.
 * - Replaces axios with native fetch + streaming
 * - Handles zdn.vn quirks: 202 Accepted (polling), 206 Partial Content, octet-stream
 * - MIME probing via file-type for safe extension
 * - Backoff + retry + timeout with AbortController
 * - Minimal RAM: streams to disk
 * - Predictable temp file + safe cleanup
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { v4 as uuidv4 } from "uuid";
import mime from "mime-types";
import { fileTypeFromBuffer } from "file-type";
import { API, ThreadType } from "zca-js";
import type { TargetMap } from "../types";

// ========================
// Configuration
// ========================
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 6;
const DOWNLOAD_DIR = path.resolve("upload");
const ENABLE_RANGE = false;

// ========================
// Utilities
// ========================
const ensureDir = (dir: string) => fsp.mkdir(dir, { recursive: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function assumedReferer(urlStr: string) {
  const u = new URL(urlStr);
  return u.hostname.includes("zalo") || u.hostname.includes("zdn.vn")
    ? "https://zalo.me/"
    : u.origin;
}

function createAbortableFetch(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, clear: () => clearTimeout(timer) };
}

async function fetchWithRetry(url: string, headers: Record<string, string>) {
  let attempt = 0;
  let lastErr: any;

  while (attempt < MAX_ATTEMPTS) {
    attempt++;
    const { controller, clear } = createAbortableFetch(TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": UA,
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "Accept-Language": "vi,en;q=0.9",
          Referer: assumedReferer(url),
          "Sec-Fetch-Dest": "image",
          "Sec-Fetch-Mode": "no-cors",
          "Sec-Fetch-Site": "cross-site",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          ...(ENABLE_RANGE ? { Range: "bytes=0-" } : {}),
          ...headers,
        },
      });
      clear();

      if (res.status === 202) {
        const backoff = Math.min(1500 * Math.pow(1.6, attempt - 1), 6000);
        await sleep(backoff);
        continue;
      }

      if (res.status === 200 || res.status === 206) return res;

      if (res.status >= 500 || res.status === 429 || res.status === 403) {
        const backoff = Math.min(1200 * Math.pow(1.8, attempt - 1), 7000);
        await sleep(backoff);
        continue;
      }

      throw new Error(`HTTP ${res.status}`);
    } catch (err: any) {
      lastErr = err;
      if (
        attempt < MAX_ATTEMPTS &&
        /AbortError|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(String(err?.name || err?.message))
      ) {
        const backoff = Math.min(1000 * Math.pow(1.7, attempt - 1), 5000);
        await sleep(backoff);
        continue;
      }
      break;
    } finally {
      clear();
    }
  }
  throw lastErr ?? new Error("fetchWithRetry: exhausted attempts");
}

async function downloadImageToFile(url: string): Promise<{ filePath: string; contentType?: string; status: number }> {
  await ensureDir(DOWNLOAD_DIR);

  const res = await fetchWithRetry(url, {});
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Không có body stream từ CDN");

  const first = await reader.read();
  if (first.done || !first.value?.length) {
    throw new Error(`Ảnh tải về rỗng sau khi nhận HTTP ${res.status}`);
  }

  let ctype = res.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
  let ext = "";

  if (!ctype.startsWith("image/")) {
    const ft = await fileTypeFromBuffer(Buffer.from(first.value));
    if (ft && ft.mime?.startsWith("image/")) {
      ctype = ft.mime;
      ext = ft.ext;
    }
  }
  if (!ext) ext = mime.extension(ctype || "") || "png";

  const tmpPath = path.join(DOWNLOAD_DIR, `${uuidv4()}.part`);
  const finalPath = path.join(DOWNLOAD_DIR, `${uuidv4()}.${ext}`);

  const restStream = new Readable({ read() { } });
  restStream.push(Buffer.from(first.value));
  (async () => {
    for (; ;) {
      const { done, value } = await reader.read();
      if (done) {
        restStream.push(null);
        break;
      }
      restStream.push(Buffer.from(value));
    }
  })().catch((e) => restStream.destroy(e));

  await pipeline(restStream, fs.createWriteStream(tmpPath));
  await fsp.rename(tmpPath, finalPath);

  return { filePath: finalPath, contentType: ctype || undefined, status: res.status };
}

export async function sendImage(
  api: API,
  url: string,
  threadId: string,
  threadType: ThreadType
) {
  let filePath: string | null = null;
  try {
    const { filePath: p } = await downloadImageToFile(url);
    filePath = p;
    await api.sendMessage({ msg: "", attachments: [filePath] }, threadId, threadType);
  } finally {
    if (filePath) {
      fsp.unlink(filePath).catch((e) => console.error("Lỗi xóa ảnh tạm:", e.message));
    }
  }
}

// ========================
// Message entry point
// ========================
export async function handleMessage(
  api: API,
  targetList: TargetMap,
  message: any
) {
  const { content, msgType, uidFrom, dName } = message.data;
  const threadId: string = message.threadId;
  const threadType: ThreadType = message.type;

  const target = targetList[threadId];
  if (!target) return;

  if (target.from !== "" && target.from !== uidFrom) {
    console.log(`❌ Bỏ qua tin nhắn từ ${dName} (${uidFrom} do target là ${target.from})`);
    return;
  }

  for (const targetId of target.to) {
    if (msgType === "webchat") {
      await api.sendMessage(content, targetId, threadType);
    } else if (msgType === "chat.photo" && content.href) {
      try {
        await sendImage(api, content.href, targetId, threadType);
      } catch (err: any) {
        console.error("sendImage failed:", content.href, err?.message || err);
      }
    }
  }
}
