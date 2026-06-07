// ─── 浮遊パーティクル背景 ────────────────────────────
import { useMemo } from 'react';

interface Particle {
  id: number;
  left: string;
  size: number;
  duration: number;
  delay: number;
  color: string;
  shape: 'circle' | 'star' | 'heart';
}

interface BackgroundParticlesProps {
  colorA: string;
  colorB: string;
  count?: number;
  position?: 'fixed' | 'absolute';
}

export default function BackgroundParticles({
  colorA,
  colorB,
  count = 12,
  position = 'fixed',
}: BackgroundParticlesProps) {
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: 8 + Math.random() * 16,
      duration: 6 + Math.random() * 10,
      delay: Math.random() * 8,
      color: i % 2 === 0 ? colorA : colorB,
      shape: (['circle', 'star', 'heart'] as const)[i % 3],
    }));
  }, [colorA, colorB, count]);

  return (
    <div className={`${position} inset-0 pointer-events-none overflow-hidden z-0`}>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: p.left,
            width: p.size,
            height: p.size,
            animation: `float-particle ${p.duration}s ${p.delay}s linear infinite`,
            opacity: 0,
          }}
        >
          {p.shape === 'circle' && (
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: p.color,
                opacity: 0.5,
              }}
            />
          )}
          {p.shape === 'star' && (
            <svg viewBox="0 0 100 100" width={p.size} height={p.size}>
              <path
                d="M50 5 L61 35 L95 35 L68 57 L79 91 L50 70 L21 91 L32 57 L5 35 L39 35Z"
                fill={p.color}
                opacity="0.5"
              />
            </svg>
          )}
          {p.shape === 'heart' && (
            <svg viewBox="0 0 100 100" width={p.size} height={p.size}>
              <path
                d="M50 80 C50 80 18 58 18 36 C18 24 27 17 38 17 C43 17 48 20 50 24 C52 20 57 17 62 17 C73 17 82 24 82 36 C82 58 50 80 50 80Z"
                fill={p.color}
                opacity="0.5"
              />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}
