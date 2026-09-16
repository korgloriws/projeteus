import { useEffect, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Accent = "primary" | "blue" | "green" | "red";

const accentStyles: Record<
  Accent,
  { chip: string; blob: string; value: string }
> = {
  primary: {
    chip: "bg-primary/10 text-primary",
    blob: "bg-primary",
    value: "text-foreground",
  },
  blue: {
    chip: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    blob: "bg-blue-500",
    value: "text-foreground",
  },
  green: {
    chip: "bg-green-500/10 text-green-600 dark:text-green-400",
    blob: "bg-green-500",
    value: "text-foreground",
  },
  red: {
    chip: "bg-red-500/10 text-red-600 dark:text-red-400",
    blob: "bg-red-500",
    value: "text-red-600 dark:text-red-400",
  },
};

export function AnimatedCounter({ value }: { value: number }) {
  const shouldReduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(shouldReduceMotion ? value : 0);

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [value, shouldReduceMotion]);

  return <>{display}</>;
}

interface StatCardProps {
  title: string;
  value: number;
  subtitle?: string;
  icon: LucideIcon;
  accent?: Accent;
  index?: number;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = "primary",
  index = 0,
}: StatCardProps) {
  const styles = accentStyles[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -4 }}
    >
      <Card className="relative overflow-hidden transition-shadow duration-300 hover:shadow-lg">
        <div
          className={cn(
            "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-10 blur-2xl transition-opacity duration-300",
            styles.blob,
          )}
        />
        <div className="flex items-start justify-between p-6 pb-2">
          <span className="text-sm font-medium text-muted-foreground">
            {title}
          </span>
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg",
              styles.chip,
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={2.2} />
          </span>
        </div>
        <div className="px-6 pb-6">
          <div className={cn("text-3xl font-bold tracking-tight", styles.value)}>
            <AnimatedCounter value={value} />
          </div>
          {subtitle ? (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </Card>
    </motion.div>
  );
}
