import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import mammoth from "mammoth/mammoth.browser";
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
  detectPreviewKind,
  extensionOf,
  previewKindLabel,
  type PreviewKind,
} from "@/lib/file-types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type PreviewSource =
  | { kind: "remote"; attachment: Attachment }
  | { kind: "local"; file: File };

interface FilePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: PreviewSource | null;
}

const MAX_PREVIEW_ROWS = 300;
const MAX_TEXT_CHARS = 500_000;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseDelimited(text: string, delimiter: string): string[][] {
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
    if (ch === delimiter) {
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

function formatTextContent(name: string, raw: string, kind: PreviewKind): string {
  if (kind === "json" || extensionOf(name) === ".json") {
    try {
      const pretty = JSON.stringify(JSON.parse(raw), null, 2);
      if (pretty.length > MAX_TEXT_CHARS) {
        return `${pretty.slice(0, MAX_TEXT_CHARS)}\n\n… (conteúdo truncado para visualização)`;
      }
      return pretty;
    } catch {
      // JSON inválido: cai no texto bruto
    }
  }
  if (raw.length > MAX_TEXT_CHARS) {
    return `${raw.slice(0, MAX_TEXT_CHARS)}\n\n… (conteúdo truncado para visualização)`;
  }
  return raw;
}

function sheetRowsToTable(sheet: XLSX.WorkSheet): string[][] {
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as string[][];
  return rows
    .slice(0, MAX_PREVIEW_ROWS)
    .map((r) => r.map((c) => String(c ?? "")));
}

function buildDocxSrcDoc(htmlBody: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0;
      padding: 1.25rem 1.5rem;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.55;
      color: CanvasText;
      background: Canvas;
    }
    h1,h2,h3,h4 { line-height: 1.25; }
    img, table { max-width: 100%; }
    table { border-collapse: collapse; }
    td, th { border: 1px solid color-mix(in srgb, CanvasText 20%, transparent); padding: 0.35rem 0.5rem; }
    a { color: #ea580c; }
  </style>
</head>
<body>${htmlBody}</body>
</html>`;
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
  const [htmlSrcDoc, setHtmlSrcDoc] = useState<string | null>(null);
  const [tableRows, setTableRows] = useState<string[][] | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);

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

  const previewKind: PreviewKind = meta
    ? detectPreviewKind(meta.name, meta.mimeType)
    : "unsupported";

  useEffect(() => {
    if (!open || !source || !meta) return;

    let cancelled = false;
    let createdUrl: string | null = null;

    async function load() {
      setLoading(true);
      setError(null);
      setObjectUrl(null);
      setTextContent(null);
      setHtmlSrcDoc(null);
      setTableRows(null);
      setSheetNames([]);
      setActiveSheet("");
      setWorkbook(null);

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

        if (kind === "text" || kind === "json" || kind === "csv") {
          const raw = await blob.text();
          if (cancelled) return;
          if (kind === "csv") {
            const delimiter =
              extensionOf(meta!.name) === ".tsv" ? "\t" : ",";
            setTableRows(
              parseDelimited(raw, delimiter).slice(0, MAX_PREVIEW_ROWS),
            );
          } else {
            setTextContent(formatTextContent(meta!.name, raw, kind));
          }
          return;
        }

        if (kind === "xlsx") {
          const buffer = await blob.arrayBuffer();
          if (cancelled) return;
          const wb = XLSX.read(buffer, { type: "array", cellDates: true });
          const names = wb.SheetNames;
          if (!names.length) {
            setError("Planilha vazia.");
            return;
          }
          const first = names[0]!;
          setWorkbook(wb);
          setSheetNames(names);
          setActiveSheet(first);
          setTableRows(sheetRowsToTable(wb.Sheets[first]!));
          return;
        }

        if (kind === "docx") {
          const buffer = await blob.arrayBuffer();
          if (cancelled) return;
          const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
          if (cancelled) return;
          if (!result.value.trim()) {
            setError("Documento sem conteúdo legível para pré-visualização.");
            return;
          }
          setHtmlSrcDoc(buildDocxSrcDoc(result.value));
          return;
        }

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

  function handleSheetChange(name: string) {
    setActiveSheet(name);
    if (!workbook?.Sheets[name]) return;
    setTableRows(sheetRowsToTable(workbook.Sheets[name]!));
  }

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

  const showTable =
    (previewKind === "csv" || previewKind === "xlsx") && tableRows !== null;
  const showText =
    (previewKind === "text" || previewKind === "json") && textContent !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="truncate pr-8">
            {meta?.name ?? "Visualizar arquivo"}
          </DialogTitle>
          <DialogDescription>
            {meta
              ? `${formatBytes(meta.sizeBytes)} · ${previewKindLabel(previewKind)} · ${meta.mimeType || "tipo desconhecido"}`
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
              className="h-[65vh] w-full border-0 bg-background"
            />
          ) : previewKind === "image" && objectUrl ? (
            <div className="flex h-[65vh] items-center justify-center overflow-auto p-4">
              <img
                src={objectUrl}
                alt={meta?.name}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : previewKind === "docx" && htmlSrcDoc ? (
            <iframe
              title={meta?.name}
              sandbox=""
              srcDoc={htmlSrcDoc}
              className="h-[65vh] w-full border-0 bg-background"
            />
          ) : showText ? (
            <ScrollArea className="h-[65vh]">
              <pre
                className={cn(
                  "whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed",
                  previewKind === "json" && "text-[11px]",
                )}
              >
                {textContent}
              </pre>
            </ScrollArea>
          ) : showTable ? (
            <div className="flex h-[65vh] flex-col">
              <div className="flex flex-wrap items-center gap-3 border-b bg-background/80 px-4 py-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Exibindo até {MAX_PREVIEW_ROWS} linhas
                </div>
                {sheetNames.length > 1 ? (
                  <Select value={activeSheet} onValueChange={handleSheetChange}>
                    <SelectTrigger className="h-8 w-[200px] text-xs">
                      <SelectValue placeholder="Aba" />
                    </SelectTrigger>
                    <SelectContent>
                      {sheetNames.map((name) => (
                        <SelectItem key={name} value={name} className="text-xs">
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : sheetNames.length === 1 ? (
                  <span className="text-xs text-muted-foreground">
                    Aba: {sheetNames[0]}
                  </span>
                ) : null}
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4">
                  <div className="overflow-x-auto rounded-md border bg-background">
                    <table className="w-full border-collapse text-left text-xs">
                      <tbody>
                        {tableRows!.length === 0 ? (
                          <tr>
                            <td className="px-3 py-6 text-center text-muted-foreground">
                              Sem linhas para exibir
                            </td>
                          </tr>
                        ) : (
                          tableRows!.map((row, ri) => (
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
                                  className="max-w-[240px] truncate px-2 py-1.5 align-top"
                                  title={cell}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
              <FileText className="h-10 w-10" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Visualização não disponível para este tipo
                </p>
                <p className="text-xs">
                  Formatos como .doc legado, .odt e .zip precisam ser baixados
                  para abrir no aplicativo correspondente. Prefira .docx para
                  documentos Word.
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
