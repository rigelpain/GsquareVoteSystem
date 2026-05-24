// ─── トゲトゲ型トークン（反対→変形してハートに） ────
import { motion } from 'framer-motion';

interface SpikyTokenProps {
  color?: string;
  size?: number;
  className?: string;
  // 0=トゲトゲ, 1=ハート へのモーフィング進捗
  morphProgress?: number;
}

// トゲトゲ(星形8角)のパス
const SPIKY_PATH =
  'M50 5 L55 38 L85 20 L65 48 L95 55 L63 58 L75 90 L50 68 L25 90 L37 58 L5 55 L35 48 L15 20 L45 38 Z';

// ハートのパス（100x100座標）
const HEART_PATH =
  'M50 85 C50 85 15 62 15 38 C15 25 25 17 37 17 C43 17 48 20 50 24 C52 20 57 17 63 17 C75 17 85 25 85 38 C85 62 50 85 50 85Z';

export default function SpikyToken({
  color = '#ff4d4d',
  size = 40,
  className = '',
}: SpikyTokenProps) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={{ filter: `drop-shadow(0 0 8px ${color}88)` }}
    >
      <path d={SPIKY_PATH} fill={color} />
    </motion.svg>
  );
}

// モーフィングアニメーション版（アニメーションページ用）
export function MorphingToken({
  color = '#ff4d4d',
  targetColor = '#ff4d7d',
  size = 50,
  onMorphComplete,
}: {
  color?: string;
  targetColor?: string;
  size?: number;
  onMorphComplete?: () => void;
}) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ filter: `drop-shadow(0 0 10px ${color}88)` }}
    >
      <motion.path
        initial={{ d: SPIKY_PATH, fill: color }}
        animate={{ d: HEART_PATH, fill: targetColor }}
        transition={{
          d: { duration: 0.8, ease: 'easeInOut', delay: 0.5 },
          fill: { duration: 0.8, ease: 'easeInOut', delay: 0.5 },
        }}
        onAnimationComplete={onMorphComplete}
      />
    </motion.svg>
  );
}
