import {
  BatteryCharging, Microwave, XCircle,
  type LucideProps,
} from 'lucide-react';
import type { ComponentType } from 'react';

const iconMap: Record<string, ComponentType<LucideProps>> = {
  BatteryCharging,
  Microwave,
  XCircle,
};

export function OptionIcon({
  name,
  size = 40,
  className,
  color,
}: {
  name: string;
  size?: number;
  className?: string;
  color?: string;
}) {
  const Icon = iconMap[name];
  if (Icon) return <Icon size={size} className={className} color={color} />;
  return <span style={{ fontSize: size * 0.75, lineHeight: 1 }}>{name}</span>;
}
