import { cn } from '../lib/utils';

type TawaselLoaderVariant = 'pulse' | 'typing' | 'orbit';

type TawaselLoaderProps = {
  size?: number;
  variant?: TawaselLoaderVariant;
  label?: string;
  className?: string;
};

export default function TawaselLoader({
  size = 48,
  variant = 'pulse',
  label = 'Loading',
  className,
}: TawaselLoaderProps) {
  const isTyping = variant === 'typing';
  const isOrbit = variant === 'orbit';

  return (
    <div
      className={cn(
        'tawasel-loader',
        isTyping && 'tawasel-loader--typing',
        isOrbit && 'tawasel-loader--orbit',
        className
      )}
      style={{ width: size, height: size }}
      role="status"
      aria-label={label}
    >
      <svg viewBox="0 0 128 128" className="h-full w-full" aria-hidden="true">
        {isOrbit && <circle className="orbit-ring" cx="64" cy="64" r="52" fill="none" />}
        <g className="back">
          <path
            fill="#A8DDBE"
            d="M30 16h54c16.6 0 30 13.4 30 30v22c0 16.6-13.4 30-30 30H55l-26 17c-3.4 2.2-7.8-.7-7.1-4.7L26 91.5C17.5 86.1 12 76.6 12 66V46c0-16.6 13.4-30 30-30Z"
          />
        </g>
        <g className="front">
          <path
            fill="#15A862"
            d="M22 8h54c16.6 0 30 13.4 30 30v22c0 16.6-13.4 30-30 30H47l-26 17c-3.4 2.2-7.8-.7-7.1-4.7L18 83.5C9.5 78.1 4 68.6 4 58V38C4 21.4 17.4 8 34 8Z"
          />
        </g>
        {isTyping ? (
          <g className="typing-dots" fill="#fff">
            <circle cx="39" cy="52" r="6" />
            <circle cx="55" cy="52" r="6" />
            <circle cx="71" cy="52" r="6" />
          </g>
        ) : (
          <path
            className="t"
            fill="#fff"
            d="M30 32h48c3.3 0 6 2.7 6 6s-2.7 6-6 6H61v34c0 3.9-3.1 7-7 7s-7-3.1-7-7V44H30c-3.3 0-6-2.7-6-6s2.7-6 6-6Z"
          />
        )}
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}
