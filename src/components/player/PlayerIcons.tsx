import type { SVGProps } from "react";

/** Stroke/fill icon set for transport controls. Decorative: callers own the label. */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return <Svg {...props}><path d="M8 5.6v12.8a1 1 0 0 0 1.52.85l10.2-6.4a1 1 0 0 0 0-1.7L9.52 4.75A1 1 0 0 0 8 5.6Z" fill="currentColor" /></Svg>;
}

export function PauseIcon(props: IconProps) {
  return <Svg {...props}><rect x="6" y="4.5" width="4.2" height="15" rx="1.2" fill="currentColor" /><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2" fill="currentColor" /></Svg>;
}

export function NextIcon(props: IconProps) {
  return <Svg {...props}><path d="M4.5 6.2v11.6a.9.9 0 0 0 1.4.75l8.6-5.8a.9.9 0 0 0 0-1.5L5.9 5.45a.9.9 0 0 0-1.4.75Z" fill="currentColor" /><rect x="16.5" y="5" width="3" height="14" rx="1" fill="currentColor" /></Svg>;
}

export function PreviousIcon(props: IconProps) {
  return <Svg {...props}><g transform="matrix(-1 0 0 1 24 0)"><path d="M4.5 6.2v11.6a.9.9 0 0 0 1.4.75l8.6-5.8a.9.9 0 0 0 0-1.5L5.9 5.45a.9.9 0 0 0-1.4.75Z" fill="currentColor" /><rect x="16.5" y="5" width="3" height="14" rx="1" fill="currentColor" /></g></Svg>;
}

export function ShuffleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7h3.2c1.6 0 3 .8 3.9 2.1l3.8 5.8c.9 1.3 2.3 2.1 3.9 2.1H21" />
        <path d="M3 17h3.2c1.6 0 3-.8 3.9-2.1M13.9 9.1c.9-1.3 2.3-2.1 3.9-2.1H21" />
        <path d="m18.5 4.5 2.5 2.5-2.5 2.5M18.5 14.5l2.5 2.5-2.5 2.5" />
      </g>
    </Svg>
  );
}

export function RepeatIcon({ one = false, ...props }: IconProps & { one?: boolean }) {
  return (
    <Svg {...props}>
      <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3.5 20 6.5l-3 3" />
        <path d="M4 11.5v-1a4 4 0 0 1 4-4h12" />
        <path d="M7 20.5 4 17.5l3-3" />
        <path d="M20 12.5v1a4 4 0 0 1-4 4H4" />
      </g>
      {one ? <text x="12" y="14.6" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor">1</text> : null}
    </Svg>
  );
}

export function SkipSecondsIcon({ forward = true, seconds = 15, ...props }: IconProps & { forward?: boolean; seconds?: number }) {
  return (
    <Svg {...props}>
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" transform={forward ? undefined : "matrix(-1 0 0 1 24 0)"}>
        <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
        <path d="M17.6 2.8v4.1h-4.1" />
      </g>
      <text x="12" y="15.2" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor">{seconds}</text>
    </Svg>
  );
}

export function AirPlayIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 17H4.5A1.5 1.5 0 0 1 3 15.5v-10A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5v10a1.5 1.5 0 0 1-1.5 1.5H18" />
      </g>
      <path d="M12 13.2 17 20H7l5-6.8Z" fill="currentColor" />
    </Svg>
  );
}

export function MoonIcon(props: IconProps) {
  return <Svg {...props}><path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></Svg>;
}

export function QueueIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
        <path d="M4 6h12M4 11h12M4 16h7" />
      </g>
      <path d="M15 14.2v5.6a.6.6 0 0 0 .9.5l4.3-2.8a.6.6 0 0 0 0-1l-4.3-2.8a.6.6 0 0 0-.9.5Z" fill="currentColor" />
    </Svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return <Svg {...props}><path d="m6 9.5 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

export function HeartIcon({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Svg {...props}>
      <path
        d="M12 20.2s-7.6-4.6-8.9-9.6C2.2 7.2 4.4 4.5 7.4 4.5c1.9 0 3.4 1 4.6 2.6 1.2-1.6 2.7-2.6 4.6-2.6 3 0 5.2 2.7 4.3 6.1-1.3 5-8.9 9.6-8.9 9.6Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
