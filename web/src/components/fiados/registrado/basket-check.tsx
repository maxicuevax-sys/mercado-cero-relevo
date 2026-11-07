/**
 * Ilustración de la lámina 20: canasta verde con palomita y destellos.
 * Es SVG local (no hay export de esta pieza en `assets/`), con la paleta de
 * marca del resto de las ilustraciones.
 */
export function BasketCheck({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 220 170"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="108" cy="94" rx="86" ry="58" fill="#e7efdb" />
      <g stroke="#f0bd45" strokeWidth="9" strokeLinecap="round">
        <path d="M168 36 180 18" />
        <path d="M185 54 204 48" />
        <path d="M189 70 208 74" />
      </g>
      <path
        d="M80 78C80 40 96 27 110 27s30 13 30 51"
        fill="none"
        stroke="#128a4e"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <path
        d="M62 72h96l-11 65a10 10 0 0 1-10 9H83a10 10 0 0 1-10-9Z"
        fill="#128a4e"
      />
      <rect x="56" y="64" width="108" height="16" rx="8" fill="#0b6b3e" />
      <g fill="#fff9ec">
        <rect x="86" y="92" width="9" height="30" rx="4.5" />
        <rect x="105" y="92" width="9" height="30" rx="4.5" />
        <rect x="124" y="92" width="9" height="30" rx="4.5" />
      </g>
      <circle cx="164" cy="124" r="30" fill="#0e7a45" stroke="#fff9ec" strokeWidth="5" />
      <path
        d="M150 124l9 9 18-20"
        fill="none"
        stroke="#fff9ec"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
