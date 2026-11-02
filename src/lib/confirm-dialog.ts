import Swal from "sweetalert2";

const PRIMARY = "oklch(0.604 0.236 350.3)";
const DANGER = "#dc2626";

export type ConfirmDialogOptions = {
  title: string;
  text?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  /** Destructive actions use a red confirm button. Default true. */
  danger?: boolean;
  icon?: "warning" | "question" | "info" | "error";
};

/** Shared SweetAlert2 confirm used across admin and user portals. */
export async function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  const result = await Swal.fire({
    title: options.title,
    text: options.text,
    icon: options.icon ?? "warning",
    showCancelButton: true,
    confirmButtonText: options.confirmButtonText ?? "Confirm",
    cancelButtonText: options.cancelButtonText ?? "Cancel",
    confirmButtonColor: options.danger === false ? PRIMARY : DANGER,
    cancelButtonColor: "#6b7280",
    reverseButtons: true,
    focusCancel: true,
  });
  return result.isConfirmed;
}
