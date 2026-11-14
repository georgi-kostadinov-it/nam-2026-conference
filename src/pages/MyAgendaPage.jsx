import { useMemo } from 'react';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';
import { Button, SectionHeader, Stat, ErrorState, Skeleton } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { SessionCard } from '../components/SessionCard.jsx';
import { useConference, useFetch } from '../lib/store.jsx';
import * as api from '../lib/api.js';
import { hasEnded } from '../lib/clock.js';
import { dayLabel, hours } from '../lib/format.js';

/**
 * Lists the attendee's own sessions, grouped by day. The fetched payload is
 * only ever the starting shape: the store's reservations are the source of
 * truth for *whether* a session is still booked (CLAUDE.md § There is
 * exactly one action; `agenda.md` § Building on it), so every day is
 * re-filtered through `reservationFor` and its totals recomputed from what
 * survives — that is what lets Remove take a row off the page without a
 * refetch, and a day with nothing left disappears with it.
 */
export function MyAgendaPage() {
  useDocumentTitle('My Agenda');
  const { currentUserId, reservationFor, clock } = useConference();
  const { data, loading, error, reload } = useFetch(() => api.getSchedule(currentUserId), [currentUserId]);

  const days = useMemo(() => {
    if (!data) return [];
    return data.days
      .map((day) => {
        const sessions = day.sessions
          .filter((s) => reservationFor(s.id))
          .map((s) => ({ ...s, reservation: reservationFor(s.id) }))
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
        const totalMinutes = sessions
          .filter((s) => s.reservation === 'confirmed')
          .reduce((sum, s) => sum + s.durationMins, 0);
        const waitlistedMinutes = sessions
          .filter((s) => s.reservation === 'waitlisted')
          .reduce((sum, s) => sum + s.durationMins, 0);
        return { date: day.date, sessions, totalMinutes, waitlistedMinutes };
      })
      .filter((day) => day.sessions.length > 0);
  }, [data, reservationFor]);

  if (loading && !data) {
    return (
      <div className="space-y-8">
        <SectionHeader eyebrow="Your conference" title="My Agenda" />
        <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <SectionHeader eyebrow="Your conference" title="My Agenda" />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Your conference" title="My Agenda" />

      {days.length === 0 ? (
        <section
          className="grid place-items-center rounded-2xl border border-dashed border-hairline bg-surface px-6 py-20 text-center"
          data-testid="agenda-coming-soon"
        >
          <span className="grid size-12 place-items-center rounded-xl bg-violet-500/12 text-violet-300">
            <Icon name="ticket" className="size-5" />
          </span>
          <h2 className="mt-4 font-display text-2xl">Coming soon</h2>
          <p className="mt-2 max-w-sm text-sm text-muted">
            Nothing booked yet. Find a session and take a seat — this page will fill in from there.
          </p>
          <Button to="/schedule" size="sm" className="mt-6">Browse the schedule</Button>
        </section>
      ) : (
        <div className="space-y-10">
          {days.map((day) => (
            <section key={day.date} data-testid={`agenda-day-${day.date}`} className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="font-display text-xl">{dayLabel(day.date)}</h2>
                <Stat
                  value={hours(day.totalMinutes)}
                  label="booked"
                  testId="agenda-hours"
                  note={day.waitlistedMinutes > 0 ? `+${hours(day.waitlistedMinutes)} waitlisted` : null}
                />
              </div>
              <div className="space-y-2">
                {day.sessions.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    variant="row"
                    attendance={{ ended: hasEnded(s, clock), checkedIn: s.checkedIn, myStars: s.myStars }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
