import type { ReactNode } from 'react';

type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'accent';

const toneClasses: Record<BadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-rose-50 text-rose-800 border-rose-200',
  neutral: 'bg-stone-100 text-stone-700 border-stone-200',
  info: 'bg-zinc-100 text-zinc-900 border-zinc-300',
  accent: 'bg-rose-50 text-rose-700 border-rose-200',
};

interface BadgeProps {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', className = '', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

type CardVariant = 'default' | 'subtle' | 'dark' | 'featured';

const cardVariantClasses: Record<CardVariant, string> = {
  default: 'border-stone-200 bg-white text-zinc-950 shadow-2xs',
  subtle: 'border-stone-200/80 bg-stone-50 text-zinc-950',
  dark: 'border-zinc-800 bg-zinc-950 text-white',
  featured: 'border-zinc-900 bg-zinc-950 text-white shadow-xl ring-1 ring-zinc-900',
};

interface CardProps {
  variant?: CardVariant;
  className?: string;
  children: ReactNode;
}

export function Card({ variant = 'default', className = '', children }: CardProps) {
  return (
    <div className={`rounded-2xl border ${cardVariantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
}
