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
    const target = (await bookableFor(request, user, emptyDay)).find((s) => s.seatsLeft > 3);
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
});
