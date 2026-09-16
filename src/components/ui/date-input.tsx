import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  formatDatePtBR,
  parseDatePtBRToISO,
  parseISODateOnly,
  toISODateOnly,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

type DateInputProps = {
  id?: string;
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
};

/**
 * Campo de data em pt-BR (dd/mm/yyyy).
 * Valor interno/API permanece `yyyy-MM-dd` (ou string vazia).
 */
export function DateInput({
  id,
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
  disabled = false,
  className,
  buttonClassName,
}: DateInputProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    setText(null);
  }, [value]);

  const selected = parseISODateOnly(value);
  const display = text ?? (value ? formatDatePtBR(value) : "");

  function commitText(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange("");
      setText(null);
      return;
    }
    const iso = parseDatePtBRToISO(trimmed);
    if (iso) {
      onChange(iso);
      setText(null);
      return;
    }
    setText(raw);
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <Input
        id={id}
        value={display}
        placeholder={placeholder}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="off"
        className="flex-1"
        onChange={(event) => setText(event.target.value)}
        onBlur={(event) => commitText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitText((event.target as HTMLInputElement).value);
          }
        }}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            className={cn("shrink-0", buttonClassName)}
            aria-label="Abrir calendário"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              if (!date) {
                onChange("");
              } else {
                onChange(toISODateOnly(date));
              }
              setText(null);
              setOpen(false);
            }}
            formatters={{
              formatCaption: (date) =>
                format(date, "LLLL yyyy", { locale: ptBR }),
              formatMonthDropdown: (date) =>
                format(date, "LLL", { locale: ptBR }),
              formatWeekdayName: (date) =>
                format(date, "EEEEEE", { locale: ptBR }),
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
