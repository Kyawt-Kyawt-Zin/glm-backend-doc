const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function pickupWindow(confirmedMs, now = Date.now()) {
  const confirmed = Number(confirmedMs);
  if (!Number.isFinite(confirmed) || confirmed <= 0) return null;
  const deadline = confirmed + WINDOW_MS;
  const dubaiDate = (value) => new Date(value + DUBAI_OFFSET_MS).toISOString().slice(0, 10);
  return { minDate: dubaiDate(Math.max(confirmed, now)), maxDate: dubaiDate(deadline), deadline, expired: now > deadline };
}

export function validatePickupSelection(confirmedMs, date, time, now = Date.now()) {
  const window = pickupWindow(confirmedMs, now);
  if (!window) return 'Pickup scheduling is unavailable. Please contact us.';
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) return 'Choose a valid pickup date and time.';
  const [hour, minute] = time.split(':').map(Number);
  if (minute > 59 || hour < 9 || hour > 15 || (hour === 15 && minute > 0)) return 'Pickup time must be between 9:00 AM and 3:00 PM Dubai time.';
  const selected = Date.parse(date + 'T' + time + ':00+04:00');
  if (!Number.isFinite(selected) || new Date(selected + DUBAI_OFFSET_MS).toISOString().slice(0, 10) !== date) return 'Choose a valid pickup date.';
  if (selected < now || selected < Number(confirmedMs) || selected > window.deadline) return 'Choose a future time within seven days of order confirmation.';
  return null;
}
