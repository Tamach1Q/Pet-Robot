import { ProposalCard } from "@/components/proposal/ProposalCard";
import { ScreenShell } from "@/components/layout/ScreenShell";

export default function ProposalPage() {
  return (
    <ScreenShell
      title="きょうのおさんぽ"
      description="きょうのおすすめを ひとつだけ ご案内します"
    >
      <ProposalCard />
    </ScreenShell>
  );
}
