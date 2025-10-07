export function Logo({ size = 40, className }: { size?: number, className?: string }) {
  const color = "#2563EB"; // primary color from globals.css
  return (
    <div className={className}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Shield background */}
        <path
          d="M50 10 L90 30 L90 70 L50 90 L10 70 L10 30 Z"
          fill={color}
          opacity="0.9"
        />

        {/* Microphone inside */}
        <circle cx="50" cy="45" r="15" fill="white" />
        <path
          d="M50 60 L50 75 M45 75 L55 75"
          stroke="white"
          strokeWidth="3"
        />

        {/* Voice waves (simplified for web SVG) */}
        <path
          d="M30 45 Q35 35 40 45 T50 45 T60 45 T70 45"
          stroke="white"
          strokeWidth="2"
          fill="none"
        />
      </svg>
    </div>
  );
}
