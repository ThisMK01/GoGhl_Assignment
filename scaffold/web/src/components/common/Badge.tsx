import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'tertiary' | 'error';
  className?: string;
}

const VARIANT_CLASSES: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-surface-container text-on-surface-variant border-outline-variant/30',
  primary: 'bg-primary/15 text-primary border-primary/30',
  secondary: 'bg-secondary/15 text-secondary border-secondary/30',
  tertiary: 'bg-tertiary-container/20 text-tertiary border-tertiary/30',
  error: 'bg-error-container text-on-error-container border-error/30',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[11px] font-medium border ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
