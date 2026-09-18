import React from 'react';

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const Logo: React.FC<LogoProps> = ({
  size = 24,
  showText = false,
  className = '',
  style = {}
}) => {
  return (
    <div
      className={`logo-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size > 24 ? 10 : 8,
        ...style
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="logoBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#461220" />
            <stop offset="100%" stopColor="#1c070d" />
          </linearGradient>

          <linearGradient id="logoPlayGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8C2F39" />
            <stop offset="100%" stopColor="#461220" />
          </linearGradient>

          <linearGradient id="logoPlayGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#B23A48" />
            <stop offset="100%" stopColor="#8C2F39" />
          </linearGradient>

          <linearGradient id="logoCeruleanStream" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3AA6D0" />
            <stop offset="60%" stopColor="#247BA0" />
            <stop offset="100%" stopColor="#1B5F7D" />
          </linearGradient>

          <linearGradient id="logoBlushStream" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FCB9B2" />
            <stop offset="100%" stopColor="#E58D96" />
          </linearGradient>

          <linearGradient id="logoMauveStream" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#B23A48" />
            <stop offset="100%" stopColor="#8C2F39" />
          </linearGradient>
        </defs>

        {/* Squircle container */}
        <rect
          x="24"
          y="24"
          width="464"
          height="464"
          rx="110"
          fill="url(#logoBgGrad)"
          stroke="#8C2F39"
          strokeWidth="6"
          strokeOpacity="0.5"
        />

        {/* Play Triangle */}
        <path
          d="M200 148 C192 143 180 149 180 160 L180 320 C180 331 192 337 200 332 L332 252 C341 247 341 233 332 228 Z"
          fill="url(#logoPlayGrad1)"
        />
        <path d="M180 160 L280 240 L180 320 Z" fill="url(#logoPlayGrad2)" opacity="0.65" />

        {/* Outer Mauve Stream */}
        <path
          d="M 215 170 C 255 220, 130 250, 130 330 C 130 400, 220 420, 275 385 C 310 362, 335 320, 365 315 C 340 345, 300 420, 240 435 C 150 445, 95 380, 100 310 C 105 240, 205 200, 215 170 Z"
          fill="url(#logoMauveStream)"
        />

        {/* Powder Blush Mid Stream */}
        <path
          d="M 235 185 C 265 225, 155 260, 150 330 C 145 385, 210 405, 260 380 C 295 362, 325 318, 355 312 C 330 338, 290 395, 240 408 C 175 418, 125 375, 128 320 C 132 260, 225 215, 235 185 Z"
          fill="url(#logoBlushStream)"
        />

        {/* Cerulean Arrow Stream */}
        <path
          d="M 255 200 C 280 235, 180 270, 175 330 C 170 375, 220 390, 265 365 C 305 342, 330 300, 370 295 L 370 245 L 445 325 L 370 405 L 370 355 C 320 360, 280 395, 235 410 C 180 420, 145 380, 150 330 C 155 270, 245 228, 255 200 Z"
          fill="url(#logoCeruleanStream)"
        />
      </svg>

      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span
            style={{
              fontSize: size > 24 ? 'var(--font-size-md)' : 'var(--font-size-sm)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #FCB9B2, #ffffff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            Tube<span style={{ color: 'var(--color-accent-400)', WebkitTextFillColor: 'var(--color-accent-400)' }}>Flow</span>
          </span>
        </div>
      )}
    </div>
  );
};
