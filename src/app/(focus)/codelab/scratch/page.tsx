import { redirect } from "next/navigation";
import { Scratchpad } from "@/components/scratchpad";
import { requireProfile } from "@/lib/auth";
import { isRemoteExecutionConfigured } from "@/lib/execution";

export const metadata = { title: "Scratchpad" };

export default async function ScratchPage() {
  const { isTechnical } = await requireProfile();
  if (!isTechnical) redirect("/codelab");
  return (
    <div className="flex flex-1 flex-col lg:h-screen">
      <Scratchpad remoteExecutionEnabled={isRemoteExecutionConfigured} />
    </div>
  );
}
