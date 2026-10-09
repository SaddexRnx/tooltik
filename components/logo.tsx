import type { SVGProps } from "react";

/**
 * ToolT mascot: the peeking cat (ears + eyes + nose only, no head outline).
 * Drawn as a single-color SVG so it adapts to any theme via `currentColor`
 * with no background, exactly like the original mark.
 */

const EAR =
  "M11 30.5C10 21 13 11 18.5 3.5C19.5 11 22 18 25 22L21.5 24.5L24.5 27.5L16 31.5Z";

// Eye = filled ring + floating pupil, punched out with the even-odd rule.
const eyePath = (cx: number) =>
  [
    `M${cx} 32.8a8.2 8.2 0 1 0 0 16.4a8.2 8.2 0 1 0 0-16.4Z`,
    `M${cx} 34.4a6.6 6.6 0 1 1 0 13.2a6.6 6.6 0 1 1 0-13.2Z`,
    `M${cx} 38a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z`,
  ].join(" ");

const NOSE =
  "M32 50.2C33.3 50.2 34.3 51.1 34.3 52.2C34.3 53.5 33.2 54.6 32 55.6C30.8 54.6 29.7 53.5 29.7 52.2C29.7 51.1 30.7 50.2 32 50.2Z";

export function Logo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path d={EAR} fill="currentColor" />
      <path d={EAR} fill="currentColor" transform="matrix(-1 0 0 1 64 0)" />
      <path d={eyePath(23.5)} fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
      <path
        d={eyePath(40.5)}
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        transform="matrix(-1 0 0 1 64 0)"
      />
      <path d={NOSE} fill="currentColor" />
    </svg>
  );
}
