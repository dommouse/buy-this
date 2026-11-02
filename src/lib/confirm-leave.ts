import { confirmDialog } from "@/lib/confirm-dialog";

/** Confirm leaving an in-progress questionnaire (progress resets). */
export async function confirmLeaveQuestionnaire(): Promise<boolean> {
  return confirmDialog({
    title: "Leave gift finder?",
    text: "Your progress will be lost and the questionnaire will start from the beginning if you come back.",
    confirmButtonText: "Leave anyway",
    cancelButtonText: "Stay",
    icon: "warning",
  });
}
