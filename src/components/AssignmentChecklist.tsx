import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface AssignmentOption {
  id: number;
  label: string;
  description?: string;
}

interface AssignmentChecklistProps {
  label: string;
  description?: string;
  options: AssignmentOption[];
  selectedIds: number[];
  onChange: (selectedIds: number[]) => void;
  disabled?: boolean;
  emptyMessage?: string;
}

export function AssignmentChecklist({
  label,
  description,
  options,
  selectedIds,
  onChange,
  disabled = false,
  emptyMessage = "Nenhuma opção disponível.",
}: AssignmentChecklistProps) {
  function toggleOption(id: number) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((currentId) => currentId !== id)
        : [...selectedIds, id],
    );
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-md border border-dashed px-3 py-2">
          {emptyMessage}
        </p>
      ) : (
        <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border p-2">
          {options.map((option) => {
            const checked = selectedIds.includes(option.id);
            return (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-secondary/60"
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={() => toggleOption(option.id)}
                />
                <span className="flex-1">{option.label}</span>
                {option.description ? (
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
