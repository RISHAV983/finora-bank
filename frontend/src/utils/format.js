export const money = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
export const date = (value) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(`${value}T00:00:00`),
  );

const pad = (value) => String(value).padStart(2, '0');
/** Local calendar date (YYYY-MM-DD). toISOString() would use UTC and show the wrong day near midnight. */
export const localISODate = (when = new Date()) =>
  `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`;
export const daysAgoISO = (days) => {
  const when = new Date();
  when.setDate(when.getDate() - days);
  return localISODate(when);
};

export const greeting = (when = new Date()) => {
  const hour = when.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};
export const initials = (name = '') => {
  const letters = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
  return letters || 'U';
};
