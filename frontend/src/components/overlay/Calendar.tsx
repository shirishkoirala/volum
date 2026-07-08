import { useMemo, useState } from 'react';
import styles from './Calendar.module.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = [];

  for (let i = 0; i < firstDay; i++) {
    week.push(daysInPrev - firstDay + i + 1);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) {
      week.push((week[week.length - 1] ?? 0) + 1);
    }
    weeks.push(week);
  }
  return { weeks, daysInMonth };
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDate(date: Date) {
  return date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

export function Calendar() {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const { weeks } = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const isCurrentMonthView = today.getFullYear() === viewYear && today.getMonth() === viewMonth;

  return (
    <div className={styles.calendar}>
      <div className={styles.dateDisplay}>{formatDate(today)}</div>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.nav}
          onClick={prevMonth}
          aria-label="Previous month"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M6 2L4 5l2 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className={styles.headerCenter}>
          <span className={styles.monthLabel}>
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            className={`${styles.todayBtn} ${isCurrentMonthView ? '' : styles.jumpAvailable}`}
            onClick={goToday}
            aria-label="Go to today"
          >
            Today
          </button>
        </div>
        <button type="button" className={styles.nav} onClick={nextMonth} aria-label="Next month">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M4 2l2 3-2 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <div className={styles.dayHeaders}>
        {DAYS.map((d) => (
          <span key={d} className={styles.dayHeader}>
            {d}
          </span>
        ))}
      </div>
      <div className={styles.grid}>
        {weeks.map((week, wi) => (
          <div key={wi} className={styles.week}>
            {week.map((day, di) => {
              if (day === null) return <span key={di} className={styles.empty} />;
              const date = new Date(viewYear, viewMonth, day);
              const isToday = isSameDay(date, today);
              const isOther = date.getMonth() !== viewMonth;
              return (
                <button
                  key={di}
                  type="button"
                  className={`${styles.day} ${isToday ? styles.today : ''} ${isOther ? styles.other : ''}`}
                  onClick={() => {
                    if (isOther) {
                      setViewYear(date.getFullYear());
                      setViewMonth(date.getMonth());
                    }
                  }}
                  aria-label={`${date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
