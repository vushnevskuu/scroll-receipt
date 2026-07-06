import type { ReceiptData } from '@src/types';
import { formatDuration, formatNumber } from '@src/utils/format';
import { ReceiptDivider } from '@src/components/receipt/ReceiptDivider';
import { ReceiptDottedLine, ReceiptLine } from '@src/components/receipt/ReceiptLine';
import { ReceiptPaper } from '@src/components/receipt/ReceiptPaper';

interface DailyReceiptProps {
  receipt: ReceiptData;
  animate?: boolean;
  showReclaim?: boolean;
  onReclaim?: () => void;
  stamped?: boolean;
}

export function DailyReceipt({
  receipt,
  animate = true,
  showReclaim = true,
  onReclaim,
  stamped = false,
}: DailyReceiptProps) {
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shouldAnimate = animate && !reducedMotion;

  let lineIndex = 0;
  const nextDelay = () => lineIndex++ * 40;

  return (
    <ReceiptPaper>
      <header className="text-center">
        <ReceiptLine
          label=""
          value="SCROLL RECEIPT"
          animate={shouldAnimate}
          delayMs={nextDelay()}
          bold
        />
        <p className="mt-1 text-center text-xs uppercase tracking-[0.2em] text-ink-faded">
          Attention Accounting System
        </p>
      </header>

      <ReceiptDivider />
      <ReceiptLine label="RECEIPT" value={receipt.receiptId} animate={shouldAnimate} delayMs={nextDelay()} />
      <ReceiptLine label="DATE" value={receipt.date} animate={shouldAnimate} delayMs={nextDelay()} />
      <ReceiptLine label="STATUS" value={receipt.status} animate={shouldAnimate} delayMs={nextDelay()} />
      <ReceiptDivider />

      {receipt.platformLines.length === 0 ? (
        <p className="py-4 text-center text-xs uppercase text-ink-faded">No short-form activity yet</p>
      ) : (
        receipt.platformLines.map((line) => (
          <ReceiptDottedLine
            key={line.label}
            label={line.label}
            value={formatDuration(line.seconds)}
            animate={shouldAnimate}
            delayMs={nextDelay()}
          />
        ))
      )}

      <ReceiptDivider />
      <ReceiptDottedLine
        label="VIDEOS VIEWED"
        value={formatNumber(receipt.videosViewed)}
        animate={shouldAnimate}
        delayMs={nextDelay()}
      />
      <ReceiptDottedLine
        label="CONTENT ADVANCES"
        value={formatNumber(receipt.contentAdvances)}
        animate={shouldAnimate}
        delayMs={nextDelay()}
      />
      <ReceiptDottedLine
        label="QUICK SKIPS"
        value={formatNumber(receipt.quickSkips)}
        animate={shouldAnimate}
        delayMs={nextDelay()}
      />
      <ReceiptDottedLine
        label="AVG. VIEW TIME"
        value={`${receipt.avgViewSeconds} SEC`}
        animate={shouldAnimate}
        delayMs={nextDelay()}
      />
      <ReceiptDivider double />
      <ReceiptDottedLine
        label="TOTAL ATTENTION"
        value={formatDuration(receipt.totalActiveSeconds)}
        animate={shouldAnimate}
        delayMs={nextDelay()}
      />
      <ReceiptDivider double />

      <p className="text-center text-xs font-bold uppercase tracking-widest">Possible Alternatives</p>
      {receipt.equivalents.map((eq) => (
        <ReceiptDottedLine
          key={eq.id}
          label={eq.label}
          value={eq.unit ? `${eq.value} ${eq.unit}` : eq.value}
          animate={shouldAnimate}
          delayMs={nextDelay()}
        />
      ))}

      <ReceiptDivider double />
      <p className="text-xs uppercase text-ink-faded">* BROWSER ACTIVITY ONLY</p>
      {receipt.estimatedScrollDistance && (
        <p className="text-xs uppercase text-ink-faded">* SCROLL DISTANCE IS ESTIMATED</p>
      )}

      {showReclaim && (
        <div className="relative mt-6">
          <button
            type="button"
            onClick={onReclaim}
            className="w-full border border-ink bg-paper-secondary py-2 text-xs font-bold uppercase tracking-widest hover:bg-paper"
          >
            [ Reclaim The Next 20 Minutes ]
          </button>
          {stamped && (
            <div
              className="stamp-animate pointer-events-none absolute inset-0 flex items-center justify-center"
              aria-hidden="true"
            >
              <span className="rounded border-4 border-stamp-red px-4 py-1 text-lg font-bold uppercase text-stamp-red opacity-85">
                Reclaimed
              </span>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 space-y-1 text-center text-xs uppercase text-ink-faded">
        <p>Time cannot be refunded</p>
        <p>But your next minutes can be reclaimed</p>
      </div>

      <div className="mt-6 text-center">
        <p className="font-mono text-sm tracking-widest" aria-hidden="true">
          |||||||||||||||
        </p>
        <p className="text-xs uppercase tracking-widest">{receipt.receiptId}</p>
      </div>

      <p className="mt-4 text-center text-xs font-bold uppercase tracking-[0.25em]">
        Thank you for your attention
      </p>
    </ReceiptPaper>
  );
}

export function EmptyReceipt({ title, description }: { title: string; description: string }) {
  return (
    <ReceiptPaper>
      <header className="text-center">
        <p className="text-sm font-bold uppercase tracking-widest">Scroll Receipt</p>
        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-ink-faded">
          Attention Accounting System
        </p>
      </header>
      <ReceiptDivider />
      <p className="text-center text-sm font-bold uppercase tracking-wide">{title}</p>
      <p className="mt-3 text-center text-xs leading-relaxed text-ink-faded">{description}</p>
    </ReceiptPaper>
  );
}
