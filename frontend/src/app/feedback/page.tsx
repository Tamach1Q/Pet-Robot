import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { ScreenShell } from "@/components/layout/ScreenShell";

export default function FeedbackPage() {
  return (
    <ScreenShell
      title="おさんぽどうでしたか"
      description="かんたんな かんそうを おしえてください"
    >
      <FeedbackForm />
    </ScreenShell>
  );
}
