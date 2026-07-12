"use client";

import { useEffect, useRef } from "react";

type DigitalSignaturePadProps = {
  disabled?: boolean;
  /** Existing signature File to redraw when remounting (e.g. wizard Previous). */
  value?: File | null;
  onChange?: (file: File | null) => void;
};

export default function DigitalSignaturePad({ disabled = false, value = null, onChange }: DigitalSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasStrokeRef = useRef(false);
  const restoredFromRef = useRef<File | null>(null);

  const paintBlank = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    paintBlank(canvas, ctx);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!value) {
      if (restoredFromRef.current) {
        paintBlank(canvas, ctx);
        hasStrokeRef.current = false;
        restoredFromRef.current = null;
      }
      return;
    }

    if (restoredFromRef.current === value && hasStrokeRef.current) return;

    let cancelled = false;
    const url = URL.createObjectURL(value);
    const img = new Image();
    img.onload = () => {
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      paintBlank(canvas, ctx);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      hasStrokeRef.current = true;
      restoredFromRef.current = value;
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
    };
    img.src = url;

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [value]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawingRef.current = true;
    canvas.setPointerCapture(e.pointerId);
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    hasStrokeRef.current = true;
  };

  const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    if (!canvas || !hasStrokeRef.current) {
      onChange?.(null);
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        onChange?.(null);
        return;
      }
      onChange?.(new File([blob], "digital-signature.png", { type: "image/png" }));
    }, "image/png");
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    paintBlank(canvas, ctx);
    hasStrokeRef.current = false;
    restoredFromRef.current = null;
    onChange?.(null);
  };

  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <canvas
        ref={canvasRef}
        width={520}
        height={160}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        style={{
          width: "100%",
          maxWidth: 520,
          height: 160,
          border: "1px solid #D1D5DB",
          borderRadius: 8,
          touchAction: "none",
          background: "#fff",
          cursor: disabled ? "not-allowed" : "crosshair",
          opacity: disabled ? 0.6 : 1,
        }}
      />
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" className="button" disabled={disabled} onClick={clear} style={{ background: "#6B7280" }}>
          Clear signature
        </button>
        <span style={{ fontSize: "0.82rem", color: "#64748B", alignSelf: "center" }}>
          Sign with finger or mouse, then upload below.
        </span>
      </div>
    </div>
  );
}
