import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB

/** Extensões aceitas (qualquer natureza documental comum). */
export const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".txt",
  ".csv",
  ".xlsx",
  ".xls",
  ".doc",
  ".docx",
  ".odt",
  ".ods",
  ".rtf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".zip",
  ".json",
  ".xml",
  ".md",
]);

export function getUploadsRoot(): string {
  return path.resolve(process.cwd(), "data", "uploads");
}

export function ensureUploadsDir(): string {
  const root = getUploadsRoot();
  mkdirSync(root, { recursive: true });
  return root;
}

export function ensureProjectUploadDir(projectId: number): string {
  const dir = path.join(ensureUploadsDir(), String(projectId));
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx < 0) return "";
  return filename.slice(idx).toLowerCase();
}

export function isAllowedFilename(filename: string): boolean {
  const ext = extensionOf(filename);
  return ext !== "" && ALLOWED_EXTENSIONS.has(ext);
}

export function buildStoredName(originalName: string): string {
  const ext = extensionOf(originalName) || "";
  return `${Date.now()}-${randomUUID()}${ext}`;
}

export function absoluteStoredPath(projectId: number, storedName: string): string {
  return path.join(ensureProjectUploadDir(projectId), storedName);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
