import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, addWeeks, subWeeks,
  isSameMonth, isSameDay, parseISO, startOfDay
} from 'date-fns';
import { ChevronLeft, ChevronRight, Ban, Plus, CalendarIcon } from 'lucide-react';
import api from '../utils/api.js';
import Modal from '../components/Modal.jsx';
import toast from 'react-hot-toast';

const START_HOUR = 7;
const END_HOUR = 22;
const HOUR_H = 64; // px per hour

// The hour gutter shows times in whatever timezone the viewer's browser is in -- this label
// needs to match that, not a hardcoded one, or it actively misdescribes the times below it.
function currentGMTLabel() {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'shortOffset' }).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value || '';
  } catch {
    return '';
  }
}

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function formatT(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export default function Calendar() {
  const [view, setView] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [blockModal, setBlockModal] = useState(false);
  const [blockDate, setBlockDate] = useState('');
  const [blockEndDate, setBlockEndDate] = useState('');
  const [blockMultiDay, setBlockMultiDay] = useState(false);
  const [blockAllDay, setBlockAllDay] = useState(true);
  const [blockStartTime, setBlockStartTime] = useState('09:00');
  const [blockEndTime, setBlockEndTime] = useState('17:00');
  const [blockLabel, setBlockLabel] = useState('Day Off');
  const navigate = useNavigate();

  const fetchEvents = useCallback(async () => {
    let start, end;
    if (view === 'month') {
      start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      end   = format(endOfMonth(currentDate), 'yyyy-MM-dd');
    } else if (view === 'week') {
      start = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      end   = format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    } else {
      start = end = format(currentDate, 'yyyy-MM-dd');
    }
    try {
      const res = await api.get(`/calendar?start=${start}&end=${end}`);
      setEvents(res.data);
    } catch {}
  }, [currentDate, view]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const prev = () => {
    if (view === 'month') setCurrentDate(d => subMonths(d, 1));
    else if (view === 'week') setCurrentDate(d => subWeeks(d, 1));
    else setCurrentDate(d => addDays(d, -1));
  };
  const next = () => {
    if (view === 'month') setCurrentDate(d => addMonths(d, 1));
    else if (view === 'week') setCurrentDate(d => addWeeks(d, 1));
    else setCurrentDate(d => addDays(d, 1));
  };

  const title = view === 'month'
    ? format(currentDate, 'MMMM yyyy')
    : view === 'week'
    ? `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')} – ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`
    : format(currentDate, 'EEEE, MMMM d yyyy');

  const handleDayClick = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayEvents = events.filter(e => e.date === dateStr);
    if (dayEvents.length === 0) navigate(`/admin/bookings/new?date=${dateStr}`);
    else setSelected({ date, events: dayEvents });
  };

  const resetBlockForm = () => {
    setBlockDate('');
    setBlockEndDate('');
    setBlockMultiDay(false);
    setBlockAllDay(true);
    setBlockStartTime('09:00');
    setBlockEndTime('17:00');
    setBlockLabel('Day Off');
  };

  const blockDay = async () => {
    if (!blockDate) return;
    if (blockMultiDay && blockEndDate && blockEndDate < blockDate) {
      toast.error('End date must be after start date');
      return;
    }
    if (!blockAllDay && blockStartTime >= blockEndTime) {
      toast.error('End time must be after start time');
      return;
    }
    try {
      await api.post('/blocked-dates', {
        date: blockDate,
        end_date: blockMultiDay && blockEndDate ? blockEndDate : null,
        label: blockLabel,
        all_day: blockAllDay,
        start_time: blockAllDay ? null : blockStartTime,
        end_time: blockAllDay ? null : blockEndTime,
      });
      toast.success('Time blocked');
      setBlockModal(false);
      resetBlockForm();
      fetchEvents();
    } catch { toast.error('Failed'); }
  };

  const deleteBlock = async (id) => {
    try {
      await api.delete(`/blocked-dates/${id}`);
      toast.success('Block removed');
      fetchEvents();
      setSelected(null);
    } catch {
      toast.error('Failed to remove block');
    }
  };

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button onClick={prev} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base font-bold dark:text-white min-w-[180px] text-center">{title}</h2>
          <button onClick={next} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="text-xs text-sky-600 hover:underline ml-1">Today</button>
        </div>

        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 ml-auto">
          {['month', 'week', 'day'].map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${view === v ? 'bg-white dark:bg-gray-700 shadow-sm dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              {v}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={() => setBlockModal(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white">
            <Ban className="w-3.5 h-3.5" /> Block
          </button>
          <button onClick={() => navigate('/admin/bookings/new')}
            className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-xl text-sm font-medium">
            <Plus className="w-4 h-4" /> Booking
          </button>
        </div>
      </div>

      {view === 'month' && <MonthView currentDate={currentDate} events={events} onDayClick={handleDayClick} />}
      {view === 'week'  && <WeekView  currentDate={currentDate} events={events} onDayClick={handleDayClick} onEventClick={setSelected} />}
      {view === 'day'   && <DayView   currentDate={currentDate} events={events} onDayClick={handleDayClick} onEventClick={setSelected} />}


      {/* Day detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? format(selected.date, 'MMMM d, yyyy') : ''}>
        <div className="space-y-3">
          {selected?.events.map(e => (
            <div key={e.id} style={{ borderLeftColor: e.color }} className="border-l-4 pl-3 py-1.5">
              <p className="font-medium dark:text-white text-sm">{e.title}</p>
              {e.time && <p className="text-xs text-gray-500">{formatT(e.time)}{e.end_time ? ` – ${formatT(e.end_time)}` : ''}</p>}
              {e.type === 'booking' ? (
                <button onClick={() => { setSelected(null); navigate(`/admin/bookings/${e.data?.id || e.id}`); }} className="text-xs text-sky-600 hover:underline mt-1">
                  View booking →
                </button>
              ) : e.type === 'blocked' ? (
                <button onClick={() => deleteBlock(e.id)} className="text-xs text-red-500 hover:underline mt-1">Remove block</button>
              ) : null}
            </div>
          ))}
          <button onClick={() => { setSelected(null); navigate(`/admin/bookings/new?date=${format(selected.date, 'yyyy-MM-dd')}`); }}
            className="w-full py-2 bg-sky-600 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5">
            <Plus className="w-4 h-4" /> Add booking on this date
          </button>
        </div>
      </Modal>

      {/* Block modal */}
      <Modal open={blockModal} onClose={() => { setBlockModal(false); resetBlockForm(); }} title="Block Time Off">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium dark:text-gray-300">{blockMultiDay ? 'Start date' : 'Date'}</label>
              <input type="date" value={blockDate} onChange={e => setBlockDate(e.target.value)}
                className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 dark:bg-gray-700 dark:text-white" />
            </div>
            {blockMultiDay && (
              <div className="flex-1">
                <label className="text-sm font-medium dark:text-gray-300">End date</label>
                <input type="date" value={blockEndDate} onChange={e => setBlockEndDate(e.target.value)} min={blockDate || undefined}
                  className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 dark:bg-gray-700 dark:text-white" />
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm dark:text-gray-300">
            <input type="checkbox" checked={blockMultiDay} onChange={e => setBlockMultiDay(e.target.checked)} className="rounded border-gray-300" />
            Multiple days
          </label>

          <label className="flex items-center gap-2 text-sm dark:text-gray-300">
            <input type="checkbox" checked={blockAllDay} onChange={e => setBlockAllDay(e.target.checked)} className="rounded border-gray-300" />
            All day{blockMultiDay ? ' (every selected day)' : ''}
          </label>

          {!blockAllDay && (
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium dark:text-gray-300">Start time</label>
                <input type="time" value={blockStartTime} onChange={e => setBlockStartTime(e.target.value)}
                  className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 dark:bg-gray-700 dark:text-white" />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium dark:text-gray-300">End time</label>
                <input type="time" value={blockEndTime} onChange={e => setBlockEndTime(e.target.value)}
                  className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 dark:bg-gray-700 dark:text-white" />
              </div>
            </div>
          )}

          <div><label className="text-sm font-medium dark:text-gray-300">Label</label>
            <input type="text" value={blockLabel} onChange={e => setBlockLabel(e.target.value)}
              placeholder="Day Off, Vacation, Dentist appointment, etc."
              className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 dark:bg-gray-700 dark:text-white" /></div>
          <div className="flex gap-3">
            <button onClick={() => { setBlockModal(false); resetBlockForm(); }} className="flex-1 py-2 border border-gray-300 rounded-xl text-sm dark:border-gray-600 dark:text-white">Cancel</button>
            <button onClick={blockDay} className="flex-1 py-2 bg-gray-800 text-white rounded-xl text-sm font-medium">Block</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Month view ────────────────────────────────────────────────────────────────
function MonthView({ currentDate, events, onDayClick }) {
  const monthStart = startOfMonth(currentDate);
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd     = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
  const today      = startOfDay(new Date());
  const days = [];
  let d = calStart;
  while (d <= calEnd) { days.push(new Date(d)); d = addDays(d, 1); }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(dow => (
          <div key={dow} className="text-center text-xs font-semibold text-gray-400 py-2">{dow}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const ds = format(day, 'yyyy-MM-dd');
          const dayEvents = events.filter(e => e.date === ds);
          const isToday = isSameDay(day, today);
          const inMonth = isSameMonth(day, currentDate);
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;

          return (
            <button key={i} onClick={() => onDayClick(day)}
              className={`min-h-[80px] md:min-h-[96px] p-1 border-r border-b border-gray-100 dark:border-gray-700 text-left hover:bg-sky-50 dark:hover:bg-gray-700/50 transition-colors ${!inMonth ? 'opacity-30' : ''} ${isWeekend && inMonth ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''}`}>
              <span className={`inline-flex items-center justify-center w-6 h-6 text-xs rounded-full mb-1 ${isToday ? 'bg-sky-600 text-white font-bold' : 'text-gray-700 dark:text-gray-300 font-medium'}`}>
                {format(day, 'd')}
              </span>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(e => (
                  <div key={e.id} style={{ backgroundColor: e.color + '22', color: e.color, borderLeft: `3px solid ${e.color}` }}
                    className="text-xs px-1 py-0.5 rounded-r truncate font-medium leading-tight">
                    {e.time ? formatT(e.time).slice(0, 5) + ' ' : ''}{e.title.split(' — ')[0].split(' - ')[0]}
                  </div>
                ))}
                {dayEvents.length > 3 && <div className="text-xs text-gray-400 pl-1">+{dayEvents.length - 3}</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Week view ─────────────────────────────────────────────────────────────────
function WeekView({ currentDate, events, onDayClick, onEventClick }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = startOfDay(new Date());
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Day headers */}
      <div className="grid border-b border-gray-200 dark:border-gray-700" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
        <div className="text-xs text-gray-400 py-2 text-center">{currentGMTLabel()}</div>
        {days.map((day, i) => (
          <div key={i} className={`text-center py-2 border-l border-gray-100 dark:border-gray-700 ${isSameDay(day, today) ? 'bg-sky-50 dark:bg-sky-900/20' : ''}`}>
            <p className="text-xs text-gray-400 font-medium">{format(day, 'EEE')}</p>
            <span className={`inline-flex items-center justify-center w-7 h-7 text-sm font-bold rounded-full ${isSameDay(day, today) ? 'bg-sky-600 text-white' : 'dark:text-white'}`}>
              {format(day, 'd')}
            </span>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="overflow-y-auto" style={{ maxHeight: '560px' }}>
        <div className="relative" style={{ height: `${(END_HOUR - START_HOUR) * HOUR_H}px` }}>
          {/* Hour lines + labels */}
          {hours.map(h => (
            <div key={h} className="absolute w-full flex" style={{ top: `${(h - START_HOUR) * HOUR_H}px` }}>
              <div className="w-12 text-right pr-2 text-xs text-gray-400 -mt-2 shrink-0">
                {h === 12 ? '12pm' : h > 12 ? `${h-12}pm` : `${h}am`}
              </div>
              <div className="flex-1 border-t border-gray-100 dark:border-gray-700/50" />
            </div>
          ))}

          {/* Day columns + events */}
          <div className="absolute inset-0 ml-12 grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {days.map((day, di) => {
              const ds = format(day, 'yyyy-MM-dd');
              const dayEvents = events.filter(e => e.date === ds && e.time);
              return (
                <div key={di}
                  onClick={() => onDayClick(day)}
                  className={`relative border-l border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-sky-50/40 dark:hover:bg-sky-900/10 transition-colors ${isSameDay(day, today) ? 'bg-sky-50/30 dark:bg-sky-900/10' : ''}`}>
                  {dayEvents.map((e, ei) => {
                    const startMin = timeToMinutes(e.time);
                    const endMin   = e.end_time ? timeToMinutes(e.end_time) : startMin + 60;
                    const topPx    = ((startMin / 60) - START_HOUR) * HOUR_H;
                    const heightPx = Math.max(((endMin - startMin) / 60) * HOUR_H, 28);
                    return (
                      <button key={ei}
                        onClick={ev => { ev.stopPropagation(); onEventClick({ date: day, events: [e] }); }}
                        className="absolute left-0.5 right-0.5 rounded text-left overflow-hidden group hover:z-10"
                        style={{ top: `${topPx}px`, height: `${heightPx}px`, backgroundColor: e.color + '25', borderLeft: `3px solid ${e.color}`, zIndex: 1 }}>
                        <div className="px-1 pt-0.5">
                          <p className="text-xs font-semibold leading-tight truncate" style={{ color: e.color }}>
                            {formatT(e.time)}
                          </p>
                          <p className="text-xs leading-tight truncate dark:text-gray-200" style={{ color: e.color }}>
                            {e.title.split(' — ')[0].split(' - ')[0]}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                  {/* All-day / no-time events */}
                  {events.filter(e => e.date === ds && !e.time).map((e, ei) => (
                    <div key={'nd-'+ei}
                      style={{ backgroundColor: e.color + '22', color: e.color, top: `${ei * 20 + 4}px` }}
                      className="absolute left-0.5 right-0.5 text-xs font-medium px-1 py-0.5 rounded truncate">
                      {e.title.split(' — ')[0].split(' - ')[0]}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Day view ──────────────────────────────────────────────────────────────────
function DayView({ currentDate, events, onDayClick, onEventClick }) {
  const ds = format(currentDate, 'yyyy-MM-dd');
  const dayEvents = events.filter(e => e.date === ds);
  const timedEvents = dayEvents.filter(e => e.time);
  const allDayEvents = dayEvents.filter(e => !e.time);
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const today = isSameDay(currentDate, new Date());

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className={`p-3 border-b border-gray-100 dark:border-gray-700 ${today ? 'bg-sky-50 dark:bg-sky-900/20' : ''}`}>
        <p className={`text-base font-bold ${today ? 'text-sky-700 dark:text-sky-300' : 'dark:text-white'}`}>
          {format(currentDate, 'EEEE, MMMM d')}
          {today && <span className="ml-2 text-xs bg-sky-600 text-white px-2 py-0.5 rounded-full font-medium">Today</span>}
        </p>
        {allDayEvents.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {allDayEvents.map(e => (
              <div key={e.id} style={{ backgroundColor: e.color + '22', color: e.color }}
                className="text-xs font-medium px-2 py-0.5 rounded-full">{e.title}</div>
            ))}
          </div>
        )}
      </div>

      {/* Time grid */}
      <div className="overflow-y-auto" style={{ maxHeight: '600px' }}>
        <div className="relative" style={{ height: `${(END_HOUR - START_HOUR) * HOUR_H}px` }}>
          {hours.map(h => (
            <div key={h} className="absolute w-full flex" style={{ top: `${(h - START_HOUR) * HOUR_H}px` }}>
              <div className="w-14 text-right pr-3 text-xs text-gray-400 -mt-2 shrink-0">
                {h === 12 ? '12 PM' : h > 12 ? `${h-12} PM` : `${h} AM`}
              </div>
              <div className="flex-1 border-t border-gray-100 dark:border-gray-700/50" />
            </div>
          ))}

          {/* Events column */}
          <div className="absolute inset-0 ml-14 mr-2">
            {timedEvents.map((e, i) => {
              const startMin = timeToMinutes(e.time);
              const endMin   = e.end_time ? timeToMinutes(e.end_time) : startMin + 90;
              const topPx    = ((startMin / 60) - START_HOUR) * HOUR_H;
              const heightPx = Math.max(((endMin - startMin) / 60) * HOUR_H, 40);
              return (
                <button key={i}
                  onClick={() => onEventClick({ date: currentDate, events: [e] })}
                  className="absolute left-0 right-0 rounded-xl text-left overflow-hidden hover:brightness-95 transition-all"
                  style={{ top: `${topPx}px`, height: `${heightPx}px`, backgroundColor: e.color + '20', borderLeft: `4px solid ${e.color}` }}>
                  <div className="p-2">
                    <p className="text-sm font-semibold" style={{ color: e.color }}>
                      {formatT(e.time)}{e.end_time ? ` – ${formatT(e.end_time)}` : ''}
                    </p>
                    <p className="text-sm font-medium dark:text-white truncate">{e.title}</p>
                  </div>
                </button>
              );
            })}

            {timedEvents.length === 0 && (
              <button onClick={() => onDayClick(currentDate)}
                className="absolute inset-0 flex items-center justify-center text-gray-300 hover:text-gray-400 transition-colors">
                <span className="text-sm">Click to add booking</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
