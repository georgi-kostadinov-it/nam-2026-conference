# My Agenda feature scope and conflict detection

- **Title:** My Agenda feature scope and conflict detection for the conference app.
- **Date:** 2026-11-14 (given as "Nov 14").
- **Participants:** Mike Mitchell (client) and the delivery team, whose members
  are not named. The transcript doesn't label who said what, so the delivery
  team is recorded as "Me".
- **Source:** Inline — a meeting transcript pasted into the conversation. It
  ends mid-sentence.
- **Tickets raised:**
  - [#7 Show my sessions day by day on My Agenda, with Remove](https://github.com/georgi-kostadinov-it/nam-2026-conference/issues/7)
  - [#8 Flag impossible venue hops and waitlist overlaps on My Agenda](https://github.com/georgi-kostadinov-it/nam-2026-conference/issues/8) — depends on #7
- **Context updated:** Approved for update, not yet applied:
  - `context/product-context/prd.md`: what My Agenda is for (plan in advance,
    then follow your day without having to think about it).
  - `CLAUDE.md`: a cross-venue hop that can't be made, or a waitlist place
    that overlaps another session, is flagged on My Agenda rather than
    blocked. Overlapping confirmed seats are still blocked when you add one.
- **Set aside:**
  - Greetings and small talk.
  - Separate stories for adding, rearranging and editing sessions. Adding
    already exists on the schedule, and sessions run at fixed times, so there
    is nothing to rearrange. Recorded as out of scope in #7.
  - The transcript's unfinished last sentence ("What I don't know is
    whether…"), because there's nothing in it to act on.
- **Q&A:**
  - *Mike asked for overlapping sessions to be flagged, but the app blocks two
    overlapping seats. Which should it be?* → Keep the block. My Agenda flags
    what can still happen: a waitlist place overlapping a session, and a venue
    hop that can't be made.
  - *How is a too-tight venue hop judged?* → By real travel times
    (`assessTravel`), not by whether there's a break or meal in between.
  - *How should the work be split?* → Two tickets: the page with Remove, then
    the conflict flags on it. A "what's next" view was left out.
  - *Should the rules be recorded in the context?* → Yes, in `prd.md` and
    `CLAUDE.md`.
