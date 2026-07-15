import { useListOrganizationSectors } from "@api/sectors";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MemberSectorSelectProps {
  organizationId: number | null | undefined;
  value: number | null;
  onValueChange: (sectorId: number | null) => void;
  disabled?: boolean;
  label?: string;
  sectorLabel?: string;
  className?: string;
  id?: string;
  hideLabel?: boolean;
}

export function MemberSectorSelect({
  organizationId,
  value,
  onValueChange,
  disabled = false,
  label = "Setor",
  sectorLabel = "setor",
  className,
  id = "member-sector",
  hideLabel = false,
}: MemberSectorSelectProps) {
  const { data: sectors, isLoading } = useListOrganizationSectors(organizationId ?? 0, {
    query: { enabled: Boolean(organizationId) },
  });

  if (!organizationId) {
    return null;
  }

  return (
    <div className={`${hideLabel ? "" : "space-y-2"} ${className ?? ""}`}>
      {!hideLabel ? <Label htmlFor={id}>{label}</Label> : null}
      <Select
        value={value != null ? String(value) : "none"}
        onValueChange={(next) =>
          onValueChange(next === "none" ? null : Number(next))
        }
        disabled={disabled || isLoading}
      >
        <SelectTrigger id={id} className={hideLabel ? "h-8" : undefined}>
          <SelectValue
            placeholder={
              isLoading
                ? `Carregando ${sectorLabel}s...`
                : `Selecione um ${sectorLabel} (opcional)`
            }
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nenhum</SelectItem>
          {sectors?.map((sector) => (
            <SelectItem key={sector.id} value={String(sector.id)}>
              {sector.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
