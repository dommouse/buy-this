/** Banner hero image requirements (full-bleed homepage slider). */
export const BANNER_IMAGE = {
  /** Target aspect ratio width:height (21:9 ultrawide hero). */
  aspect: 21 / 9,
  aspectLabel: "21:9",
  /** Recommended export size */
  outputWidth: 1920,
  outputHeight: 823,
  /** Soft minimum after crop */
  minWidth: 1280,
  minHeight: 549,
  /** Accepted MIME types */
  accept: "image/jpeg,image/png,image/webp",
  acceptLabel: "JPG, PNG, or WebP",
  /** Max raw upload before crop/compress */
  maxUploadBytes: 8 * 1024 * 1024,
  maxUploadLabel: "8 MB",
  /** Target compressed JPEG size hint */
  targetJpegQuality: 0.82,
  maxOutputBytes: 900 * 1024,
  minZoom: 0.35,
  maxZoom: 3,
} as const;

export const BANNER_FILL_COLORS = [
  { id: "black", label: "Black", value: "#0f0f10" },
  { id: "navy", label: "Navy", value: "#1e293b" },
  { id: "blush", label: "Blush", value: "#fce7f3" },
  { id: "cream", label: "Cream", value: "#faf7f2" },
  { id: "white", label: "White", value: "#ffffff" },
  { id: "charcoal", label: "Charcoal", value: "#374151" },
] as const;

export function bannerImageHelpText(): string {
  return `${BANNER_IMAGE.aspectLabel} hero · recommended ${BANNER_IMAGE.outputWidth}×${BANNER_IMAGE.outputHeight}px · ${BANNER_IMAGE.acceptLabel} · max ${BANNER_IMAGE.maxUploadLabel} (auto-compressed on save)`;
}

export function validateBannerFile(file: File): string | null {
  const allowed = BANNER_IMAGE.accept.split(",");
  if (!allowed.includes(file.type)) {
    return `Invalid type. Use ${BANNER_IMAGE.acceptLabel}.`;
  }
  if (file.size > BANNER_IMAGE.maxUploadBytes) {
    return `File is too large (max ${BANNER_IMAGE.maxUploadLabel}).`;
  }
  return null;
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

export function needsBannerCrop(width: number, height: number, tolerance = 0.04): boolean {
  if (width < BANNER_IMAGE.minWidth || height < BANNER_IMAGE.minHeight) return true;
  const ratio = width / height;
  return Math.abs(ratio - BANNER_IMAGE.aspect) > tolerance;
}

/** react-easy-crop area shape */
export type CropAreaPixels = { x: number; y: number; width: number; height: number };

/**
 * Compose a 21:9 JPEG. Supports zoom-out / letterbox: areas outside the source
 * image are filled with `fillColor`.
 */
export async function cropBannerToJpeg(
  imageSrc: string,
  crop: CropAreaPixels,
  options?: { quality?: number; fillColor?: string },
): Promise<Blob> {
  const quality = options?.quality ?? BANNER_IMAGE.targetJpegQuality;
  const fillColor = options?.fillColor ?? "#0f0f10";

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for crop"));
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = BANNER_IMAGE.outputWidth;
  canvas.height = BANNER_IMAGE.outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.fillStyle = fillColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Map crop rectangle (may extend outside the image when zoomed out) onto output.
  const srcX = crop.x;
  const srcY = crop.y;
  const srcW = crop.width;
  const srcH = crop.height;

  const scaleX = canvas.width / srcW;
  const scaleY = canvas.height / srcH;

  const imgW = image.naturalWidth;
  const imgH = image.naturalHeight;

  // Intersection of crop rect with actual image bounds
  const left = Math.max(0, srcX);
  const top = Math.max(0, srcY);
  const right = Math.min(imgW, srcX + srcW);
  const bottom = Math.min(imgH, srcY + srcH);

  if (right > left && bottom > top) {
    const sx = left;
    const sy = top;
    const sw = right - left;
    const sh = bottom - top;
    const dx = (left - srcX) * scaleX;
    const dy = (top - srcY) * scaleY;
    const dw = sw * scaleX;
    const dh = sh * scaleY;
    ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  let q = quality;
  let blob = await canvasToJpeg(canvas, q);
  while (blob.size > BANNER_IMAGE.maxOutputBytes && q > 0.45) {
    q -= 0.08;
    blob = await canvasToJpeg(canvas, q);
  }
  return blob;
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode image"))),
      "image/jpeg",
      quality,
    );
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read image data"));
    reader.readAsDataURL(blob);
  });
}

export function isPendingBannerDataUrl(value: string): boolean {
  return value.startsWith("data:image/");
}
