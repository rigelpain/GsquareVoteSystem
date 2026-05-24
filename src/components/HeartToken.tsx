// ─── ハート型トークン（賛成） ─────────────────────────
import { motion } from 'framer-motion';

interface HeartTokenProps {
  color?: string;
  size?: number;
  className?: string;
}

export default function HeartToken({
  color = '#ff4d7d',
  size = 40,
  className = '',
}: HeartTokenProps) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={{ filter: `drop-shadow(0 0 8px ${color}88)` }}
    >
      <path
        d="M50 85 C50 85 15 62 15 38 C15 25 25 17 37 17 C43 17 48 20 50 24 C52 20 57 17 63 17 C75 17 85 25 85 38 C85 62 50 85 50 85Z"
        fill={color}
      />
      {/* ハイライト */}
      <ellipse cx="38" cy="32" rx="7" ry="5" fill="white" opacity="0.35" transform="rotate(-20 38 32)" />
    </motion.svg>
  );
}
