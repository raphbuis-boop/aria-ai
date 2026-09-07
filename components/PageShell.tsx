// Keep the canvas opaque during navigation. Replaying an opacity-from-zero
// animation exposed the legacy dark backdrop on every route change.
export function PageShell({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
