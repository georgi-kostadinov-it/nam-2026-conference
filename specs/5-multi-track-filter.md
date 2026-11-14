# Select several tracks at once on the schedule

## What this changes

On `/schedule`, the track pills in the filter rail become toggles: clicking a
second track adds it rather than replacing the first, so an attendee sees the
sessions of every track they have picked at once. **All tracks** still clears
every selection, and clicking off the last selected track also returns to it.
One track behaves exactly as today — same URL (`?track=<slug>`), same API
call, same result.

## Where

- `server/routes/sessions.js` — `GET /` handler: `trackSlug` currently does
  `where.push('t.slug = ?')`. Split it on `,` and push `t.slug IN (?, …)` with
  one `?` per slug (works unchanged for a single slug — `IN (?)` ≡ `= ?`).
  Test in `tests/api/endpoints.test.js` (existing single-track assertions must
  still pass as-is; no lane needed, it's a read).
- `src/pages/SchedulePage.jsx` — the track rail (around the `Track` `<h3>`
  block). Read the URL's `track` param as a comma-separated list
  (`selectedTracks`), replace the single `onClick={() => set('track', ...)}`
  per pill with a `toggleTrack(slug)` that adds/removes the slug from that
  list and writes it back comma-joined (or deletes the param when empty), and
  add `aria-pressed={selectedTracks.includes(t.slug)}` to each pill.
  `filters.track` keeps being the thing passed to `api.getSessions` as
  `trackSlug` and the thing `activeKeys`/`BLOCKERS` check — it just becomes the
  joined string (empty → falls back to `ALL`, same as today for zero tracks).
  The "All" pill keeps calling `set('track', ALL)`, which already clears the
  param.
- `src/lib/api.js` — no change: `qs()` already passes a string value through
  untouched, so `trackSlug=a,b` needs nothing new here.
- Test in `tests/schedule.spec.js`, no lane (read-only, no reservation
  touched): pick two tracks that both have sessions on the same day from
  `/api/bootstrap` + `/api/sessions?day&trackSlug=`, as the existing
  "filters without a search" test already does, then drive the UI — select
  track A (`result-count` matches the API's single-track count), select track
  B too (`result-count` matches the API's two-track count, i.e.
  `?trackSlug=a,b`), then remove track A again (`result-count` back to track
  B's own count).

## How it will be proved

| Done when | Check | Layer |
| --- | --- | --- |
| Selecting two tracks lists the sessions of both, and `result-count` matches the API's count for those tracks | new test in `tests/schedule.spec.js` compares the UI's `result-count` after picking two pills against `GET /sessions?trackSlug=a,b` | spec |
| One track, and every existing `?track=<slug>` link, behaves exactly as today | existing `tests/api/endpoints.test.js` assertions on `trackSlug=<slug>` (unchanged) | API |
| A track selection still counts as a content filter that turns off the grid view | existing `BLOCKERS` logic in `SchedulePage` is untouched — `filters.track !== ALL` still trips it once any track is selected | spec (covered by existing grid-blocked tests, no new one needed) |
| Each track pill reports its state with `aria-pressed` | same new test asserts `aria-pressed="true"` on both selected pills and `"false"` on an unselected one | spec |
| A test adds a track and then removes one, checking `result-count` against the API each time | the new `tests/schedule.spec.js` test does exactly this (add A, add B, remove A) | spec |

## Out of scope

Venue, level, format and topic filters stay single-select, per the ticket.
