import React from 'react';

// Placeholder logo mark — swap for real branding when available.
export default function ApertureMark({ className = 'w-6 h-6' }) {
  return (
    <svg className={className} viewBox="0 0 26 26" fill="none">
      <circle cx="13" cy="13" r="11.5" stroke="currentColor" strokeWidth="1.2" />
      <g stroke="currentColor" strokeWidth="1.2">
        {[0, 60, 120, 180, 240, 300].map(deg => (
          <line key={deg} x1="13" y1="4" x2="13" y2="8.5" transform={`rotate(${deg} 13 13)`} />
        ))}
      </g>
    </svg>
  );
}
