interface ReceiptLineProps {
  label: string;
  value: string;
  animate?: boolean;
  delayMs?: number;
  bold?: boolean;
}

export function ReceiptLine({
  label,
  value,
  animate = false,
  delayMs = 0,
  bold = false,
}: ReceiptLineProps) {
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      className={`grid grid-cols-[1fr_auto] items-baseline gap-2 text-sm tabular-nums ${
        animate && !reducedMotion ? 'receipt-animate-line' : ''
      } ${bold ? 'font-bold' : ''}`}
      style={animate && !reducedMotion ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      <span className="truncate uppercase tracking-wide">{label}</span>
      <span className="whitespace-nowrap text-right font-medium">{value}</span>
    </div>
  );
}

export function ReceiptDottedLine({
  label,
  value,
  animate = false,
  delayMs = 0,
}: ReceiptLineProps) {
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      className={`flex items-baseline gap-1 text-sm tabular-nums ${
        animate && !reducedMotion ? 'receipt-animate-line' : ''
      }`}
      style={animate && !reducedMotion ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      <span className="shrink-0 uppercase tracking-wide">{label}</span>
      <span className="min-w-2 flex-1 overflow-hidden text-divider">{'·'.repeat(40)}</span>
      <span className="shrink-0 whitespace-nowrap text-right font-medium">{value}</span>
    </div>
  );
}
