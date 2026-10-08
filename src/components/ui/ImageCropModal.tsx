import { useState, useEffect } from 'react';
import Cropper, { Area, MediaSize, Size } from 'react-easy-crop';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

// react-easy-crop's own default minZoom is 1 — meaning "zoom in only."
// Every uploaded logo has a different aspect ratio and no tenant's own mark
// is guaranteed to already be square, so without zooming OUT below 1, a
// wide or tall logo can never show its full extent inside a round crop —
// some edge always gets cut off with no way to shrink it down. 0.2 lets an
// admin shrink the image down to a fifth of its cover-fit size, enough
// headroom to fully fit almost any real-world logo shape.
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
function limitArea(max: number, value: number): number {
  return Math.min(max, Math.max(0, value));
}
function restrictPositionCoord(position: number, mediaSize: number, cropSize: number, zoom: number): number {
  const maxPosition = Math.abs((mediaSize * zoom) / 2 - cropSize / 2);
  return clamp(position, -maxPosition, maxPosition);
}

/** A direct port of react-easy-crop's own internal computeCroppedArea()
 * (node_modules/react-easy-crop/index.js, rotation always 0 here since this
 * modal never rotates) — called with OUR OWN crop/zoom state at the exact
 * moment "Save & Upload" is clicked, instead of trusting the library's own
 * onCropComplete callback. Confirmed live: for a single large zoom-slider
 * adjustment with no further fine-tuning, the LAST onCropComplete firing
 * could lag the zoom actually shown on screen — a user would zoom the
 * preview in close, click Save immediately, and the upload would reflect
 * an earlier, less-zoomed state. Computing it ourselves, synchronously,
 * from state we just read, has no such timing dependency: this always
 * matches exactly what's on screen the instant Save is clicked. */
function computeCroppedAreaPixels(
  crop: { x: number; y: number },
  mediaSize: MediaSize,
  cropSize: Size,
  aspect: number,
  zoom: number,
): Area {
  const restrictedCrop = {
    x: restrictPositionCoord(crop.x, mediaSize.width, cropSize.width, zoom),
    y: restrictPositionCoord(crop.y, mediaSize.height, cropSize.height, zoom),
  };

  const croppedAreaPercentages = {
    x: limitArea(100, ((mediaSize.width - cropSize.width / zoom) / 2 - restrictedCrop.x / zoom) / mediaSize.width * 100),
    y: limitArea(100, ((mediaSize.height - cropSize.height / zoom) / 2 - restrictedCrop.y / zoom) / mediaSize.height * 100),
    width: limitArea(100, (cropSize.width / mediaSize.width * 100) / zoom),
    height: limitArea(100, (cropSize.height / mediaSize.height * 100) / zoom),
  };

  const widthInPixels = Math.round(limitArea(mediaSize.naturalWidth, (croppedAreaPercentages.width * mediaSize.naturalWidth) / 100));
  const heightInPixels = Math.round(limitArea(mediaSize.naturalHeight, (croppedAreaPercentages.height * mediaSize.naturalHeight) / 100));
  const sizePixels = mediaSize.naturalWidth >= mediaSize.naturalHeight * aspect
    ? { width: Math.round(heightInPixels * aspect), height: heightInPixels }
    : { width: widthInPixels, height: Math.round(widthInPixels / aspect) };

  return {
    width: sizePixels.width,
    height: sizePixels.height,
    x: Math.round(limitArea(mediaSize.naturalWidth - sizePixels.width, (croppedAreaPercentages.x * mediaSize.naturalWidth) / 100)),
    y: Math.round(limitArea(mediaSize.naturalHeight - sizePixels.height, (croppedAreaPercentages.y * mediaSize.naturalHeight) / 100)),
  };
}

/** Pads the source image onto a square, transparent canvas (sized to its
 * LARGER dimension) BEFORE it ever reaches the cropper. Required because
 * react-easy-crop's own zoom<1 behavior doesn't do what it looks like it
 * should for a non-square source — confirmed live, and reproduced in an
 * isolated script against the library's own exported math: "zooming out"
 * only ever reveals more of the EXISTING image up to 100% of it, capped at
 * a square taken from its own shorter dimension. For a wide or tall logo,
 * that's a permanent crop of the middle — there is no zoom level, however
 * far out, that reveals the full extent with padding, because the library
 * has no concept of a crop extending past the image's own natural bounds.
 * Pre-padding to a square sidesteps this entirely: the "natural" image the
 * cropper ever sees is already square, so showing all of it is just
 * zoom=1, not a special case the library can't represent. */
async function padToSquare(file: File): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });

  const size = Math.max(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl; // canvas unsupported — fall back to the unpadded original
  ctx.drawImage(image, (size - image.naturalWidth) / 2, (size - image.naturalHeight) / 2);
  return canvas.toDataURL('image/png');
}

/** Renders the cropped selection onto an offscreen canvas and returns it as
 * a File. Output is always PNG so a circular crop keeps its transparent
 * corners rather than getting matted to black/white by a lossy format. */
async function getCroppedImageFile(imageSrc: string, cropPixels: Area, fileName: string): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = cropPixels.width;
  canvas.height = cropPixels.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.drawImage(
    image,
    cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height,
    0, 0, cropPixels.width, cropPixels.height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Crop failed')); return; }
      resolve(new File([blob], fileName.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' }));
    }, 'image/png');
  });
}

/** Pre-upload crop step — opened right after a file is picked, before it
 * ever reaches the server. Needed specifically because a tenant's own logo
 * is rarely already square: forced into a circular avatar via plain
 * object-fit:cover, an arbitrary-aspect-ratio source image crops at
 * whatever point the browser picks, which often cuts off the actual mark
 * (confirmed live against a real logo). Letting the admin pick the crop
 * themselves, once, at upload time, fixes this for good rather than
 * fighting object-fit/object-position per image.
 *
 * Reads the file via FileReader into a base64 data URL rather than
 * URL.createObjectURL — confirmed live that the blob-URL approach rendered
 * an empty black crop area. */
export default function ImageCropModal({
  file, aspect, cropShape, title, onCancel, onConfirm,
}: {
  file: File;
  aspect: number;
  cropShape: 'round' | 'rect';
  title: string;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [mediaSize, setMediaSize] = useState<MediaSize | null>(null);
  const [cropSize, setCropSize] = useState<Size | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    padToSquare(file).then((dataUrl) => { if (!cancelled) setImageSrc(dataUrl); });
    return () => { cancelled = true; };
  }, [file]);

  const ready = !!mediaSize && !!cropSize;

  const handleConfirm = async () => {
    if (!imageSrc || !mediaSize || !cropSize) return;
    setSaving(true);
    try {
      const cropPixels = computeCroppedAreaPixels(crop, mediaSize, cropSize, aspect, zoom);
      const cropped = await getCroppedImageFile(imageSrc, cropPixels, file.name);
      onConfirm(cropped);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onCancel}>
      <div
        className="bg-surface-elevated border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          <button onClick={onCancel} aria-label="Cancel" className="text-text-muted hover:text-text-primary">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="relative h-72 bg-black/90">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              aspect={aspect}
              cropShape={cropShape}
              showGrid={cropShape === 'rect'}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onMediaLoaded={setMediaSize}
              onCropSizeChange={setCropSize}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-white/60">Loading image…</div>
          )}
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted shrink-0">Zoom</span>
            <input
              type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={0.01} value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-ryze-600"
            />
          </div>
          <p className="text-[11px] text-text-muted">Drag to reposition, use the slider to zoom. This is exactly how it will appear in the chat widget.</p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button" onClick={onCancel}
              className="px-3.5 py-2 rounded-lg border border-border text-sm font-medium text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button" onClick={handleConfirm} disabled={saving || !ready}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ryze-600 text-white text-sm font-medium hover:bg-ryze-700 disabled:opacity-50 transition-colors"
            >
              <CheckIcon className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save & Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
