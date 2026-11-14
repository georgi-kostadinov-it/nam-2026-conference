# Flag impossible venue hops and waitlist overlaps on My Agenda

## What this changes

On `/my-agenda` (built by #7, stacked on here), two more warnings appear
beside an attendee's sessions, read-only and non-blocking:

- Between two **consecutive confirmed** sessions at different venues, a flag
  naming both when no travel option fits the gap between them.
- Beside a **waitlist** place that overlaps another of the attendee's
  sessions on the same day, a flag naming both.

Both recompute from the store as soon as a session is removed, with no
refetch.

## Where

- `src/pages/MyAgendaPage.jsx` — after #7's per-day filtering (keep only
  sessions `useConference().reservationFor` still holds), for each day:
  - **Hop flags.** Take the day's kept sessions with `reservation ===
    'confirmed'`, sorted by `startsAt` (already the fetch order). For each
    adjacent pair `a`, `b` with `a.venue.id !== b.venue.id`, call
    `assessTravel({ travel, from: a, to: b, gapMinutes: toMinutes(b.startsAt)
    - toMinutes(a.endsAt) })` (`assessTravel`, `toMinutes` from
    `src/lib/travel.js` and `src/lib/clock.js`; `travel` from
    `useConference()`, the same source `VenuesPage.jsx` reads). Flag when the
    result is non-null and `result.impossible`.
  - **Waitlist-overlap flags.** The fetched day already carries `conflicts`
    (`{ type: 'overlap', sessionIds }`, from `agenda.js:clashesIn`, unchanged
    by this ticket). Keep only the conflicts whose both `sessionIds` are
    still in that day's kept-session set, so one clears the moment its
    session is removed.
  - Render each flag as a small inline row between the two session rows it
    names (`data-testid="agenda-flag"`, `Icon name="alert"`), the text giving
    both session titles — "No way to get from *A* to *B* in `n` minutes" for
    a hop, "Your waitlist place for *A* overlaps *B*" for an overlap. No
    flags → render nothing extra, exactly today's layout.
- No server change: `assessTravel` and `clashesIn` both already exist and are
  unmodified; this ticket only renders what they compute.
- New `tests/my-agenda-flags.spec.js` — Playwright, `visit`, `ATTENDEES.abraham`
  (id 6; used today only as a read-only fixture in `switcher.spec.js`, so safe
  to mutate), its own pinned day/time. Book the two sessions and release them
  through the API directly (`PUT`/`DELETE /api/users/:id/reservations/:id`,
  per CLAUDE.md "Writing tests against this").

## How it will be proved

| Done when | Check | Layer |
| --- | --- | --- |
| Two consecutive sessions at different venues with no travel option fitting the gap show a flag naming both | `tests/my-agenda-flags.spec.js`: book two Aurora/Foundry sessions back to back with a gap shorter than every mode's `minutes + walk`, visit `/my-agenda`, assert an `agenda-flag` row containing both titles | spec |
| A cross-venue hop with enough time for some option shows no flag | same spec: book a pair with a gap the fastest option fits, assert no `agenda-flag` between them | spec |
| A waitlist place overlapping another session shows a flag | same spec: waitlist into a full slot that overlaps a confirmed seat, assert an `agenda-flag` naming both | spec |
| Removing one session of a flagged pair clears the flag without a refresh | same spec: click Remove on one flagged session, assert the `agenda-flag` is gone with no `page.reload()` | spec |
| Adding and swapping sessions behave exactly as today | unchanged — no touched file is on that path (`seats.js`, `ConflictDialog`); not re-proved here | — |

## Decisions

- Hop adjacency is computed over **confirmed** sessions only, skipping any
  waitlisted session in between — a waitlist place does not hold a room, so
  it cannot be the thing you have to travel from or to. OK?
