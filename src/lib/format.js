// Display formats (spec 1, 6.4): "USD 1,000,000" in English and "US$ 1.000.000" in Portuguese.
// Values are always whole numbers in USD; the platform never converts currency.

export function formatUSD(amount, lang) {
  if (amount == null || amount === '') return '';
  const n = Math.round(Number(amount));
  return lang === 'pt' ? 'US$ ' + n.toLocaleString('pt-BR') : 'USD ' + n.toLocaleString('en-US');
}

/** "USD 1,000,000 – USD 5,000,000" or a single value when min = max / one side missing. */
export function formatUSDRange(range, lang) {
  if (!range) return '';
  const { min, max } = range;
  if (min && max && min !== max) return formatUSD(min, lang) + ' – ' + formatUSD(max, lang);
  return formatUSD(min || max, lang);
}

export function formatNumber(n, lang) {
  return Number(n).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US');
}

const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
};

/** ISO date (YYYY-MM-DD) → "22 Sep 2026" / "22 set 2026". */
export function formatDate(iso, lang) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return String(d).padStart(2, '0') + ' ' + MONTHS[lang][m - 1] + ' ' + y;
}

/** Milestone / round period: {year, month} → "Jun 2027"; {year, semester} → "H2 2026" / "2º sem. 2026". */
export function formatPeriod(period, lang) {
  if (!period || !period.year) return '';
  if (period.month) return MONTHS[lang][period.month - 1] + ' ' + period.year;
  if (period.semester) return lang === 'pt' ? period.semester + 'º sem. ' + period.year : 'H' + period.semester + ' ' + period.year;
  return String(period.year);
}

/** Sortable number for a period (used to order milestones and compute their status). */
export function periodValue(period) {
  if (!period) return 0;
  const month = period.month || (period.semester === 1 ? 3 : period.semester === 2 ? 9 : 6);
  return period.year * 12 + (month - 1);
}

/** Last month (as year*12+month-1) covered by a period: a semester ends in June / December. */
export function periodEnd(period) {
  if (!period) return 0;
  const month = period.month || (period.semester === 1 ? 6 : period.semester === 2 ? 12 : 12);
  return period.year * 12 + (month - 1);
}

export function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
