/**
 * Abstract "terrain" artwork for the sign-in page: stacked ridgelines, each one occluding the one behind it.
 * Pure SVG, deterministic (no randomness, no images), rendered on the server and never animated.
 */
const WIDTH = 900;
const HEIGHT = 1000;
const LINES = 24;
const GAP = 27;
const TOP = 330;
const STEPS = 72;

const round = (value: number) => Math.round(value * 10) / 10;

function ridge(index: number) {
  const depth = index / (LINES - 1); // 0 = far, 1 = near
  const baseY = TOP + index * GAP;
  const amplitude = 36 + depth * 150;
  const points: [number, number][] = [];
  for (let step = 0; step <= STEPS; step++) {
    const u = step / STEPS;
    const peak = Math.exp(-(((u - (0.64 - 0.1 * depth)) / 0.16) ** 2));
    const shoulder = Math.exp(-(((u - 0.18) / 0.13) ** 2)) * 0.5;
    const ripple = Math.sin(u * 9 + index * 0.7) * 6 + Math.sin(u * 23 + index * 1.9) * 2.5;
    points.push([u * WIDTH, baseY - (peak + shoulder) * amplitude + ripple * (0.35 + depth * 0.65)]);
  }
  // Smooth the polyline with quadratic curves through segment midpoints.
  let d = `M${round(points[0][0])},${round(points[0][1])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    d += ` Q${round(x)},${round(y)} ${round((x + nx) / 2)},${round((y + ny) / 2)}`;
  }
  const [lx, ly] = points[points.length - 1];
  d += ` L${round(lx)},${round(ly)}`;
  return { d, depth };
}

const lines = Array.from({ length: LINES }, (_, index) => ridge(index));

export function Terrain({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      {lines.map(({ d, depth }, index) => (
        <g key={index}>
          <path d={`${d} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`} fill="#090c0e" />
          <path d={d} fill="none" stroke="#c4f56a" strokeOpacity={round(0.1 + depth * 0.62)} strokeWidth={depth > 0.9 ? 1.6 : 1.1} vectorEffect="non-scaling-stroke" />
        </g>
      ))}
    </svg>
  );
}
