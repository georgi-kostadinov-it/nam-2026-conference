import { test, expect } from '@playwright/test';
import { API, visit, conferenceDays, bookableFor, ATTENDEES, shotForPR } from './helpers.js';

/**
 * Same formula as `src/lib/format.js:hours` — duplicated so this spec proves
 * the page against an independent expectation rather than the implementation
 * it is checking.
 */
const hours = (mins) => `${Math.round((mins / 60) * 100) / 100}h`;

test.describe('My Agenda lists sessions day by day', () => {
  test('groups confirmed and waitlisted sessions under each day, in time order, and Remove frees the seat', async ({ page, request }, testInfo) => {
    const mobile = testInfo.project.name === 'mobile';
    // Each project uses its own attendee, neither the seat-mutating subject
    // of any other spec, so the two runs cannot race each other's bookings.
    const user = mobile ? ATTENDEES.abraham : ATTENDEES.andy;
    const days = await conferenceDays();
    // The seed already books this attendee a mix of confirmed and waitlisted
    // sessions on this day (including an off-site one, on at least one
    // project) — nothing to set up.
    const mixedDay = days[mobile ? 1 : 0];
    // A day the seed books only confirmed seats on, for the "no waitlisted
    // note" branch.
    const confirmedOnlyDay = days[mobile ? 0 : 1];
    // The seed leaves this attendee nothing at all on the last day.
    const emptyDay = days[3];

    const before = await (await request.get(`${API}/users/${user}/schedule`)).json();
    const mixedEntry = before.days.find((d) => d.date === mixedDay);
    const confirmedEntry = before.days.find((d) => d.date === confirmedOnlyDay);
    const emptyEntry = before.days.find((d) => d.date === emptyDay);
    expect(mixedEntry, 'seed should book this attendee something on this day').toBeTruthy();
    expect(mixedEntry.sessions.some((s) => s.reservation === 'waitlisted'), 'seed should waitlist this attendee on this day').toBeTruthy();
    expect(mixedEntry.sessions.some((s) => s.reservation === 'confirmed'), 'seed should confirm this attendee on this day too').toBeTruthy();
    expect(confirmedEntry, 'seed should book this attendee something on this day').toBeTruthy();
    expect(confirmedEntry.sessions.every((s) => s.reservation === 'confirmed'), 'this day should have no waitlisted sessions').toBeTruthy();
    expect(emptyEntry, 'the seed should leave this attendee nothing on the last day').toBeFalsy();

    await visit(page, '/my-agenda', { as: user, at: `${days[0]}T07:00` });
    await expect(page.getByTestId('agenda-coming-soon')).toHaveCount(0);

    // Every day with a reservation appears, in date order, and the empty day
    // is left out entirely.
    const dayBlocks = page.locator('[data-testid^="agenda-day-"]');
    const nonEmptyDates = before.days.filter((d) => d.sessions.length > 0).map((d) => d.date).sort();
    await expect(dayBlocks).toHaveCount(nonEmptyDates.length);
    for (let i = 0; i < nonEmptyDates.length; i++) {
      await expect(dayBlocks.nth(i)).toHaveAttribute('data-testid', `agenda-day-${nonEmptyDates[i]}`);
    }
    await expect(page.getByTestId(`agenda-day-${emptyDay}`)).toHaveCount(0);

    // Time order and the row content within the mixed day.
    const mixedSection = page.getByTestId(`agenda-day-${mixedDay}`);
    const sortedMixed = [...mixedEntry.sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const rows = mixedSection.getByTestId('session-card');
    await expect(rows).toHaveCount(sortedMixed.length);
    for (let i = 0; i < sortedMixed.length; i++) {
      await expect(rows.nth(i)).toContainText(sortedMixed[i].startsAt);
      await expect(rows.nth(i)).toContainText(sortedMixed[i].room.name);
    }

    const waitlistedRow = mixedSection.getByTestId('session-card').filter({ hasText: mixedEntry.sessions.find((s) => s.reservation === 'waitlisted').title });
    await expect(waitlistedRow).toContainText('Waitlisted');
    const confirmedRow = mixedSection.getByTestId('session-card').filter({ hasText: mixedEntry.sessions.find((s) => s.reservation === 'confirmed').title });
    await expect(confirmedRow).not.toContainText('Waitlisted');

    // An off-site session names its venue; shown on whichever project's mix
    // happens to include one.
    const offsite = mixedEntry.sessions.find((s) => !s.venue.isPrimary);
    if (offsite) {
      await expect(mixedSection.getByTestId('session-card').filter({ hasText: offsite.title })).toContainText(offsite.venue.shortName);
    }

    // Booked hours count confirmed seats only; waitlisted time is called out
    // separately, and only when there is any.
    const confirmedMinutes = mixedEntry.sessions.filter((s) => s.reservation === 'confirmed').reduce((sum, s) => sum + s.durationMins, 0);
    const waitlistedMinutes = mixedEntry.sessions.filter((s) => s.reservation === 'waitlisted').reduce((sum, s) => sum + s.durationMins, 0);
    await expect(mixedSection).toContainText(hours(confirmedMinutes));
    await expect(mixedSection).toContainText(`+${hours(waitlistedMinutes)} waitlisted`);

    const confirmedSection = page.getByTestId(`agenda-day-${confirmedOnlyDay}`);
    const allConfirmedMinutes = confirmedEntry.sessions.reduce((sum, s) => sum + s.durationMins, 0);
    await expect(confirmedSection).toContainText(hours(allConfirmedMinutes));
    await expect(confirmedSection).not.toContainText('waitlisted');

    await shotForPR(page, 'my agenda grouped by day');

    // Remove: book a fresh session on the empty day directly through the API
    // (this is setup, not what we are proving), then remove it through the UI.
    // Both projects run this at once on the same empty day for their own
    // attendee, so each picks from opposite ends of the candidate list —
    // otherwise they could both land on the same session and this test's
    // exact seat-count assertion would race the other project's booking.
    const candidates = await bookableFor(request, user, emptyDay);
    if (mobile) candidates.reverse();
    const target = candidates.find((s) => s.seatsLeft > 3);
    expect(target, 'nothing bookable on the empty day').toBeTruthy();
    await request.put(`${API}/users/${user}/reservations/${target.id}`);
    const afterBooking = await (await request.get(`${API}/sessions/${target.id}`)).json();

    await page.reload();
    const emptySection = page.getByTestId(`agenda-day-${emptyDay}`);
    await expect(emptySection).toBeVisible();
    const targetRow = emptySection.getByTestId('session-card').filter({ hasText: target.title });
    await expect(targetRow).toBeVisible();

    await targetRow.getByRole('button', { name: 'Remove from my agenda' }).click();
    // Gone from the page at once, with no reload, and the day drops too since
    // that was its only session.
    await expect(emptySection).toHaveCount(0);

    const released = await (await request.get(`${API}/sessions/${target.id}`)).json();
    expect(released.seatsTaken).toBe(afterBooking.seatsTaken - 1);
  });

  test('flags an impossible venue hop and a waitlisted overlap, and clears a flag when a session is removed', async ({ page, request }, testInfo) => {
    const mobile = testInfo.project.name === 'mobile';
    // Jonas and Marcus, day index 1, are not touched by the "groups sessions"
    // test above (which uses Andy/Abraham) or by tests/seats.spec.js (which
    // never books either of them on this day) — a fresh lane, so this test's
    // own bookings cannot race either.
    const user = mobile ? ATTENDEES.marcus : ATTENDEES.jonas;
    const days = await conferenceDays();
    const day = days[1];

    // Day 1's grid runs 45-minute slots with a 30-minute changeover, and the
    // seed's Aurora<->Foundry travel (shuttle/rideshare/taxi, 18-29 min) plus
    // an 11-16 min room walk clears that everywhere except the Foundry Cargo
    // Bay room (14 min walk) and Aurora's Neon Lounge (16 min walk), where
    // even the fastest paid ride overruns a 30-minute changeover — the
    // impossible hop below. The 75-minute lunch break clears it easily — the
    // "fits" hop. Fixture, chosen from the seed for this attendee on day 1:
    //   away           — booked here, Foundry Cargo Bay; a 30-min changeover
    //                    from `impossibleOther` (impossible) and a 75-min one
    //                    from `fitsOther` (fits)
    //   impossibleOther — the other half of the impossible-hop pair
    //   fitsOther       — the other half of the fits (no-flag) pair
    //   fullSlot        — already sold out; booking it waitlists this
    //                     attendee, overlapping `overlapsFull`
    //   overlapsFull    — booked here, same room/venue/time as `fullSlot`
    //   alreadyHeld     — fixture members the seed already books for this
    //                     attendee, so only the rest need booking
    const fixture = mobile
      ? { away: 52, impossibleOther: 55, fitsOther: 46, fullSlot: 40, overlapsFull: 42, alreadyHeld: [46, 40] }
      : { away: 48, impossibleOther: 40, fitsOther: 50, fullSlot: 54, overlapsFull: 56, alreadyHeld: [40, 50] };
    // `fullSlot` is already waitlisted for Marcus from the seed, so only
    // Jonas needs to book it (before `overlapsFull` — see below).
    const toBook = mobile
      ? [fixture.overlapsFull, fixture.away, fixture.impossibleOther]
      : [fixture.away, fixture.fullSlot, fixture.overlapsFull];

    const before = await (await request.get(`${API}/users/${user}/schedule`)).json();
    const beforeDay = before.days.find((d) => d.date === day);
    const heldIds = new Set((beforeDay?.sessions ?? []).map((s) => s.id));
    for (const id of fixture.alreadyHeld) {
      expect(heldIds.has(id), `fixture session ${id} should already be held`).toBeTruthy();
    }
    for (const id of toBook) {
      expect(heldIds.has(id), `fixture session ${id} should not be booked yet`).toBeFalsy();
    }

    const fullSession = await (await request.get(`${API}/sessions/${fixture.fullSlot}`)).json();
    expect(fullSession.seatsLeft, 'fixture "fullSlot" should already be sold out').toBe(0);

    // Jonas books `fullSlot` before `overlapsFull` (Marcus's `fullSlot` is
    // already a waitlist place from the seed): the overlap guard only blocks
    // a *confirmed* clash, so taking the full session's waitlist place
    // first, then a confirmed seat that overlaps it, raises no 409 — only
    // the reverse order would (seats.md § Invariants).
    for (const id of toBook) {
      const res = await request.put(`${API}/users/${user}/reservations/${id}`);
      expect(res.ok(), `booking session ${id} should succeed`).toBeTruthy();
    }

    const [awaySession, impossibleOtherS, fitsOtherS, fullS, overlapS] = await Promise.all(
      [fixture.away, fixture.impossibleOther, fixture.fitsOther, fixture.fullSlot, fixture.overlapsFull]
        .map((id) => request.get(`${API}/sessions/${id}`).then((r) => r.json())),
    );

    await visit(page, '/my-agenda', { as: user, at: `${day}T07:00` });
    const section = page.getByTestId(`agenda-day-${day}`);
    await expect(section).toBeVisible();

    // Impossible hop: a flag names both sessions.
    const hopFlag = section.getByTestId('agenda-flag').filter({ hasText: awaySession.title });
    await expect(hopFlag).toHaveCount(1);
    await expect(hopFlag).toContainText(impossibleOtherS.title);

    // Cross-venue hop with enough time for some travel option: no flag
    // mentions both of these together.
    const fitsFlag = section.getByTestId('agenda-flag').filter({ hasText: fitsOtherS.title }).filter({ hasText: awaySession.title });
    await expect(fitsFlag).toHaveCount(0);

    // Waitlist overlap: a flag names both sessions too.
    const waitlistFlag = section.getByTestId('agenda-flag').filter({ hasText: fullS.title });
    await expect(waitlistFlag).toHaveCount(1);
    await expect(waitlistFlag).toContainText(overlapS.title);

    await shotForPR(page, 'my agenda flags an impossible hop and a waitlisted overlap');

    // Removing one session of the flagged hop pair clears it at once, no reload.
    const awayRow = section.getByTestId('session-card').filter({ hasText: awaySession.title });
    await awayRow.getByRole('button', { name: 'Remove from my agenda' }).click();
    await expect(section.getByTestId('agenda-flag').filter({ hasText: awaySession.title })).toHaveCount(0);
    // The unrelated waitlist flag survives — removal only clears its own pair.
    await expect(waitlistFlag).toHaveCount(1);

    // Clean up whatever Remove did not already release — everything this
    // test itself booked, minus `away` (gone via the UI above). Marcus's
    // `fullSlot` is the seed's own waitlist place, not this test's, so it
    // is left exactly as the seed made it.
    for (const id of toBook.filter((sessionId) => sessionId !== fixture.away)) {
      await request.delete(`${API}/users/${user}/reservations/${id}`);
    }
  });
});
