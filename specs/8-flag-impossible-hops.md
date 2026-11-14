# Flag impossible venue hops and waitlist overlaps on My Agenda

## What this changes

On My Agenda, two kinds of conflict the app already knows about but never
shows now get a warning flag next to the sessions concerned: a cross-venue
hop between two consecutive sessions that no travel option can make in the
gap between them, and a waitlist place that overlaps another of the
attendee's sessions. Neither blocks anything — adding and swapping sessions
behave exactly as today, including the 409/`ConflictDialog` for two
confirmed seats that overlap.

## Where

- `src/pages/MyAgendaPage.jsx` — the `days` `useMemo`: after `sessions` is
  filtered and sorted by `startsAt` (as today), compute two flag lists per
  day:
  - **Waitlist overlap** — re-derive `clashesIn`-style pairs client-side from
    the surviving `sessions` (the server's `conflicts` on `data.days[n]` is
    the pre-removal shape, so it is not reused directly, same as
    `totalMinutes`/`waitlistedMinutes` today): for each pair of sessions on
    the day whose `[startsAt, endsAt)` ranges overlap, where at least one has
    `reservation === 'waitlisted'`, flag both.
  - **Impossible hop** — walk consecutive sessions in the sorted list (`i`,
    `i+1`); where `sessions[i].venue.id !== sessions[i+1].venue.id`, call
    `travel.js:assessTravel({ travel, from: sessions[i], to: sessions[i+1],
    gapMinutes })` with `gapMinutes` the minutes between `sessions[i].endsAt`
    and `sessions[i+1].startsAt` (`toMinutes` from `lib/clock.js`, already
    imported). `travel` comes from `useConference()` (`VenuesPage.jsx`
    already reads it the same way). Flag both sessions when the result is
    non-null and `impossible` is true.
  - Render each flag as a small amber banner (same amber used for the
    waitlisted note on `Stat` and for `SeatButton`'s waitlisted state —
    `ui.md`), one per flagged pair, placed between the day's session list
    and naming both sessions (title, or a short label built from them) with
    an `Icon` (`alert` or `clock`, whichever `Icon.jsx` already has — check
    before adding one). `data-testid="agenda-flag"` on each banner, one per
    pair, so a day with two independent flags renders two banners.
  - Because this reads from the already-recomputed `sessions` array (which
    drops a removed session via `reservationFor`), a flag disappears as soon
    as `useMemo` reruns — no new state, no refetch.
- Test in `tests/my-agenda.spec.js`, extending the existing `test.describe`
  with a new `test(...)`, using `visit`, `ATTENDEES`, `conferenceDays` from
  `tests/helpers.js` and a lane/attendee not used by the existing test in
  that file or by `tests/seats.spec.js` (`tests/helpers.js` lists which
  attendee+day pairs are already claimed). Also extend
  `tests/unit/travel.test.js` only if `assessTravel` itself needs a new case
  (it should not — this ticket is a caller, not a change to `assessTravel`).

## How it will be proved

| Done when | Check | Layer |
| --- | --- | --- |
| Two consecutive sessions at different venues with no travel option fitting the gap show a flag naming both sessions | seed or booked fixture with a short cross-venue gap; `agenda-flag` banner visible, mentions both titles | spec (`my-agenda.spec.js`) |
| A cross-venue hop with enough time for some travel option shows no flag | same fixture shape with a long gap; no `agenda-flag` for that pair | spec (`my-agenda.spec.js`) |
| A waitlist place overlapping another session shows a flag | attendee with a waitlisted session overlapping a confirmed/waitlisted one (seed already creates these — reuse the existing `mixedDay` fixture in `my-agenda.spec.js` if its times overlap, else book a second one in the test) | spec (`my-agenda.spec.js`) |
| Removing one session of a flagged pair clears the flag without a refresh | Remove one of the two flagged sessions; `agenda-flag` for that pair gone, no reload | spec (`my-agenda.spec.js`) |
| Adding and swapping sessions on the schedule behave exactly as today | existing seat/swap specs (`tests/seats.spec.js`) untouched and still green | unit/API (unchanged, re-run by `npm test`) |

## Decisions

- The ticket does not say how to word or style the flag beyond "naming both
  sessions" — treat it as a presentational detail for the builder (amber
  banner, matching the existing waitlisted-note colour) rather than a
  decision needing sign-off here. Flag if the reviewer wants different
  wording or placement.

## Out of scope

- Any change to `travel.js:assessTravel`, `server/lib/agenda.js:clashesIn`,
  or the seat/overlap rules in `seats.js` — both are read-only inputs here.
- Surfacing either flag anywhere but My Agenda (e.g. the schedule grid or a
  session's own page).
