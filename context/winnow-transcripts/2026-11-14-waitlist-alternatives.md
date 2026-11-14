# Similar sessions in place of a waitlist place

- **Title:** Replacing waitlist places on My Agenda with similar sessions.
- **Date:** 2026-11-14.
- **Participants:** Georgi Kostadinov.
- **Source:** Inline, a one-line request made in a Claude Code chat while #7
  and #8 were being shipped.
- **Tickets raised:**
  - [#11 Offer similar sessions with free seats in place of a waitlist place on My Agenda](https://github.com/georgi-kostadinov-it/nam-2026-conference/issues/11), which depends on #7.
- **Context updated:** Approved, and applied in the same pull request as this record:
  - `CLAUDE.md`, in the reservations rules: nothing gives up a waitlist place
    except the attendee. A page may suggest a similar session that has seats,
    but never swaps the place out itself.
- **Set aside:**
  - Replacing waitlist places automatically, as first asked. It would throw
    away the attendee's place in the queue, which can still turn into a seat,
    and take a seat they never picked.
- **Q&A:**
  - *Replace automatically, or suggest?* → Suggest, with a one-click swap that
    takes the new seat and then gives up the waitlist place.
  - *What counts as "similar"?* → Same track as the waitlisted session first,
    then the topics they share.
  - *A new ticket, or fold it into #8?* → A new ticket that depends on #7.
