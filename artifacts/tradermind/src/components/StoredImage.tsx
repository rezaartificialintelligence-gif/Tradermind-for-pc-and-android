import { useEffect, useMemo, useRef, useState, type ImgHTMLAttributes, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Download, ExternalLink, ImageOff, Maximize2, ZoomIn, ZoomOut, Expand, Shrink, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export type StoredImageSource =
  | string
  | Blob
  | { dataUrl?: string | null; imageBlob?: Blob | null }
  | null
  | undefined;

function unpackSource(source: StoredImageSource): { dataUrl: string; blob: Blob | null } {
  if (typeof source === 'string') return { dataUrl: source, blob: null };
  if (source instanceof Blob) return { dataUrl: '', blob: source };
  if (source) return { dataUrl: source.dataUrl ?? '', blob: source.imageBlob ?? null };
  return { dataUrl: '', blob: null };
}

/**
 * Resolves both legacy Base64 images and the Blob-backed screenshot records
 * introduced in database v21. The object URL is revoked whenever the Blob
 * changes or the component unmounts.
 */
export function useStoredImageUrl(source: StoredImageSource): string | null {
  const { dataUrl, blob } = useMemo(() => unpackSource(source), [source]);
  const [url, setUrl] = useState<string | null>(dataUrl || null);

  useEffect(() => {
    if (!blob) {
      setUrl(dataUrl || null);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setUrl(current => current === objectUrl ? null : current);
    };
  }, [blob, dataUrl]);

  return url;
}

async function sourceToBlob(source: StoredImageSource, resolvedUrl: string): Promise<Blob> {
  const { dataUrl, blob } = unpackSource(source);
  if (blob) return blob;
  const response = await fetch(dataUrl || resolvedUrl);
  if (!response.ok) throw new Error('تصویر قابل خواندن نیست');
  return response.blob();
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('خواندن تصویر انجام نشد'));
    reader.onload = () => {
      const value = String(reader.result ?? '');
      resolve(value.includes(',') ? value.slice(value.indexOf(',') + 1) : value);
    };
    reader.readAsDataURL(blob);
  });
}

function extensionFor(blob: Blob, fallback = 'webp'): string {
  const type = blob.type.split('/')[1]?.toLowerCase();
  return type === 'jpeg' ? 'jpg' : type || fallback;
}

async function downloadStoredImage(source: StoredImageSource, resolvedUrl: string, filename: string) {
  const blob = await sourceToBlob(source, resolvedUrl);
  const safeFilename = filename.replace(/[\\/:*?"<>|]+/g, '-').trim() || `tradermind-image.${extensionFor(blob)}`;

  if (Capacitor.isNativePlatform()) {
    const path = `TraderMind/${Date.now()}-${safeFilename}`;
    await Filesystem.writeFile({
      path,
      data: await blobToBase64(blob),
      directory: Directory.Documents,
      recursive: true,
    });
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Documents });
    await Share.share({
      title: 'تصویر TraderMind',
      text: 'تصویر ذخیره‌شده در TraderMind',
      url: uri,
      dialogTitle: 'ذخیره یا اشتراک‌گذاری تصویر',
    });
    return;
  }

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = safeFilename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

interface StoredImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  source: StoredImageSource;
  enableViewer?: boolean;
  showDownload?: boolean;
  filename?: string;
  viewerTitle?: string;
  fallback?: ReactNode;
}

/**
 * Image element for persisted app images. It renders a clear missing-image
 * state instead of silently showing a broken/empty image.
 */
export default function StoredImage({
  source,
  enableViewer = false,
  showDownload = false,
  filename = 'tradermind-image',
  viewerTitle,
  fallback,
  className,
  alt = '',
  ...imgProps
}: StoredImageProps) {
  const url = useStoredImageUrl(source);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const displayName = viewerTitle || alt || 'تصویر TraderMind';

  useEffect(() => setError(false), [url]);

  const image = url && !error ? (
    <img
      {...imgProps}
      src={url}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  ) : (
    fallback ?? (
      <div className={cn('flex h-full min-h-16 w-full items-center justify-center gap-2 bg-muted/20 text-xs text-muted-foreground', className)}>
        <ImageOff className="h-4 w-4 shrink-0" />
        تصویر در دسترس نیست
      </div>
    )
  );

  const download = async () => {
    if (!url || downloading) return;
    setDownloading(true);
    try {
      await downloadStoredImage(source, url, `${filename}.${extensionFor(await sourceToBlob(source, url))}`);
    } catch {
      toast.error('ذخیره یا اشتراک‌گذاری تصویر انجام نشد');
    } finally {
      setDownloading(false);
    }
  };

  if (!enableViewer || !url || error) return image;

  const trigger = (
    <button
      type="button"
      className="relative block h-full w-full cursor-zoom-in text-left"
      aria-label={`نمایش ${displayName}`}
    >
      {image}
      <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/70 p-1.5 text-white opacity-80">
        <Maximize2 className="h-3.5 w-3.5" />
      </span>
    </button>
  );

  return <ZoomableImageDialog trigger={trigger} url={url} alt={alt} displayName={displayName} showDownload={showDownload} download={download} downloading={downloading} />;
}

// ── ویوئر زوم/فول‌اسکرین ──────────────────────────────────────────
const ZOOM_MIN = 1;
const ZOOM_MAX = 8;
const ZOOM_STEP = 0.5;

function ZoomableImageDialog({
  trigger, url, alt, displayName, showDownload, download, downloading,
}: {
  trigger: ReactNode;
  url: string;
  alt: string;
  displayName: string;
  showDownload: boolean;
  download: () => void;
  downloading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ dragging: boolean; startX: number; startY: number; startPanX: number; startPanY: number }>({
    dragging: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0,
  });

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  useEffect(() => {
    if (!open) resetView();
  }, [open]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      toast.error('نمایش تمام‌صفحه در این مرورگر پشتیبانی نمی‌شود');
    }
  };

  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

  const zoomAt = (delta: number) => {
    setZoom(z => {
      const next = clampZoom(z + delta);
      if (next === ZOOM_MIN) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoomAt(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  };

  const handleDoubleClick = () => {
    setZoom(z => (z > ZOOM_MIN ? ZOOM_MIN : 2.5));
    setPan({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (zoom <= ZOOM_MIN) return;
    dragState.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current.dragging) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setPan({ x: dragState.current.startPanX + dx, y: dragState.current.startPanY + dy });
  };

  const handlePointerUp = () => {
    dragState.current.dragging = false;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className={cn(
          'border-white/10 bg-black/95 p-2',
          isFullscreen ? 'max-w-none w-screen h-screen rounded-none' : 'max-w-6xl',
        )}
      >
        <div ref={containerRef} className={cn('space-y-2', isFullscreen && 'flex h-full w-full flex-col bg-black')}>
          <div
            className={cn(
              'relative overflow-hidden rounded-lg bg-black/40 select-none',
              isFullscreen ? 'flex-1' : 'h-[78vh]',
            )}
            onWheel={handleWheel}
            onDoubleClick={handleDoubleClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            style={{ cursor: zoom > ZOOM_MIN ? (dragState.current.dragging ? 'grabbing' : 'grab') : 'zoom-in' }}
          >
            <img
              src={url}
              alt={alt}
              draggable={false}
              className="pointer-events-none mx-auto h-full w-full object-contain transition-transform duration-100"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            />

            {/* کنترل‌های زوم و فول‌اسکرین */}
            <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-lg bg-black/70 p-1 backdrop-blur-sm">
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-white hover:text-white hover:bg-white/10" onClick={() => zoomAt(-ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} title="کوچک‌نمایی">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="min-w-[3rem] text-center text-xs text-white tabular-nums">{Math.round(zoom * 100)}%</span>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-white hover:text-white hover:bg-white/10" onClick={() => zoomAt(ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} title="بزرگ‌نمایی">
                <ZoomIn className="h-4 w-4" />
              </Button>
              {zoom > ZOOM_MIN && (
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-white hover:text-white hover:bg-white/10" onClick={resetView} title="بازنشانی زوم">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="absolute bottom-3 right-3">
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-white hover:text-white hover:bg-white/10" onClick={toggleFullscreen} title={isFullscreen ? 'خروج از تمام‌صفحه' : 'نمایش تمام‌صفحه'}>
                {isFullscreen ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 px-1">
            <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{displayName}</p>
            {showDownload && (
              <Button type="button" size="sm" variant="outline" className="gap-2" onClick={download} disabled={downloading}>
                <Download className="h-4 w-4" />
                {downloading ? 'در حال آماده‌سازی...' : 'دانلود'}
              </Button>
            )}
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
              <ExternalLink className="h-4 w-4" />
              باز کردن
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
