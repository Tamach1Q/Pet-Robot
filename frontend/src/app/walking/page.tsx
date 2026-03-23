import { ScreenShell } from "@/components/layout/ScreenShell";
import { WalkingStatusCard } from "@/components/walking/WalkingStatusCard";

export default function WalkingPage() {
  return (
    <ScreenShell
      title="いまのおさんぽ"
      description="いまのようすを かんたんに お知らせします"
    >
      <WalkingStatusCard />
    </ScreenShell>
  );
}
