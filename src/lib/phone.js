export function formatPhoneInput(value, country = 'BR') {
  const raw = String(value || '');
  const digits = raw.replace(/\D/g, '').slice(0, 15);
  if (!digits) return raw.startsWith('+') && country !== 'BR' ? '+' : '';

  if (country === 'BR') {
    const hasCountryCode = raw.trim().startsWith('+55') || (digits.length > 11 && digits.startsWith('55'));
    const local = (hasCountryCode ? digits.slice(2) : digits).slice(0, 11);
    const prefix = hasCountryCode ? '+55 ' : '';
    if (local.length <= 2) return `${prefix}(${local})`;
    const area = local.slice(0, 2);
    const number = local.slice(2);
    const split = number.length > 8 ? 5 : 4;
    return `${prefix}(${area}) ${number.length > split ? `${number.slice(0, split)}-${number.slice(split)}` : number}`;
  }

  const prefix = raw.trim().startsWith('+') ? '+' : '';
  return prefix + (digits.match(/.{1,3}/g) || []).join(' ');
}
