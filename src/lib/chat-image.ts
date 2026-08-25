import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const MAX_BYTES = 1.5 * 1024 * 1024; // ~1.5MB raw base64 payload limit

/**
 * Save a data-URL or raw base64 image under public/uploads/chat.
 * Returns public URL path like /uploads/chat/xxx.jpg
 */
export async function saveChatImage(
  dataUrl: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!dataUrl || typeof dataUrl !== "string") {
    return { ok: false, error: "Gambar tidak valid" };
  }

  let mime = "image/jpeg";
  let b64 = dataUrl;

  const m = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i.exec(dataUrl);
  if (m) {
    mime = m[1].toLowerCase().replace("image/jpg", "image/jpeg");
    b64 = m[2];
  } else if (!/^[A-Za-z0-9+/=\s]+$/.test(dataUrl.slice(0, 200))) {
    return { ok: false, error: "Format gambar tidak didukung" };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(b64.replace(/\s/g, ""), "base64");
  } catch {
    return { ok: false, error: "Gagal membaca gambar" };
  }

  if (buffer.length < 32) {
    return { ok: false, error: "Gambar kosong" };
  }
  if (buffer.length > MAX_BYTES) {
    return { ok: false, error: "Gambar terlalu besar (maks ~1.5 MB)" };
  }

  const ext =
    mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const name = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "chat");
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, name);
  await writeFile(filePath, buffer);
  return { ok: true, url: `/uploads/chat/${name}` };
}
