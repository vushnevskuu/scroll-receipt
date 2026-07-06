interface ReceiptDividerProps {
  double?: boolean;
}

export function ReceiptDivider({ double = false }: ReceiptDividerProps) {
  const char = double ? '=' : '-';
  return (
    <div
      className="my-2 overflow-hidden whitespace-nowrap text-divider text-xs tracking-widest"
      aria-hidden="true"
    >
      {char.repeat(double ? 32 : 32)}
    </div>
  );
}
