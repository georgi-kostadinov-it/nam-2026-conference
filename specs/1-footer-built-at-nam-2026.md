# Dry run: add a footer line "Built at NAM 2026" to the Home page

## What this changes
The Home page (`/`) gains one static line of text, "Built at NAM 2026", below
its existing sections. It is plain text, not a link, and appears on no other
page.

## Where
- `src/pages/HomePage.jsx` — add a line after `<SponsorMarquee />` inside the
  `HomePage` component's returned `<div>`, styled to match the surrounding
  body/footer copy (the small `text-faint`/`text-muted` treatment already used
  elsewhere on the page, e.g. the hero's `font-mono text-[10px] uppercase
  tracking-[0.16em] text-faint` byline). Give it `data-testid="built-at"` so
  the test can target it without matching on text alone.
- Test in `tests/home.spec.js` — add one assertion to the existing `describe('Home
  is a way in, not a feed')` block: visit `/` (`visit(page, '/')`, no attendee
  or pinned clock needed — static text) and assert
  `page.getByTestId('built-at')` is visible and reads "Built at NAM 2026".

## How it will be proved

| Done when | Check | Layer |
| --- | --- | --- |
| Home shows "Built at NAM 2026" near the bottom of the page, below the existing content | new Playwright assertion in `tests/home.spec.js` | spec |
| It is static text, not a link, styled to match surrounding copy | same assertion checks it renders as plain text (no `role=link`) | spec |
| No other page changes | no other file under `src/pages/` or `src/components/` is touched | code review |

## Out of scope
This is a throwaway dry-run ticket to exercise the ship → PR → CI flow; the
line is not meant to be a lasting feature and carries no follow-up work.
