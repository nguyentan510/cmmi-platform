import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Content } from '../../services/api';
import { Badge } from '../../components/Shared';

export default function Calendar({
  items,
  onSelect,
}: {
  items: Content[];
  onSelect: (content: Content) => void;
}) {
  const [month, setMonth] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  });
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  const key = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  return (
    <div className="calendar">
      <div className="calendar__header">
        <h3>{month.toLocaleDateString('en', { month: 'long', year: 'numeric' })}</h3>
        <div>
          <button
            aria-label="Previous month"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            aria-label="Next month"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="calendar__grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <strong key={day}>{day}</strong>
        ))}
        {Array.from({ length: 42 }, (_, i) => {
          const day = new Date(start);
          day.setDate(start.getDate() + i);
          return (
            <div
              className={`calendar__day ${day.getMonth() !== month.getMonth() ? 'calendar__day--muted' : ''}`}
              key={i}
            >
              <span>{day.getDate()}</span>
              {items
                .filter(
                  (item) => item.scheduled_at && key(new Date(item.scheduled_at)) === key(day),
                )
                .map((item) => (
                  <button key={item.id} onClick={() => onSelect(item)}>
                    <Badge status={item.status} />
                    <span>{item.title}</span>
                  </button>
                ))}
            </div>
          );
        })}
      </div>
      <p className="caption">
        Calendar shows scheduled dates for the current filtered page. Use pagination to browse
        additional items.
      </p>
    </div>
  );
}
