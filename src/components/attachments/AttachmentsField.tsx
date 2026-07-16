import { useId, useRef, useState } from "react";
import {
  Eye,
  FileIcon,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  Loader2,
} from "lucide-react";
import type { Attachment } from "@api/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FilePreviewModal } from "./FilePreviewModal";

const ACCEPT =
  ".pdf,.txt,.csv,.xlsx,.xls,.doc,.docx,.odt,.ods,.rtf,.png,.jpg,.jpeg,.gif,.webp,.svg,.zip,.json,.xml,.md";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface PendingFile {
  key: string;
  file: File;
}

interface AttachmentsFieldProps {
  /** Arquivos já salvos no servidor */
  existing?: Attachment[];
  /** Arquivos locais ainda não enviados (criação / fila) */
  pending: PendingFile[];
  onPendingChange: (files: PendingFile[]) => void;
  /** Permite remover anexos já salvos */
  onRemoveExisting?: (attachment: Attachment) => void;
  /** Upload imediato ao selecionar (quando a entidade já existe) */
  onUploadFiles?: (files: File[]) => Promise<void> | void;
  canEdit?: boolean;
  uploading?: boolean;
  removingId?: number | null;
  label?: string;
  className?: string;
  compact?: boolean;
}

export function AttachmentsField({
  existing = [],
  pending,
  onPendingChange,
  onRemoveExisting,
  onUploadFiles,
  canEdit = true,
  uploading = false,
  removingId = null,
  label = "Anexos",
  className,
  compact = false,
}: AttachmentsFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<
    | { kind: "remote"; attachment: Attachment }
    | { kind: "local"; file: File }
    | null
  >(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  async function handleFilesSelected(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = Array.from(list);

    if (onUploadFiles) {
      await onUploadFiles(files);
    } else {
      const next: PendingFile[] = [
        ...pending,
        ...files.map((file) => ({
          key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
          file,
        })),
      ];
      onPendingChange(next);
    }

    if (inputRef.current) inputRef.current.value = "";
  }

  function removePending(key: string) {
    onPendingChange(pending.filter((item) => item.key !== key));
  }

  function openRemote(attachment: Attachment) {
    setPreview({ kind: "remote", attachment });
    setPreviewOpen(true);
  }

  function openLocal(file: File) {
    setPreview({ kind: "local", file });
    setPreviewOpen(true);
  }

  const empty = existing.length === 0 && pending.length === 0;

  return (
    <div className={cn("space-y-2", className)}>
      {!compact ? (
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={inputId} className="flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5" />
            {label}
          </Label>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-3.5 w-3.5" />
              )}
              Adicionar
            </Button>
          ) : null}
        </div>
      ) : canEdit ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="mr-1.5 h-3.5 w-3.5" />
          )}
          Anexar arquivo
        </Button>
      ) : null}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => void handleFilesSelected(e.target.files)}
      />

      {empty ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          Nenhum arquivo anexado. PDF, TXT, CSV, XLSX e outros formatos
          documentais (até 25 MB).
        </p>
      ) : (
        <ul className="space-y-1.5">
          {existing.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-2 text-sm"
            >
              <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{attachment.originalName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatBytes(attachment.sizeBytes)}
                  {attachment.uploadedBy
                    ? ` · ${attachment.uploadedBy.name}`
                    : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                title="Visualizar"
                onClick={() => openRemote(attachment)}
              >
                <Eye className="h-4 w-4" />
              </Button>
              {canEdit && onRemoveExisting ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                  title="Remover"
                  disabled={removingId === attachment.id}
                  onClick={() => onRemoveExisting(attachment)}
                >
                  {removingId === attachment.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              ) : null}
            </li>
          ))}

          {pending.map((item) => (
            <li
              key={item.key}
              className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-2.5 py-2 text-sm"
            >
              <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.file.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatBytes(item.file.size)} · pendente de envio
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                title="Visualizar"
                onClick={() => openLocal(item.file)}
              >
                <Eye className="h-4 w-4" />
              </Button>
              {canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                  title="Remover"
                  onClick={() => removePending(item.key)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <FilePreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        source={preview}
      />
    </div>
  );
}
