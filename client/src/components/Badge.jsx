import React from 'react';
import { STAGE_COLORS, statusColor } from '../utils/helpers.js';

export function StageBadge({ stage }) {
  const cls = STAGE_COLORS[stage] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {stage}
    </span>
  );
}

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(status)}`}>
      {status}
    </span>
  );
}
