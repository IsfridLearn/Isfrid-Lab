import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center text-fg-subtle" aria-busy="true" aria-label="Loading">
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}
