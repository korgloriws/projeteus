/** Extensões aceitas no input de anexos (espelha `server/lib/uploads.ts`). */
export const ATTACHMENT_ACCEPT = [
  ".pdf",
  ".txt",
  ".csv",
  ".tsv",
  ".xlsx",
  ".xls",
  ".ods",
  ".doc",
  ".docx",
  ".odt",
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
  ".yaml",
  ".yml",
  ".log",
  ".html",
  ".htm",
].join(",");

export type PreviewKind =
  | "pdf"
  | "image"
  | "text"
  | "json"
  | "csv"
  | "xlsx"
  | "docx"
  | "unsupported";

export function extensionOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

export function detectPreviewKind(
  name: string,
  mimeType: string,
): PreviewKind {
  const ext = extensionOf(name);
  const mime = mimeType.toLowerCase();

  if (mime.includes("pdf") || ext === ".pdf") return "pdf";

  if (
    mime.startsWith("image/") ||
    [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(ext)
  ) {
    return "image";
  }

  if (
    ext === ".docx" ||
    mime.includes(
      "application/vnd.openxmlformats-officedocument.wordprocessingml",
    ) ||
    mime === "application/vnd.ms-word.document.macroenabled.12"
  ) {
    return "docx";
  }

  if (
    ext === ".csv" ||
    ext === ".tsv" ||
    mime.includes("csv") ||
    mime === "text/tab-separated-values"
  ) {
    return "csv";
  }

  if (
    [".xlsx", ".xls", ".ods"].includes(ext) ||
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime.includes("opendocument.spreadsheet")
  ) {
    return "xlsx";
  }

  if (ext === ".json" || mime.includes("json")) return "json";

  if (
    mime.startsWith("text/") ||
    [".txt", ".md", ".xml", ".yaml", ".yml", ".log", ".html", ".htm", ".rtf"].includes(
      ext,
    )
  ) {
    return "text";
  }

  return "unsupported";
}

export function previewKindLabel(kind: PreviewKind): string {
  switch (kind) {
    case "pdf":
      return "PDF";
    case "image":
      return "Imagem";
    case "text":
      return "Texto";
    case "json":
      return "JSON";
    case "csv":
      return "Planilha (CSV)";
    case "xlsx":
      return "Planilha";
    case "docx":
      return "Documento Word";
    default:
      return "Arquivo";
  }
}
