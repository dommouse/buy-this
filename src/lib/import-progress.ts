import Swal from "sweetalert2";

function progressHtml(step: string, detail: string, percent: number): string {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return `
    <div style="text-align:left;margin-top:0.75rem">
      <p style="margin:0 0 0.35rem;font-weight:600;color:#111">${step}</p>
      <p style="margin:0 0 0.85rem;font-size:0.875rem;color:#6b7280;line-height:1.4">${detail}</p>
      <div style="height:8px;border-radius:999px;background:#e5e7eb;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:oklch(0.604 0.236 350.3);transition:width 0.25s ease"></div>
      </div>
      <p style="margin:0.5rem 0 0;font-size:0.75rem;color:#9ca3af;text-align:right">${pct}%</p>
    </div>
  `;
}

/** Open a blocking SweetAlert progress dialog (no dismiss while open). */
export async function openImportProgress(title = "Importing catalog"): Promise<void> {
  void Swal.fire({
    title,
    html: progressHtml("Starting…", "Please keep this window open.", 2),
    allowOutsideClick: false,
    allowEscapeKey: false,
    allowEnterKey: false,
    showConfirmButton: false,
    backdrop: true,
    didOpen: () => {
      Swal.showLoading();
    },
  });
  // Let the modal paint before heavy work
  await new Promise((r) => setTimeout(r, 40));
}

export async function updateImportProgress(
  step: string,
  detail: string,
  percent: number,
): Promise<void> {
  if (!Swal.isVisible()) return;
  Swal.update({
    html: progressHtml(step, detail, percent),
  });
  Swal.showLoading();
  // Yield so React / Swal can paint between chunks
  await new Promise((r) => setTimeout(r, 0));
}

export async function finishImportProgress(opts: {
  ok: boolean;
  title: string;
  text: string;
}): Promise<void> {
  await Swal.fire({
    icon: opts.ok ? "success" : "error",
    title: opts.title,
    text: opts.text,
    confirmButtonText: "OK",
    confirmButtonColor: "oklch(0.604 0.236 350.3)",
  });
}
