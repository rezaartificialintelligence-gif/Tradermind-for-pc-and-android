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
    const mode = MODE_FOR_TYPE[selectedType];

    if (mode === 'point') {
      // Add immediately on click
      const ann: ScreenshotAnnotation = {
        id: uid(),
        type: selectedType,
        label: ANNOTATION_LABELS[selectedType],
        points: [pt],
        color: ANNOTATION_COLORS[selectedType] ?? '#94a3b8',
        createdAt: Date.now(),
      };
      onChange([...annotations, ann]);
    } else {
      setIsDrawing(true);
      setStartPoint(pt);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
    } else {
      setIsDrawing(true);
      setStartPoint(pt);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
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
    }

    setIsDrawing(false);
    setStartPoint(null);
  };

  const removeAnnotation = (id: string) => {
    onChange(annotations.filter(a => a.id !== id));
  };

  const clearAll = () => {
    onChange([]);
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
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ cursor: readOnly ? 'default' : 'crosshair', touchAction: 'none' }}
        />
        {!readOnly && (
          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
            {MODE_FOR_TYPE[selectedType] === 'point'
              ? 'کلیک کنید'
              : 'بکشید تا خط/ناحیه ایجاد شود'}
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
              <span className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: ann.color }}
                />
                {ann.label}
              </span>
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
    </div>
  );
}

export default memo(AnnotationCanvas);
