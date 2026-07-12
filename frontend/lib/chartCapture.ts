/**
 * Capture a live Recharts (or any SVG) chart as a PNG data URL for PDF embedding.
 * Prefer the nearest chart to the analytics drilldown / section being exported.
 */
export async function captureChartImageDataUrl(options?: {
  root?: ParentNode | null;
  selector?: string;
  background?: string;
  scale?: number;
}): Promise<string | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null;

  const root = options?.root ?? document;
  const selector = options?.selector ?? ".recharts-wrapper svg, .recharts-surface, svg.recharts-surface";
  const svg = root.querySelector(selector) as SVGSVGElement | null;
  if (!svg) return null;

  try {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const bbox = svg.getBoundingClientRect();
    const width = Math.max(320, Math.ceil(bbox.width || Number(svg.getAttribute("width")) || 640));
    const height = Math.max(180, Math.ceil(bbox.height || Number(svg.getAttribute("height")) || 360));
    const scale = options?.scale ?? 2;
    const bg = options?.background ?? "#ffffff";

    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));

    const serializer = new XMLSerializer();
    const svgText = serializer.serializeToString(clone);
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const dataUrl = await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = width * scale;
          canvas.height = height * scale;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(null);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });

    return dataUrl;
  } catch {
    return null;
  }
}
