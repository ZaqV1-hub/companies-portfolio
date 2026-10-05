// Read-only rendering of form values as text (team review screen) and helpers to edit English texts.
import { formatPeriod, formatUSD, formatUSDRange } from './format.js';

const pt = (v) => (v && typeof v === 'object' ? v.pt || '' : v || '');

/** Portuguese reading of a field value as a list of lines ([] = empty). */
export function displayLines(field, value, i18n) {
  const L = (list, v) => i18n.label(list, v);
  const usd = (n) => (n == null || n === '' ? '' : formatUSD(n, 'pt'));
  if (value == null) return [];
  switch (field.type) {
    case 'text': return pt(value) ? [pt(value)] : [];
    case 'plain': case 'url': return value ? [String(value)] : [];
    case 'select': return value ? [L(field.list, value)] : [];
    case 'trl': return value ? ['TRL ' + value] : [];
    case 'percent': return value != null && value !== '' ? [value + '%'] : [];
    case 'multi': return (value || []).length ? [(value || []).map((v) => L(field.list, v)).join(', ')] : [];
    case 'image': return value ? ['[imagem]'] : [];
    case 'place': return value.city || value.state ? [[value.city, value.state].filter(Boolean).join(' / ')] : [];
    case 'focal': return value.name ? [[value.name, value.role, value.email, value.phone].filter(Boolean).join(' · ')] : [];
    case 'usd_range': return value.min || value.max ? [formatUSDRange(value, 'pt')] : [];
    case 'pipeline': return value.map((p) => p.name + ' — ' + pt(p.indication));
    case 'milestones': return value.map((m) => formatPeriod(m.period, 'pt') + ' — ' + pt(m.description));
    case 'rounds': return value.map((r) => [L('round_stage', r.stage), formatPeriod(r.period, 'pt'), usd(r.amount_usd), pt(r.purpose)].filter(Boolean).join(' · '));
    case 'raised': return value.none ? ['Nenhum valor captado'] : value.items.map((r) => L('raised_source', r.source) + ': ' + usd(r.amount_usd));
    case 'revenue': return value.pre_revenue ? ['Pré-receita'] : value.amount_usd ? [usd(value.amount_usd) + (value.year ? ' (' + value.year + ')' : '')] : [];
    case 'exports_c': return value.none ? ['Não exporta'] : value.amount_usd ? [usd(value.amount_usd) + (value.year ? ' (' + value.year + ')' : '')] : [];
    case 'exports_pct': return value.pct != null ? [value.pct + '% — ' + (value.destinations || []).map((d) => L('markets', d)).join(', ')] : [];
    case 'clients': return value.count || (value.profiles || []).length ? [[value.count ? value.count + ' clientes' : '', (value.profiles || []).map((p) => L('client_profiles', p)).join(', ')].filter(Boolean).join(' · ')] : [];
    case 'market_share': return value.pct != null ? [value.pct + '% — ' + pt(value.segment)] : [];
    case 'portfolio': return value.map((p) => pt(p.category) + ' — ' + pt(p.description));
    case 'interests': return value.map((p) => pt(p.area) + ' — ' + pt(p.description));
    case 'text_list': return value.map(pt).filter(Boolean);
    case 'plain_list': return value.filter(Boolean);
    case 'leaders': return value.map((p) => [p.name, pt(p.role), pt(p.experience)].filter(Boolean).join(' · '));
    case 'gallery': return value.map((g, i) => 'Imagem ' + (i + 1) + ': ' + pt(g.caption));
    default: return [JSON.stringify(value)];
  }
}

/** Compares two values ignoring the English texts (the team edits those). */
export function sameValue(a, b) {
  const strip = (v) => {
    if (v == null) return null;
    if (Array.isArray(v)) return v.map(strip);
    if (typeof v === 'object') {
      if ('pt' in v && 'en' in v && Object.keys(v).length <= 2) return v.pt || '';
      const out = {};
      Object.keys(v).sort().forEach((k) => { const s = strip(v[k]); if (s != null && s !== '' && !(Array.isArray(s) && !s.length)) out[k] = s; });
      return Object.keys(out).length ? out : null;
    }
    return v === '' ? null : v;
  };
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

/** Every translatable text {pt, en} inside a value, with its path: [{path: [...], pt, en}]. */
export function collectTexts(value, path = []) {
  if (value == null || typeof value !== 'object') return [];
  if ('pt' in value && 'en' in value) return [{ path, pt: value.pt || '', en: value.en || '' }];
  const keys = Array.isArray(value) ? value.map((_, i) => i) : Object.keys(value);
  return keys.flatMap((k) => collectTexts(value[k], path.concat([k])));
}

/** Returns a copy of `value` with the English text at `path` replaced. */
export function setEnglish(value, path, en) {
  if (!path.length) return { ...value, en };
  const [head, ...rest] = path;
  const copy = Array.isArray(value) ? value.slice() : { ...value };
  copy[head] = setEnglish(value[head], rest, en);
  return copy;
}
