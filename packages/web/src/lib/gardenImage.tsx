// Renders a garden into a downloadable PNG "share card" (garden scene + who-it's-from + wordmark).
// Composed as a self-contained SVG (no external assets, so the canvas isn't tainted) and reuses
// FlowerSVG in staticRender mode so the flowers rasterize fully open, not mid-animation.
import { renderToStaticMarkup } from 'react-dom/server';
import type { FlowerSpec } from '../garden';
import FlowerSVG from '../components/FlowerSVG';

const W = 1080;
const H = 1080;

export interface GardenImageOpts {
  flowers: FlowerSpec[];
  from?: string | undefined;
  to?: string | undefined;
}

function ShareImage({ flowers, from, to }: GardenImageOpts) {
  const panelX = 80;
  const panelY = 230;
  const panelW = 920;
  const panelH = 540;
  const groundH = 150;
  const groundSurface = panelY + panelH - groundH;
  const scale = 1.7;
  const n = Math.max(1, flowers.length);
  const headline = from ? `${from} grew ${to || 'you'} a garden` : `a garden, for ${to || 'you'}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      fontFamily="Georgia, 'Times New Roman', serif"
    >
      <defs>
        <linearGradient id="bnSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dbe7f2" />
          <stop offset="100%" stopColor="#eef3e4" />
        </linearGradient>
        <clipPath id="bnPanel">
          <rect x={panelX} y={panelY} width={panelW} height={panelH} rx="28" />
        </clipPath>
      </defs>

      <rect width={W} height={H} fill="#faf6ee" />
      <text x={W / 2} y={170} textAnchor="middle" fontSize="40" fontStyle="italic" fill="#3f6b3a">
        {headline}
      </text>

      <g clipPath="url(#bnPanel)">
        <rect x={panelX} y={panelY} width={panelW} height={panelH} fill="url(#bnSky)" />
        <rect x={panelX} y={groundSurface} width={panelW} height={groundH} fill="#8a6a4a" />
        <rect x={panelX} y={groundSurface} width={panelW} height="14" fill="#9c7c5a" />
        {flowers.map((f, i) => {
          const svgH = f.stemHeight + 80;
          const dispW = 80 * scale;
          const cx = panelX + (panelW * (i + 0.5)) / n;
          const x = cx - dispW / 2;
          const y = groundSurface + 6 - svgH * scale; // base tucked just into the soil
          return (
            <g key={i} transform={`translate(${x}, ${y}) scale(${scale})`}>
              <FlowerSVG flower={f} index={i} bloomed staticRender />
            </g>
          );
        })}
      </g>
      <rect
        x={panelX}
        y={panelY}
        width={panelW}
        height={panelH}
        rx="28"
        fill="none"
        stroke="#dfe6d8"
        strokeWidth="2"
      />

      <text x={W / 2} y={panelY + panelH + 96} textAnchor="middle" fontSize="54" fontWeight="bold" fill="#3f6b3a">
        bloomnote
      </text>
      <text
        x={W / 2}
        y={panelY + panelH + 138}
        textAnchor="middle"
        fontSize="24"
        fontFamily="system-ui, -apple-system, sans-serif"
        fill="#8a877f"
      >
        bloomnote.aidenjang.com
      </text>
    </svg>
  );
}

/** Build the share-card PNG and trigger a download. Rejects if rasterization fails. */
export async function downloadGardenImage(opts: GardenImageOpts): Promise<void> {
  const svg = renderToStaticMarkup(<ShareImage {...opts} />);
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const dpr = 2; // render at 2x for a crisp 2160px image
        const canvas = document.createElement('canvas');
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas unavailable'));
        ctx.scale(dpr, dpr);
        ctx.drawImage(img, 0, 0, W, H);
        canvas.toBlob((png) => {
          if (!png) return reject(new Error('encode failed'));
          const href = URL.createObjectURL(png);
          const a = document.createElement('a');
          const base = (opts.to || 'garden').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
          a.download = `bloomnote-${base}.png`;
          a.href = href;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(href);
          resolve();
        }, 'image/png');
      };
      img.onerror = () => reject(new Error('svg render failed'));
      img.src = svgUrl;
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
