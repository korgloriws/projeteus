import { useRef } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

type ProjeTeusLogoProps = {
  className?: string;
  /** Tamanho do ícone em px (largura/altura). */
  size?: number;
  /** Exibe o nome ao lado do ícone. */
  showWordmark?: boolean;
  /** Classes do texto da marca. */
  wordmarkClassName?: string;
  /** Força a intro mesmo se outra instância já tiver animado nesta sessão. */
  forceIntro?: boolean;
};

/** Garante que a intro rode só na primeira aparição da marca na sessão SPA. */
let brandIntroPlayed = false;

const rootVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1, delayChildren: 0.02 },
  },
};

const markVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

const frameVariants: Variants = {
  hidden: { opacity: 0, scale: 0.88 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 380, damping: 22 },
  },
};

function columnVariants(targetOpacity: number): Variants {
  return {
    hidden: { opacity: 0, y: 7 },
    show: {
      opacity: targetOpacity,
      y: 0,
      transition: { type: "spring", stiffness: 420, damping: 24 },
    },
  };
}

const wordmarkVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 360, damping: 26 },
  },
};


export function ProjeTeusLogo({
  className,
  size = 28,
  showWordmark = true,
  wordmarkClassName,
  forceIntro = false,
}: ProjeTeusLogoProps) {
  const reduceMotion = useReducedMotion();
  const playIntroRef = useRef<boolean | null>(null);

  if (playIntroRef.current === null) {
    const canPlay = !reduceMotion && (forceIntro || !brandIntroPlayed);
    if (canPlay) brandIntroPlayed = true;
    playIntroRef.current = canPlay;
  }

  const animate = playIntroRef.current;

  return (
    <motion.span
      className={cn("inline-flex items-center gap-2", className)}
      variants={rootVariants}
      initial={animate ? "hidden" : false}
      animate="show"
    >
      <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        width={size}
        height={size}
        fill="none"
        aria-hidden={showWordmark ? true : undefined}
        role={showWordmark ? undefined : "img"}
        aria-label={showWordmark ? undefined : "ProjeTeus"}
        className="shrink-0 origin-center"
        variants={markVariants}
      >
        {/* moldura do workspace */}
        <motion.rect
          x="3"
          y="5"
          width="42"
          height="38"
          rx="10"
          stroke="currentColor"
          strokeWidth="2.75"
          fill="none"
          style={{ originX: "24px", originY: "24px" }}
          variants={frameVariants}
        />
        {/* coluna 1 — planejamento */}
        <motion.g fill="currentColor" variants={columnVariants(0.4)}>
          <rect x="10" y="13" width="8" height="5.5" rx="1.75" />
          <rect x="10" y="21.5" width="8" height="5.5" rx="1.75" />
        </motion.g>
        {/* coluna 2 — andamento */}
        <motion.g fill="currentColor" variants={columnVariants(0.7)}>
          <rect x="20" y="13" width="8" height="5.5" rx="1.75" />
          <rect x="20" y="21.5" width="8" height="5.5" rx="1.75" />
          <rect x="20" y="30" width="8" height="5.5" rx="1.75" />
        </motion.g>
        {/* coluna 3 — entrega */}
        <motion.g fill="currentColor" variants={columnVariants(1)}>
          <rect x="30" y="13" width="8" height="5.5" rx="1.75" />
          <rect x="30" y="21.5" width="8" height="5.5" rx="1.75" />
        </motion.g>
      </motion.svg>
      {showWordmark ? (
        <motion.span
          className={cn(
            "text-xl font-bold tracking-tight text-primary",
            wordmarkClassName,
          )}
          variants={wordmarkVariants}
        >
          ProjeTeus
        </motion.span>
      ) : null}
    </motion.span>
  );
}
