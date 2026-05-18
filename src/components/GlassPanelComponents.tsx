import { ReactNode } from 'react';
import { Shield, CheckCircle } from 'lucide-react';

const BRAND = { teal: '#1C7486', black: '#0A0A0A', gold: '#D4A843', white: '#FFFFFF' };

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'teal' | 'gold';
  hover?: boolean;
}

export function GlassCard({ children, className = '', variant = 'default', hover = true }: GlassCardProps) {
  const variantClass = variant === 'teal' ? 'glass-teal' : variant === 'gold' ? 'glass-gold' : 'glass';
  const hoverClass = hover ? 'hover:border-white/20 transition-all duration-300' : '';
  return (
    <div className={`${variantClass} rounded-2xl ${hoverClass} ${className}`}>
      {children}
    </div>
  );
}

interface StatCardProps {
  value: string | number;
  label: string;
  sublabel?: string;
  accent?: 'teal' | 'gold';
}

export function StatCard({ value, label, sublabel, accent = 'gold' }: StatCardProps) {
  const color = accent === 'gold' ? BRAND.gold : BRAND.teal;
  return (
    <div className="text-center p-6">
      <div className="text-3xl sm:text-4xl font-bold mb-1" style={{ color }}>{value}</div>
      <div className="text-white/70 text-sm font-medium">{label}</div>
      {sublabel && <div className="text-white/40 text-xs mt-0.5">{sublabel}</div>}
    </div>
  );
}

interface PillarCardProps {
  letter: string;
  name: string;
  description: string;
  color?: string;
  isOpen?: boolean;
  onClick?: () => void;
}

export function PillarCard({ letter, name, description, color = BRAND.teal, isOpen = false, onClick }: PillarCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left card-premium p-5 cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{ backgroundColor: color }}
          >
            {letter}
          </div>
          <span className="font-semibold text-white text-base">{name}</span>
        </div>
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {isOpen && (
        <div className="mt-4 pt-4 border-t border-white/8">
          <p className="text-white/60 text-sm leading-relaxed">{description}</p>
        </div>
      )}
    </button>
  );
}

interface FunderReadyBadgeProps {
  size?: 'sm' | 'md' | 'lg';
}

export function FunderReadyBadge({ size = 'md' }: FunderReadyBadgeProps) {
  const sizes = {
    sm: 'text-xs px-2.5 py-1 gap-1',
    md: 'text-xs px-3 py-1.5 gap-1.5',
    lg: 'text-sm px-4 py-2 gap-2',
  };
  const iconSizes = { sm: 12, md: 14, lg: 16 };
  return (
    <span className={`badge-funder-ready ${sizes[size]}`}>
      <Shield size={iconSizes[size]} />
      Funder Ready Verified
    </span>
  );
}

interface ScoreRingProps {
  score: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
}

export function ScoreRing({ score, max, size = 120, strokeWidth = 8, color = BRAND.teal, label }: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(score / max, 1);
  const offset = circumference * (1 - pct);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-bold text-white leading-none" style={{ fontSize: size * 0.22 }}>{score}</span>
        {label && <span className="text-white/50 leading-none mt-0.5" style={{ fontSize: size * 0.1 }}>{label}</span>}
      </div>
    </div>
  );
}

interface DashboardCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  accentColor?: string;
}

export function DashboardCard({ label, value, icon, trend, accentColor = BRAND.teal }: DashboardCardProps) {
  return (
    <div className="card-premium p-5">
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: accentColor + '20' }}
        >
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
        {trend && (
          <span className="text-xs font-medium flex items-center gap-1" style={{ color: BRAND.teal }}>
            <CheckCircle size={11} />
            {trend}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-white/50 text-sm">{label}</div>
    </div>
  );
}
