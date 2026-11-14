# Show my sessions day by day on My Agenda, with Remove

## What this changes

`/my-agenda` stops saying "Coming soon" and instead lists the attendee's own
sessions, one block per day that has any, in time order within each day. Each
row shows its time, room, venue, and whether it is a confirmed seat or a
waitlist place, with a Remove action that gives the seat (or waitlist place)
back at once, no refresh. Each day shows its booked hours (confirmed seats
only) with waitlisted time called out separately. An attendee with no
reservations at all sees the existing "Browse the schedule" link instead of a
day list.

## Where

- `src/pages/MyAgendaPage.jsx` — replace the "Coming soon" panel. Fetch with
  `useFetch(() => api.getSchedule(currentUserId), [currentUserId])`
  (`useFetch` is exported from `src/lib/store.jsx`, already used by other
  pages in `src/pages/`). The fetched
  `days` are the shape and never the source of truth for *whether* a session is
  still booked (CLAUDE.md § There is exactly one action; `agenda.md` §
  "Building on it"): for each day, filter `day.sessions` through
  `useConference().reservationFor(s.id)` and drop any session the store no
  longer has a reservation for, so Remove takes it off the page without a
  refetch. Recompute `totalMinutes` (confirmed only) and `waitlistedMinutes`
  (queued) client-side from that filtered list — do not reuse the fetched
  day's totals once a row has been removed. Drop a day entirely once it has no
  sessions left. Render each kept session with `<SessionCard session={s}
  variant="row" attendance={{ ended: hasEnded(s, clock), checkedIn: s.checkedIn,
  myStars: s.myStars }} />` (`hasEnded` from `src/lib/clock.js`) — Remove is
  `toggleSeat(s.id, s)` via the card's own `SeatButton`, already wired for a
  held reservation (`src/lib/store.jsx:toggleSeat` releases when one exists).
  No sessions anywhere → keep today's `agenda-coming-soon` panel and its
  "Browse the schedule" button (`tests/home.spec.js` depends on the testid).
- `src/lib/format.js` — add a small `hours(minutes)` helper (`"3.5h"`, no
  trailing zero for whole hours) for the per-day total and the `+Nh waitlisted`
  note; pass it as `Stat`'s `note` (`src/components/ui.jsx:Stat`) when a day has
  any `waitlistedMinutes`.
- `tests/home.spec.js` — the `'My Agenda is a blank canvas'` describe still
  passes for an attendee with zero reservations, so it stays as-is; it is
  **not** removed by this change (it asserts the no-reservations state, which
  still shows `agenda-coming-soon`).
- New `tests/my-agenda.spec.js` — Playwright, using `visit`, `ATTENDEES`,
  `momentOn`/`conferenceDays` from `tests/helpers.js`. Use `ATTENDEES.sofia`
  (id 4, "biggest plan" — not used as the seat-mutating subject by any other
  spec) pinned to a day/time of its own so this test does not race another
  spec's seat count. Reserve and release through the API directly
  (`PUT`/`DELETE /api/users/:id/reservations/:sessionId` — the same calls
  `api.reserveSeat`/`releaseSeat` make) inside the test to set up state for
  sessions this test does not click Remove on, and release whatever it books
  and does not remove through the UI, per CLAUDE.md "Writing tests against
  this" (own attendee and day, release what you book).
- `tests/api/agenda.test.js` is untouched — `scheduleFor`'s payload already
  has everything the page needs (confirmed/total/day grouping all exist on
  main); this ticket is UI only.

## How it will be proved

| Done when | Check | Layer |
| --- | --- | --- |
| `/my-agenda` lists sessions under each day with any, in time order, days with none left out | `tests/my-agenda.spec.js`: book two sessions on two different days for a fresh attendee, visit `/my-agenda`, assert both day headings appear in day order and a third, unbooked day of that attendee's plan does not | spec |
| Each row shows time, room, venue, and confirmed/waitlist status | same spec: assert the row for a waitlisted booking shows "Waitlisted" and a room name; `SessionCard` row already renders time/room — this proves the page passes a real session through, not a stub | spec |
| Remove drops the session at once, without a refresh, and frees the seat | same spec: click Remove on a confirmed row, assert the row disappears without a `page.reload()`, then `GET` the session and assert `seatsTaken` dropped by one | spec |
| Booked hours per day count confirmed seats only; waitlisted time shown apart | `tests/my-agenda.spec.js` (or a unit test on `format.js:hours` plus a component-level read of the rendered `Stat` note) — book one confirmed and one waitlisted session on the same day, assert the hour total reflects only the confirmed one and a `"+Nh waitlisted"` note is present | spec (totals already correct server-side per `tests/api/agenda.test.js`; this proves the page keeps them apart rather than summing) |
| No-reservations attendee sees a way to the schedule, not an empty page | `tests/home.spec.js`'s existing "My Agenda is a blank canvas" test, unchanged, passing against the new page | spec |

## Decisions

- Reuse `SessionCard`'s `variant="row"` exactly as it renders today — it shows
  the venue only when the session is off the primary site, the same rule used
  everywhere else sessions are listed — rather than always naming the venue on
  My Agenda specifically. Consistent with every other session list in the app — OK?
