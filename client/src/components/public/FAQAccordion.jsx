import React, { useState } from 'react';
import { Plus } from 'lucide-react';

export default function FAQAccordion({ items, className = '' }) {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <div className={`divide-y divide-line border-y border-line ${className}`}>
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={i}>
            <button
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
              className="w-full flex items-center justify-between gap-4 py-4 text-left"
            >
              <span className="font-display text-base">{item.q}</span>
              <Plus className={`w-4 h-4 text-accent shrink-0 transition-transform ${open ? 'rotate-45' : ''}`} />
            </button>
            {open && (
              <p className="text-sm text-ink-soft leading-relaxed pb-4 pr-8">{item.a}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
