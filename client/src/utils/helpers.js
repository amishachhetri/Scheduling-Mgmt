export const SHOOT_TYPES = [
  'Wedding (1 day)',
  'Wedding (multi-day)',
  'Maternity',
  'Baby',
  'Pre-wedding',
  'Post-wedding',
  'Engagement',
  'Proposal',
  'Birthday',
  'Other'
];

// The statuses settable from the status popovers on Bookings/BookingDetail (as plain picks) --
// 'Cancelled' is deliberately excluded here since it always routes through the dedicated cancel
// flow (captures a note + deposit decision), never a plain status set. 'Requested'/'Denied' are
// request-inbox-only states, never manually chosen here.
export const BOOKING_STATUSES = ['Upcoming', 'Tentative', 'Past', 'Completed'];

export const WORKFLOW_STAGES = [
  'Shoot scheduled',
  'Deposit received',
  'Shoot completed',
  'Sent to client for selection',
  'Editing in progress',
  'Editing complete',
  'Final products delivered',
  'Project closed'
];

export const STAGE_COLORS = {
  'Shoot scheduled':            'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  'Deposit received':           'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  'Shoot completed':            'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  'Sent to client for selection': 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  'Editing in progress':        'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  'Editing complete':           'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  'Final products delivered':   'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  'Project closed':             'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
};

export const STAGE_DOT_COLORS = {
  'Shoot scheduled':            '#3b82f6',
  'Deposit received':           '#14b8a6',
  'Shoot completed':            '#8b5cf6',
  'Sent to client for selection': '#f97316',
  'Editing in progress':        '#f59e0b',
  'Editing complete':           '#eab308',
  'Final products delivered':   '#22c55e',
  'Project closed':             '#6b7280'
};

// Deposit tier for a package: full-day packages (weddings) require the larger deposit,
// everything else (timed sessions) uses the smaller one.
export const SMALL_SHOOT_DEPOSIT = 100;
export const BIG_SHOOT_DEPOSIT = 1000;
export function defaultDepositForPackage(pkg) {
  return pkg?.is_full_day ? BIG_SHOOT_DEPOSIT : SMALL_SHOOT_DEPOSIT;
}

export const ASSISTANT_ROLES = [
  'Assistant Videographer',
  'Assistant Photographer',
  'Editor'
];

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return new Date(+y, +m - 1, +d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

// "Full Day" requests are stored as a fixed 08:00-20:00 window so scheduling math
// (conflict checks, calendars) still has real times to work with.
export const FULL_DAY_START = '08:00';
export const FULL_DAY_END = '20:00';

export function formatTimeRange(startTime, endTime) {
  if (startTime === FULL_DAY_START && endTime === FULL_DAY_END) return 'Full Day';
  if (!startTime) return '';
  return endTime ? `${formatTime(startTime)} – ${formatTime(endTime)}` : formatTime(startTime);
}

export function displayShootType(booking) {
  if (booking.shoot_type === 'Other' && booking.shoot_type_detail) {
    return `Other: ${booking.shoot_type_detail}`;
  }
  return booking.shoot_type || '';
}

export function daysAgo(dateStr) {
  if (!dateStr) return null;
  // Parsed as local midnight (not bare UTC-midnight ISO parsing) to match daysUntil below --
  // otherwise the two disagreed by a day for anyone west of UTC.
  const diff = Date.now() - new Date(dateStr + 'T00:00:00').getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr + 'T00:00:00');
  const diff = date.getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export function statusColor(status) {
  if (status === 'Completed' || status === 'Past') return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
  if (status === 'Cancelled') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  if (status === 'Tentative') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
}
