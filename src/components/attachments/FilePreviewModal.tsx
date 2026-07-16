import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  AlertCircle,
} from "lucide-react";
import type { Attachment } from "@api/client";
import { fetchAttachmentBlob } from "@api/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type PreviewSource =
  | { kind: "remote"; attachment: Attachment }
  | { kind: "local"; file: File };

interface FilePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: PreviewSource | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extensionOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

function detectPreviewKind(
  name: string,
  mimeType: string,
): "pdf" | "image" | "text" | "csv" | "xlsx" | "unsupported" {
  const ext = extensionOf(name);
  const mime = mimeType.toLowerCase();

  if (mime.includes("pdf") || ext === ".pdf") return "pdf";
  if (
    mime.startsWith("image/") ||
    [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(ext)
  ) {
    return "image";
  }
  if (ext === ".csv" || mime.includes("csv")) return "csv";
  if (
    ext === ".xlsx" ||
    ext === ".xls" ||
    mime.includes("spreadsheet") ||
    mime.includes("excel")
  ) {
    return "xlsx";
  }
  if (
    mime.startsWith("text/") ||
    [".txt", ".md", ".json", ".xml", ".rtf"].includes(ext)
  ) {
    return "text";
  }
  return "unsupported";
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function FilePreviewModal({
  open,
  onOpenChange,
  source,
}: FilePreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [tableRows, setTableRows] = useState<string[][] | null>(null);

  const meta = useMemo(() => {
    if (!source) return null;
    if (source.kind === "remote") {
      return {
        name: source.attachment.originalName,
        mimeType: source.attachment.mimeType,
        sizeBytes: source.attachment.sizeBytes,
      };
    }
    return {
      name: source.file.name,
      mimeType: source.file.type || "application/octet-stream",
      sizeBytes: source.file.size,
    };
  }, [source]);

  const previewKind = meta
    ? detectPreviewKind(meta.name, meta.mimeType)
    : "unsupported";

  useEffect(() => {
    if (!open || !source || !meta) {
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;

    async function load() {
      setLoading(true);
      setError(null);
      setObjectUrl(null);
      setTextContent(null);
      setTableRows(null);

      try {
        const blob =
          source!.kind === "remote"
            ? await fetchAttachmentBlob(source!.attachment.id)
            : source!.file;

        if (cancelled) return;

        const kind = detectPreviewKind(meta!.name, meta!.mimeType);

        if (kind === "pdf" || kind === "image") {
          createdUrl = URL.createObjectURL(blob);
          setObjectUrl(createdUrl);
          return;
        }

        if (kind === "text" || kind === "csv") {
          const text = await blob.text();
          if (cancelled) return;
          if (kind === "csv") {
            setTableRows(parseCsv(text).slice(0, 200));
          } else {
            setTextContent(text);
          }
          return;
        }

        if (kind === "xlsx") {
          const buffer = await blob.arrayBuffer();
          if (cancelled) return;
          const workbook = XLSX.read(buffer, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          if (!sheetName) {
            setError("Planilha vazia.");
            return;
          }
          const sheet = workbook.Sheets[sheetName]!;
          const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
            header: 1,
            defval: "",
          }) as string[][];
          setTableRows(rows.slice(0, 200).map((r) => r.map((c) => String(c ?? ""))));
          return;
        }

        // unsupported — still create object URL for download
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar o arquivo.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [open, source, meta]);

  async function handleDownloadRemote() {
    if (!source || !meta) return;

    try {
      const blob =
        source.kind === "remote"
          ? await fetchAttachmentBlob(source.attachment.id)
          : source.file;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = meta.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao baixar o arquivo.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="truncate pr-8">
            {meta?.name ?? "Visualizar arquivo"}
          </DialogTitle>
          <DialogDescription>
            {meta
              ? `${formatBytes(meta.sizeBytes)} · ${meta.mimeType || "tipo desconhecido"}`
              : "Pré-visualização do anexo selecionado"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[320px] flex-1 bg-muted/30">
          {loading ? (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Carregando visualização…</p>
            </div>
          ) : error ? (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-2 px-6 text-center text-destructive">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm">{error}</p>
            </div>
          ) : previewKind === "pdf" && objectUrl ? (
            <iframe
              title={meta?.name}
              src={objectUrl}
              className="h-[60vh] w-full border-0 bg-background"
            />
          ) : previewKind === "image" && objectUrl ? (
            <div className="flex h-[60vh] items-center justify-center overflow-auto p-4">
              <img
                src={objectUrl}
                alt={meta?.name}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : previewKind === "text" && textContent !== null ? (
            <ScrollArea className="h-[60vh]">
              <pre className="whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed">
                {textContent}
              </pre>
            </ScrollArea>
          ) : (previewKind === "csv" || previewKind === "xlsx") &&
            tableRows ? (
            <ScrollArea className="h-[60vh]">
              <div className="p-4">
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Exibindo até 200 linhas
                </div>
                <div className="overflow-x-auto rounded-md border bg-background">
                  <table className="w-full border-collapse text-left text-xs">
                    <tbody>
                      {tableRows.map((row, ri) => (
                        <tr
                          key={ri}
                          className={
                            ri === 0
                              ? "bg-muted/60 font-medium"
                              : "border-t border-border"
                          }
                        >
                          {row.map((cell, ci) => (
                            <td
                              key={ci}
                              className="max-w-[220px] truncate px-2 py-1.5 align-top"
                              title={cell}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
              <FileText className="h-10 w-10" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Visualização não disponível para este tipo
                </p>
                <p className="text-xs">
                  Você ainda pode baixar o arquivo para abrir no aplicativo
                  correspondente.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-3 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="button" onClick={() => void handleDownloadRemote()}>
            <Download className="mr-2 h-4 w-4" />
            Baixar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
