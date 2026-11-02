import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";

import {
  BANNER_IMAGE,
  bannerImageHelpText,
  blobToDataUrl,
  cropBannerToJpeg,
  loadImageFromFile,
  needsBannerCrop,
  validateBannerFile,
} from "@/admin/lib/banner-image";
import { uploadBannerImage } from "@/admin/modules/banners/banners.functions";
import { ButtonSpinner } from "@/admin/components/loading";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type Props = {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
};

export function BannerImageField({ value, onChange, disabled }: Props) {
  const [uploading, setUploading] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedArea(pixels);
  }, []);

  async function persistBlob(blob: Blob) {
    setUploading(true);
    try {
      const dataUrl = await blobToDataUrl(blob);
      const res = await uploadBannerImage({
        data: {
          dataUrl,
          filename: `banner-${Date.now()}.jpg`,
        },
      });
      onChange(res.url);
      toast.success("Banner image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function finishCrop() {
    if (!src || !croppedArea) return;
    setUploading(true);
    try {
      const blob = await cropBannerToJpeg(src, croppedArea);
      setCropOpen(false);
      if (src.startsWith("blob:")) URL.revokeObjectURL(src);
      setSrc(null);
      await persistBlob(blob);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Crop failed");
      setUploading(false);
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
      const img = await loadImageFromFile(file);
      const objectUrl = URL.createObjectURL(file);
      if (needsBannerCrop(img.naturalWidth, img.naturalHeight)) {
        setSrc(objectUrl);
        setZoom(1);
        setCrop({ x: 0, y: 0 });
        setCropOpen(true);
        return;
      }
      // Already correct ratio — still normalize to output size + compress
      const full: Area = {
        x: 0,
        y: 0,
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
      const blob = await cropBannerToJpeg(objectUrl, full);
      URL.revokeObjectURL(objectUrl);
      await persistBlob(blob);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not process image");
    }
  }

  return (
    <div className="space-y-2">
      <Label>Banner image *</Label>
      <p className="text-xs text-muted-foreground">{bannerImageHelpText()}</p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex">
          <input
            type="file"
            accept={BANNER_IMAGE.accept}
            className="hidden"
            disabled={disabled || uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              void onFilePicked(f);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" disabled={disabled || uploading} asChild>
            <span>{uploading ? <ButtonSpinner /> : null}{uploading ? "Uploading…" : "Browse image"}</span>
          </Button>
        </label>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || uploading}
            onClick={() => onChange("")}
          >
            Remove
          </Button>
        ) : null}
      </div>

      {value ? (
        <div className="overflow-hidden rounded-lg border bg-muted/20">
          <img src={value} alt="Banner preview" className="aspect-[21/9] w-full object-cover" />
          <p className="truncate px-2 py-1 text-xs text-muted-foreground">{value}</p>
        </div>
      ) : (
        <div className="flex aspect-[21/9] items-center justify-center rounded-lg border border-dashed bg-muted/10 px-4 text-center text-xs text-muted-foreground">
          No image yet — browse to upload. If the ratio isn’t {BANNER_IMAGE.aspectLabel}, you can crop it.
        </div>
      )}

      <Dialog
        open={cropOpen}
        onOpenChange={(open) => {
          if (!open) {
            if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
            setSrc(null);
          }
          setCropOpen(open);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Crop banner to {BANNER_IMAGE.aspectLabel}</DialogTitle>
          </DialogHeader>
          <div className="relative h-[360px] w-full overflow-hidden rounded-lg bg-black">
            {src ? (
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                aspect={BANNER_IMAGE.aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            ) : null}
          </div>
          <div className="space-y-1">
            <Label>Zoom</Label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
                setSrc(null);
                setCropOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="button" disabled={uploading || !croppedArea} onClick={() => void finishCrop()}>
              {uploading ? <ButtonSpinner /> : null}
              Apply crop & upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
