export function MorningBriefing({ text }: { text: string }) {
  return (
    <div className="rounded-[14px] border border-border-card bg-bg-card px-[15px] py-[13px]">
      <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-dim">
        While you were away
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-text-secondary whitespace-pre-wrap">
        {text}
      </p>
    </div>
  );
}
