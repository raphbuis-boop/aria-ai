/** Aria "A" mark on a card tile — shared by the sign-in screens. */
export function AriaMark({ size = 72 }: { size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-[20px] border border-border bg-card shadow-[0_8px_24px_rgba(31,92,70,0.12)]"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 200 200" width={size * 0.55} height={size * 0.55} aria-hidden>
        <path d="M100 25 L165 175 L130 175 L120 150 L80 150 L70 175 L35 175 Z M90 125 L110 125 L100 100 Z" fill="var(--primary)" />
      </svg>
    </span>
  );
}
