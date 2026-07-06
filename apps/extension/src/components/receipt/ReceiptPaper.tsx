import type { ReactNode } from 'react';

interface ReceiptPaperProps {
  children: ReactNode;
  className?: string;
  maxWidth?: string;
}

export function ReceiptPaper({ children, className = '', maxWidth = '100%' }: ReceiptPaperProps) {
  return (
    <div className={`mx-auto px-3 py-4 ${className}`} style={{ maxWidth }}>
      <div className="receipt-edge-top" aria-hidden="true" />
      <article className="receipt-paper px-4 py-5 text-ink">{children}</article>
      <div className="receipt-edge-bottom" aria-hidden="true" />
    </div>
  );
}
