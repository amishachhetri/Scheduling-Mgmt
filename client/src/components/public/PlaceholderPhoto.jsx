import React from 'react';
import ApertureMark from './ApertureMark.jsx';

// Stand-in for real portfolio photography. Deliberately looks like a placeholder
// (hatch pattern + aperture mark + label) rather than faking a photo with a gradient.
export default function PlaceholderPhoto({ aspect = 'aspect-[4/5]', iconClassName = 'w-10 h-10', label, tag, className = '' }) {
  return (
    <div className={`${aspect} border border-dashed border-line-strong rounded-md flex items-center justify-center relative overflow-hidden ${className}`}
      style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 13px, #EEE6D4 13px 14px)' }}>
      <ApertureMark className={`${iconClassName} text-ink opacity-40`} />
      {tag && (
        <span className="absolute top-3 left-3 text-[10px] uppercase tracking-wider text-ink-soft bg-paper-raised px-2 py-1 rounded-full border border-line">
          {tag}
        </span>
      )}
      {label && (
        <span className="absolute bottom-3 left-3 text-[10px] uppercase tracking-wider text-ink-faint bg-paper-raised px-2 py-1 rounded-full border border-line">
          {label}
        </span>
      )}
    </div>
  );
}
