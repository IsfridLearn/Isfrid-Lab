export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-56 rounded-md bg-muted" />
      <div className="mt-3 h-4 w-80 max-w-full rounded-md bg-muted" />
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="h-24 rounded-card bg-muted" />
        <div className="h-24 rounded-card bg-muted" />
        <div className="h-24 rounded-card bg-muted" />
      </div>
      <div className="mt-6 h-64 rounded-card bg-muted" />
    </div>
  );
}
