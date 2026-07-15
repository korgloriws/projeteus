import { useListOrganizationPositions } from "@api/positions";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MemberPositionSelectProps {
  organizationId: number | null | undefined;
  value: number | null;
  onValueChange: (positionId: number | null) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  id?: string;
  hideLabel?: boolean;
}

export function MemberPositionSelect({
  organizationId,
  value,
  onValueChange,
  disabled = false,
  label = "Cargo",
  className,
  id = "member-position",
  hideLabel = false,
}: MemberPositionSelectProps) {
  const { data: positions, isLoading } = useListOrganizationPositions(
    organizationId ?? 0,
    {
      query: { enabled: Boolean(organizationId) },
    },
  );

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
              isLoading ? "Carregando cargos..." : "Selecione um cargo (opcional)"
            }
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nenhum</SelectItem>
          {positions?.map((position) => (
            <SelectItem key={position.id} value={String(position.id)}>
              {position.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
