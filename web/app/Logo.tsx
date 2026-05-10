type Props = {
  size?: number;
  className?: string;
};

// Geometric reinterpretation of the Semicolon mark — a dot floating above two
// parallel slanted bars. Drawn as crisp vector primitives so it scales without
// fuzz; same shape language as the colored mock-up but tuned for dark-bg use.
export default function Logo({ size = 28, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      role="img"
      aria-label="Semicolon"
      className={className}
    >
      <defs>
        <linearGradient id="semi-dot" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#A8CCFF" />
          <stop offset="1" stopColor="#5DA8E8" />
        </linearGradient>
        <linearGradient id="semi-stem-a" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#5DA8E8" />
          <stop offset="1" stopColor="#3F89D2" />
        </linearGradient>
        <linearGradient id="semi-stem-b" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#A8CCFF" />
          <stop offset="1" stopColor="#7CB7F2" />
        </linearGradient>
      </defs>

      {/* dot */}
      <circle cx="50" cy="28" r="11" fill="url(#semi-dot)" />

      {/* back bar — slightly behind, shifted left, deeper blue */}
      <rect
        x="34"
        y="46"
        width="13"
        height="42"
        rx="3"
        fill="url(#semi-stem-a)"
        transform="rotate(14 40 67)"
      />
      {/* front bar — overlaps slightly, lighter blue */}
      <rect
        x="51"
        y="44"
        width="13"
        height="42"
        rx="3"
        fill="url(#semi-stem-b)"
        transform="rotate(14 57 65)"
      />
    </svg>
  );
}
