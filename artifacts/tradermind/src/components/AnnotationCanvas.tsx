/**
 * AnnotationCanvas — Prompt 15, Section 12
 * ────────────────────────────────────────
 * Canvas overlay for annotating chart screenshots.
 * Annotations are stored as structured data; the original image is untouched.
 */

import { useRef, useEffect, useState, useCallback, memo } from 'react';
import {
  ScreenshotAnnotation,
  AnnotationType,
  AnnotationPoint,
  ANNOTATION_LABELS,
} from '../types/screenshot';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  MapPin, Minus, Minus as MinusIcon, Square, Crosshair, X, RotateCcw, Eye, EyeOff
} from 'lucide-react';

const ANNOTATION_COLORS: Record<string, string> = {
  entry: '#22c55e',
  'stop-loss': '#ef4444',
  'take-profit': '#3b82f6',
  support: '#10b981',
  resistance: '#f59e0b',
  liquidity: '#a855f7',
  fibonacci: '#ec4899',
  'impulse-start': '#06b6d4',
  'impulse-end': '#0891b2',
  'range-high': '#f59e0b',
  'range-low': '#f59e0b',
  'important-candle': '#f97316',
  zone: 'rgba(251,191,36,0.3)',
  arrow: '#94a3b8',
  label: '#e2e8f0',
};

interface Props {
  imageDataUrl: string;
  annotations: ScreenshotAnnotation[];
  onChange: (annotations: ScreenshotAnnotation[]) => void;
  readOnly?: boolean;
}

type DrawMode = 'point' | 'line' | 'zone';

const MODE_FOR_TYPE: Record<AnnotationType, DrawMode> = {
  entry: 'point', 'stop-loss': 'point', 'take-profit': 'point',
  support: 'line', resistance: 'line', liquidity: 'line',
  fibonacci: 'line', 'impulse-start': 'point', 'impulse-end': 'point',
  'range-high': 'line', 'range-low': 'line', 'important-candle': 'point',
  zone: 'zone', arrow: 'line', label: 'point',
};

function uid(): string {
  return crypto.randomUUID();
}

function AnnotationCanvas({ imageDataUrl, annotations, onChange, readOnly = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [selectedType, setSelectedType] = useState<AnnotationType>('entry');
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<AnnotationPoint | null>(null);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // نشانه‌ای که تازه ثبت شده یا برای ویرایش انتخاب شده — باکس متن برچسب برایش باز است
  const [editingAnnotation, setEditingAnnotation] = useState<{ id: string; label: string; isNew: boolean } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragPointIndex, setDragPointIndex] = useState<number>(0);

  // Load image onto canvas background
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      renderCanvas();
    };
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  useEffect(() => {
    renderCanvas();
  }, [annotations, showAnnotations, hoveredId]);

  const getRelativePoint = (e: React.MouseEvent<HTMLCanvasElement>): AnnotationPoint => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  // پیدا کردن نزدیک‌ترین نقطهٔ یک نشانهٔ موجود به محل کلیک — برای جابجایی یا انتخاب برای ویرایش
  const HIT_RADIUS = 0.025; // نسبت به عرض/ارتفاع نرمال‌شدهٔ تصویر (۰ تا ۱)
  const hitTestAnnotation = (pt: AnnotationPoint): { id: string; pointIndex: number } | null => {
    for (let i = annotations.length - 1; i >= 0; i--) {
      const ann = annotations[i];
      for (let pIdx = 0; pIdx < ann.points.length; pIdx++) {
        const p = ann.points[pIdx];
        const dx = p.x - pt.x;
        const dy = p.y - pt.y;
        if (Math.sqrt(dx * dx + dy * dy) <= HIT_RADIUS) {
          return { id: ann.id, pointIndex: pIdx };
        }
      }
    }
    return null;
  };

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    if (!showAnnotations) return;

    for (const ann of annotations) {
      drawAnnotation(ctx, ann, w, h, ann.id === hoveredId);
    }
  }, [annotations, showAnnotations, hoveredId]);

  function drawAnnotation(
    ctx: CanvasRenderingContext2D,
    ann: ScreenshotAnnotation,
    w: number,
    h: number,
    hovered: boolean,
  ) {
    const color = ann.color;
    const mode = MODE_FOR_TYPE[ann.type];
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = hovered ? 3 : 2;
    ctx.font = '12px sans-serif';
    ctx.textBaseline = 'top';

    if (mode === 'point' && ann.points.length >= 1) {
      const p = ann.points[0];
      const px = p.x * w;
      const py = p.y * h;

      // Circle marker
      ctx.beginPath();
      ctx.arc(px, py, hovered ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = color + 'aa';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#fff';
      ctx.fillText(ann.label, px + 10, py - 6);
    } else if (mode === 'line' && ann.points.length >= 2) {
      const p1 = ann.points[0];
      const p2 = ann.points[1];
      ctx.beginPath();
      ctx.moveTo(p1.x * w, p1.y * h);
      ctx.lineTo(p2.x * w, p2.y * h);
      ctx.strokeStyle = color;
      ctx.stroke();

      // Label at midpoint
      const mx = ((p1.x + p2.x) / 2) * w;
      const my = ((p1.y + p2.y) / 2) * h;
      ctx.fillStyle = color;
      ctx.fillText(ann.label, mx + 4, my - 14);
    } else if (mode === 'zone' && ann.points.length >= 2) {
      const p1 = ann.points[0];
      const p2 = ann.points[1];
      const x = Math.min(p1.x, p2.x) * w;
      const y = Math.min(p1.y, p2.y) * h;
      const rw = Math.abs(p2.x - p1.x) * w;
      const rh = Math.abs(p2.y - p1.y) * h;

      ctx.fillStyle = color;
      ctx.fillRect(x, y, rw, rh);
      ctx.strokeStyle = ann.color.replace('0.3', '1');
      ctx.strokeRect(x, y, rw, rh);
      ctx.fillStyle = '#fff';
      ctx.fillText(ann.label, x + 4, y + 4);
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    const pt = getRelativePoint(e);

    // اگر روی نقطهٔ یک نشانهٔ موجود کلیک شد، حالت جابجایی (drag) شروع می‌شود
    const hit = hitTestAnnotation(pt);
    if (hit) {
      setDraggingId(hit.id);
      setDragPointIndex(hit.pointIndex);
      return;
    }

    const mode = MODE_FOR_TYPE[selectedType];

    if (mode === 'point') {
      // نشانه با برچسب موقت ثبت می‌شود؛ بلافاصله باکس ویرایش برچسب باز می‌شود
      const ann: ScreenshotAnnotation = {
        id: uid(),
        type: selectedType,
        label: ANNOTATION_LABELS[selectedType],
        points: [pt],
        color: ANNOTATION_COLORS[selectedType] ?? '#94a3b8',
        createdAt: Date.now(),
      };
      onChange([...annotations, ann]);
      setEditingAnnotation({ id: ann.id, label: ANNOTATION_LABELS[selectedType], isNew: true });
    } else {
      setIsDrawing(true);
      setStartPoint(pt);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly || !draggingId) return;
    const pt = getRelativePoint(e);
    const updated = annotations.map(ann => {
      if (ann.id !== draggingId) return ann;
      const newPoints = ann.points.slice();
      newPoints[dragPointIndex] = pt;
      return { ...ann, points: newPoints };
    });
    onChange(updated);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggingId) {
      setDraggingId(null);
      return;
    }
    if (!isDrawing || !startPoint || readOnly) return;
    const pt = getRelativePoint(e);
    const mode = MODE_FOR_TYPE[selectedType];

    if (mode === 'line' || mode === 'zone') {
      const ann: ScreenshotAnnotation = {
        id: uid(),
        type: selectedType,
        label: ANNOTATION_LABELS[selectedType],
        points: [startPoint, pt],
        color: ANNOTATION_COLORS[selectedType] ?? '#94a3b8',
        createdAt: Date.now(),
      };
      onChange([...annotations, ann]);
      setEditingAnnotation({ id: ann.id, label: ANNOTATION_LABELS[selectedType], isNew: true });
    }

    setIsDrawing(false);
    setStartPoint(null);
  };

  // ── Touch support (mobile) ────────────────────────────────────────
  const getTouchPoint = (e: React.TouchEvent<HTMLCanvasElement>): AnnotationPoint => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const touch = e.changedTouches[0];
    return {
      x: (touch.clientX - rect.left) / rect.width,
      y: (touch.clientY - rect.top) / rect.height,
    };
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // prevent scroll while drawing
    if (readOnly) return;
    const pt = getTouchPoint(e);

    const hit = hitTestAnnotation(pt);
    if (hit) {
      setDraggingId(hit.id);
      setDragPointIndex(hit.pointIndex);
      return;
    }

    const mode = MODE_FOR_TYPE[selectedType];

    if (mode === 'point') {
      const ann: ScreenshotAnnotation = {
        id: uid(),
        type: selectedType,
        label: ANNOTATION_LABELS[selectedType],
        points: [pt],
        color: ANNOTATION_COLORS[selectedType] ?? '#94a3b8',
        createdAt: Date.now(),
      };
      onChange([...annotations, ann]);
      setEditingAnnotation({ id: ann.id, label: ANNOTATION_LABELS[selectedType], isNew: true });
    } else {
      setIsDrawing(true);
      setStartPoint(pt);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (readOnly || !draggingId) return;
    e.preventDefault();
    const pt = getTouchPoint(e);
    const updated = annotations.map(ann => {
      if (ann.id !== draggingId) return ann;
      const newPoints = ann.points.slice();
      newPoints[dragPointIndex] = pt;
      return { ...ann, points: newPoints };
    });
    onChange(updated);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (draggingId) {
      setDraggingId(null);
      return;
    }
    if (!isDrawing || !startPoint || readOnly) return;
    const pt = getTouchPoint(e);
    const mode = MODE_FOR_TYPE[selectedType];

    if (mode === 'line' || mode === 'zone') {
      const ann: ScreenshotAnnotation = {
        id: uid(),
        type: selectedType,
        label: ANNOTATION_LABELS[selectedType],
        points: [startPoint, pt],
        color: ANNOTATION_COLORS[selectedType] ?? '#94a3b8',
        createdAt: Date.now(),
      };
      onChange([...annotations, ann]);
      setEditingAnnotation({ id: ann.id, label: ANNOTATION_LABELS[selectedType], isNew: true });
    }

    setIsDrawing(false);
    setStartPoint(null);
  };

  const removeAnnotation = (id: string) => {
    onChange(annotations.filter(a => a.id !== id));
    if (editingAnnotation?.id === id) setEditingAnnotation(null);
  };

  const clearAll = () => {
    onChange([]);
    setEditingAnnotation(null);
  };

  const startEditLabel = (ann: ScreenshotAnnotation) => {
    if (readOnly) return;
    setEditingAnnotation({ id: ann.id, label: ann.label, isNew: false });
  };

  const saveEditingLabel = () => {
    if (!editingAnnotation) return;
    const trimmed = editingAnnotation.label.trim();
    onChange(annotations.map(a => a.id === editingAnnotation.id
      ? { ...a, label: trimmed || ANNOTATION_LABELS[a.type] }
      : a));
    setEditingAnnotation(null);
  };

  const cancelEditingLabel = () => {
    // اگر نشانه تازه ساخته شده و کاربر برچسب را لغو کرد، برچسب پیش‌فرض نوع همان می‌ماند
    setEditingAnnotation(null);
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedType} onValueChange={v => setSelectedType(v as AnnotationType)}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ANNOTATION_LABELS) as AnnotationType[]).map(t => (
                <SelectItem key={t} value={t} className="text-xs">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: ANNOTATION_COLORS[t] ?? '#94a3b8' }}
                    />
                    {ANNOTATION_LABELS[t]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-1 mr-auto">
            <Button
              variant="ghost" size="sm"
              onClick={() => setShowAnnotations(v => !v)}
              title={showAnnotations ? 'پنهان' : 'نمایش'}
            >
              {showAnnotations ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll} title="پاک کردن همه">
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div ref={containerRef} className="relative rounded-lg overflow-hidden border border-white/10">
        <canvas
          ref={canvasRef}
          width={1000}
          height={600}
          className="w-full h-auto cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ cursor: readOnly ? 'default' : draggingId ? 'grabbing' : 'crosshair', touchAction: 'none' }}
        />
        {!readOnly && !editingAnnotation && (
          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
            {MODE_FOR_TYPE[selectedType] === 'point'
              ? 'کلیک کنید — یا یک نشانهٔ موجود را بکشید تا جابجا شود'
              : 'بکشید تا خط/ناحیه ایجاد شود'}
          </div>
        )}

        {/* باکس ویرایش متن برچسب — بعد از قرار دادن نشانه یا با کلیک روی نشانهٔ موجود باز می‌شود */}
        {!readOnly && editingAnnotation && (
          <div className="absolute inset-x-2 bottom-2 flex items-center gap-2 bg-black/80 backdrop-blur-sm rounded-lg p-2">
            <input
              autoFocus
              value={editingAnnotation.label}
              onChange={e => setEditingAnnotation(prev => prev ? { ...prev, label: e.target.value } : prev)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveEditingLabel();
                if (e.key === 'Escape') cancelEditingLabel();
              }}
              placeholder="متن دلخواه برای این نشانه…"
              className="flex-1 h-8 rounded-md border border-white/20 bg-white/10 px-2 text-xs text-white placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button size="sm" className="h-8 text-xs" onClick={saveEditingLabel}>ذخیره</Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs text-white" onClick={cancelEditingLabel}>لغو</Button>
          </div>
        )}
      </div>

      {/* Annotation list */}
      {annotations.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {annotations.map(ann => (
            <div
              key={ann.id}
              className="flex items-center justify-between px-2 py-1 rounded text-xs bg-white/5
                         hover:bg-white/10 transition-colors cursor-default"
              onMouseEnter={() => setHoveredId(ann.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <button
                type="button"
                className="flex items-center gap-2 flex-1 text-right disabled:cursor-default"
                onClick={() => startEditLabel(ann)}
                disabled={readOnly}
                title={readOnly ? undefined : 'برای ویرایش متن برچسب کلیک کنید'}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: ann.color }}
                />
                {ann.label}
                {!readOnly && <Edit2 className="w-2.5 h-2.5 text-muted-foreground/60" />}
              </button>
              {!readOnly && (
                <button
                  onClick={() => removeAnnotation(ann.id)}
                  className="text-muted-foreground hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && annotations.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          نکته: هر نشانه روی تصویر را می‌توانید بکشید تا جابجا شود، یا از لیست بالا روی آن کلیک کنید تا متنش را ویرایش کنید.
        </p>
      )}
    </div>
  );
}

export default memo(AnnotationCanvas);
