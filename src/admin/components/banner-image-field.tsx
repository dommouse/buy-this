import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";

import {
  BANNER_FILL_COLORS,
  BANNER_IMAGE,
  bannerImageHelpText,
  blobToDataUrl,
  cropBannerToJpeg,
  validateBannerFile,
} from "@/admin/lib/banner-image";
import { ButtonSpinner } from "@/admin/components/loading";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type Props = {
  /** Preview URL: existing `/uploads/...` path or a local `data:` preview (not uploaded yet). */
  value: string;
  /** Called with preview only — upload happens when the parent saves the banner. */
  onChange: (previewUrl: string) => void;
  disabled?: boolean;
};

export function BannerImageField({ value, onChange, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [fillColor, setFillColor] = useState<string>(BANNER_FILL_COLORS[0]!.value);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedArea(pixels);
  }, []);

  function revokeSrc() {
    if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
    setSrc(null);
  }

  async function applyCropPreview() {
    if (!src || !croppedArea) return;
    setBusy(true);
    try {
      const blob = await cropBannerToJpeg(src, croppedArea, { fillColor });
      const dataUrl = await blobToDataUrl(blob);
      revokeSrc();
      setCropOpen(false);
      onChange(dataUrl);
      toast.success("Preview ready — image uploads when you save the banner");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Crop failed");
    } finally {
      setBusy(false);
    }
  }

  async function onFilePicked(file: File | undefined) {
    if (!file) return;
    const err = validateBannerFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    try {
      const objectUrl = URL.createObjectURL(file);
      setSrc(objectUrl);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
      setCroppedArea(null);
      setCropOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not process image");
    }
  }

  const previewIsLocal = value.startsWith("data:image/") || value.startsWith("blob:");

  return (
    <div className="space-y-2">
      <Label>Banner image *</Label>
      <p className="text-xs text-muted-foreground">{bannerImageHelpText()}</p>
      <p className="text-xs text-muted-foreground">
        Zoom out to fit the whole image; empty edges fill with your chosen pad color. Image is saved to the
        server only when you create/update the banner.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex">
          <input
            type="file"
            accept={BANNER_IMAGE.accept}
            className="hidden"
            disabled={disabled || busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              void onFilePicked(f);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" disabled={disabled || busy} asChild>
            <span>{busy ? <ButtonSpinner /> : null}{busy ? "Processing…" : "Browse image"}</span>
          </Button>
        </label>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || busy}
            onClick={() => onChange("")}
          >
            Remove
          </Button>
        ) : null}
      </div>

      {value ? (
        <div className="overflow-hidden rounded-lg border bg-muted/20">
          <img src={value} alt="Banner preview" className="aspect-[21/9] w-full object-cover" />
          <p className="truncate px-2 py-1 text-xs text-muted-foreground">
            {previewIsLocal ? "Local preview (uploads on save)" : value}
          </p>
        </div>
      ) : (
        <div className="flex aspect-[21/9] items-center justify-center rounded-lg border border-dashed bg-muted/10 px-4 text-center text-xs text-muted-foreground">
          No image yet — browse to crop. Target ratio {BANNER_IMAGE.aspectLabel}.
        </div>
      )}

      <Dialog
        open={cropOpen}
        onOpenChange={(open) => {
          if (!open) {
            revokeSrc();
          }
          setCropOpen(open);
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crop banner to {BANNER_IMAGE.aspectLabel}</DialogTitle>
          </DialogHeader>
          <div className="relative h-[420px] w-full overflow-hidden rounded-lg" style={{ background: fillColor }}>
            {src ? (
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                minZoom={BANNER_IMAGE.minZoom}
                maxZoom={BANNER_IMAGE.maxZoom}
                aspect={BANNER_IMAGE.aspect}
                restrictPosition={false}
                showGrid
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                style={{
                  containerStyle: { background: fillColor },
                }}
              />
            ) : null}
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Zoom (out / in)</Label>
              <input
                type="range"
                min={BANNER_IMAGE.minZoom}
                max={BANNER_IMAGE.maxZoom}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Zoom out below 100% to fit the full image; pad color fills empty edges.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Pad / fill color</Label>
              <div className="flex flex-wrap gap-2">
                {BANNER_FILL_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={c.label}
                    onClick={() => setFillColor(c.value)}
                    className={`h-8 w-8 rounded-full border-2 ${
                      fillColor === c.value ? "border-primary ring-2 ring-primary/30" : "border-muted-foreground/30"
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
                <label className="flex h-8 items-center gap-2 text-xs text-muted-foreground">
                  Custom
                  <input
                    type="color"
                    value={fillColor}
                    onChange={(e) => setFillColor(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                revokeSrc();
                setCropOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="button" disabled={busy || !croppedArea} onClick={() => void applyCropPreview()}>
              {busy ? <ButtonSpinner /> : null}
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
