import React, { useEffect, useId, useRef } from 'react';

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  const containerRef = useRef(null);
  const previouslyFocused = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      previouslyFocused.current = document.activeElement;
      // Deferred a tick so the modal's own content has mounted before we move focus into it.
      const t = setTimeout(() => containerRef.current?.focus(), 0);
      return () => {
        clearTimeout(t);
        document.body.style.overflow = '';
        if (previouslyFocused.current && document.contains(previouslyFocused.current)) {
          previouslyFocused.current.focus();
        }
      };
    }
    document.body.style.overflow = '';
  }, [open]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'Tab') {
      // Simple focus trap: cycle Tab/Shift+Tab within the modal instead of letting it escape to
      // the (hidden-behind-overlay, but still in the DOM) page underneath.
      const focusable = containerRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const list = Array.from(focusable);
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  if (!open) return null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/50"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] overflow-y-auto outline-none`}
      >
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 id={titleId} className="text-lg font-semibold dark:text-white">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">✕</button>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
