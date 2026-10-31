import type { Tone } from './view';

/** Five-segment priority meter. The exact score stays in the accessible name, never as a big number. */
export function Meter({ score, band, tone }: { score: number | null; band: string | null; tone: Tone }) {
  const filled = score === null ? 0 : Math.max(score > 0 ? 1 : 0, Math.ceil(score / 20));
  return (
    <span className={`dx-meter tone-${tone}`} role="img" aria-label={score === null ? 'Priority not scored' : `Priority ${band?.toLowerCase()}, ${score} of 100`}>
      {[0, 1, 2, 3, 4].map((n) => <i key={n} data-on={n < filled ? '' : undefined} />)}
    </span>
  );
}
