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

export type GardenImageSaveResult = 'shared' | 'downloaded' | 'dismissed';

function ShareImage({ flowers, from, to }: GardenImageOpts) {
  const panelX = 80;
  const panelY = 230;
  const panelW = 920;
  const panelH = 540;
  const groundH = 150;
  const groundSurface = panelY + panelH - groundH;
  const scale = 1.7;
  const n = Math.max(1, flowers.length);
  // Names allow 60 chars, but the headline is one non-wrapping line — truncate so it can't run off
  // both edges of the exported PNG.
  const clipName = (s: string): string => (s.length > 18 ? `${s.slice(0, 17)}…` : s);
  const toName = to ? clipName(to) : 'you';
  const headline = from ? `${clipName(from)} grew ${toName} a garden` : `a garden, for ${toName}`;

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

/**
 * SVG markup to a PNG blob, via an offscreen canvas.
 *
 * `dpr` is fixed at 2 rather than read from the device: the output is a file other people look at,
 * so its resolution should not depend on the screen that happened to make it.
 */
async function rasterize(svg: string, w: number, h: number, dpr = 2): Promise<Blob> {
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    return await new Promise<Blob>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas unavailable'));
        ctx.scale(dpr, dpr);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((png) => (png ? resolve(png) : reject(new Error('encode failed'))), 'image/png');
      };
      img.onerror = () => reject(new Error('svg render failed'));
      img.src = svgUrl;
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

/** Rasterize the square download card. */
async function renderGardenPng(opts: GardenImageOpts): Promise<Blob> {
  return rasterize(renderToStaticMarkup(<ShareImage {...opts} />), W, H);
}

function downloadBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = filename;
  a.href = href;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

/**
 * Save the garden as an image. On phones this opens the native share sheet with the PNG, so the
 * user can tap "Save Image" and it lands in Photos (a plain download would go to Files instead).
 * On desktop, or if sharing a file isn't supported, it downloads the PNG.
 *
 * Call from a user gesture: the rasterization is fast, but navigator.share needs user activation.
 */
export async function saveGardenImage(opts: GardenImageOpts): Promise<GardenImageSaveResult> {
  const blob = await renderGardenPng(opts);
  const base = (opts.to || 'garden').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const filename = `bloomnote-${base}.png`;
  const file = new File([blob], filename, { type: 'image/png' });

  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: 'bloomnote',
        text: opts.to ? `A garden for ${opts.to}` : 'A garden',
      });
      return 'shared';
    } catch (err) {
      // User dismissed the sheet — done, don't also download.
      if (err instanceof Error && err.name === 'AbortError') return 'dismissed';
      // Anything else (e.g. lost user activation): fall through to a plain download.
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

// --- Link preview card ---------------------------------------------------
//
// A second composition at 1200x630, the size the shell's og:image:width/height already declare.
// The download card above is square, which is right for saving and wrong for unfurling: every
// large-image card slot is roughly 1.91:1, so a square gets centre-cropped and the headline (the
// part that says who this is from) is the first thing to go.
//
// Deliberately a separate component rather than the square one parameterised. They share only
// FlowerSVG and a palette; folding them together means every future tweak to the download card
// silently changes what strangers see in a chat preview.

const OG_W = 1200;
const OG_H = 630;

function OgCard({ flowers, from, to }: GardenImageOpts) {
  const panelX = 70;
  const panelY = 128;
  const panelW = OG_W - panelX * 2;
  const panelH = 372;
  const groundH = 104;
  const groundSurface = panelY + panelH - groundH;
  const n = Math.max(1, flowers.length);
  /*
   * Fit the tallest flower, rather than trusting a constant.
   *
   * Stem heights vary from 70 to 115, so `svgH` runs from 150 to 195 and any fixed scale is either
   * too small for a short bouquet or clips a tall one against the panel rim. Both of those shipped
   * while I was picking numbers by eye: 1.45 left the flowers marooned in empty sky, and 1.7
   * sliced the tops off the two tallest. Deriving it from the actual garden means every card fills
   * the panel and none of them lose a flower head.
   */
  const tallest = Math.max(150, ...flowers.map((f) => f.stemHeight + 80));
  const headroom = 18;
  const scale = Math.min(1.9, (groundSurface + 5 - (panelY + headroom)) / tallest);
  const clipName = (s: string): string => (s.length > 18 ? `${s.slice(0, 17)}…` : s);
  const toName = to ? clipName(to) : 'you';
  const headline = from ? `${clipName(from)} grew ${toName} a garden` : `a garden, for ${toName}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={OG_W}
      height={OG_H}
      viewBox={`0 0 ${OG_W} ${OG_H}`}
      fontFamily="Georgia, 'Times New Roman', serif"
    >
      <defs>
        <linearGradient id="ogSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dbe7f2" />
          <stop offset="100%" stopColor="#eef3e4" />
        </linearGradient>
        <clipPath id="ogPanel">
          <rect x={panelX} y={panelY} width={panelW} height={panelH} rx="26" />
        </clipPath>
      </defs>

      <rect width={OG_W} height={OG_H} fill="#faf6ee" />
      <text x={OG_W / 2} y={86} textAnchor="middle" fontSize="44" fontStyle="italic" fill="#3f6b3a">
        {headline}
      </text>

      <g clipPath="url(#ogPanel)">
        <rect x={panelX} y={panelY} width={panelW} height={panelH} fill="url(#ogSky)" />
        <rect x={panelX} y={groundSurface} width={panelW} height={groundH} fill="#8a6a4a" />
        <rect x={panelX} y={groundSurface} width={panelW} height="12" fill="#9c7c5a" />
        {flowers.map((f, i) => {
          const svgH = f.stemHeight + 80;
          const dispW = 80 * scale;
          const cx = panelX + (panelW * (i + 0.5)) / n;
          return (
            <g
              key={i}
              transform={`translate(${cx - dispW / 2}, ${groundSurface + 5 - svgH * scale}) scale(${scale})`}
            >
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
        rx="26"
        fill="none"
        stroke="#dfe6d8"
        strokeWidth="2"
      />

      <text x={OG_W / 2} y={panelY + panelH + 60} textAnchor="middle" fontSize="40" fontWeight="bold" fill="#3f6b3a">
        bloomnote
      </text>
    </svg>
  );
}

/**
 * Render the link-preview card and hand it to the Worker to store against this garden.
 *
 * Runs in the sender's browser because that is where a canvas is. Best-effort by design: a failure
 * here costs the link its picture, nothing else, so it must never surface an error or block the
 * share card from appearing. The sender has just finished making a gift; a toast about an Open
 * Graph upload would be absurd.
 */
export async function uploadOgImage(id: string, opts: GardenImageOpts): Promise<void> {
  try {
    const svg = renderToStaticMarkup(<OgCard {...opts} />);
    // 1x for the card: 1200x630 is already the declared size, and a 2x PNG of this is around
    // a megabyte, which is both over the Worker's cap and slower to unfurl than it is prettier.
    const png = await rasterize(svg, OG_W, OG_H, 1);
    await fetch(`/api/garden/${id}/og`, {
      method: 'POST',
      headers: { 'content-type': 'image/png' },
      body: png,
    });
  } catch {
    // Swallowed on purpose. See above.
  }
}
