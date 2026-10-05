// Directory / home (spec 1, 6.1): top bar, program presentation, featured, search and filters, cards.
import { html, useEffect, useMemo, useState } from '../../lib/html.js';
import * as api from '../../services/api.js';
import { useI18n } from '../../lib/i18n.js';
import { PROFILE_TYPES, searchText } from '../../lib/profileModel.js';
import { OrgCard } from '../../components/OrgCard.js';

export function DirectoryPage() {
  const { t } = useI18n();
  const [orgs, setOrgs] = useState(null);
  const [query, setQuery] = useState('');
  const [profile, setProfile] = useState(null);

  useEffect(() => { api.listPublicOrganizations().then(setOrgs); }, []);

  const filtered = useMemo(() => {
    if (!orgs) return [];
    const q = query.trim().toLowerCase();
    return orgs.filter((o) => (!profile || o.projects.some((p) => p.profile_type === profile))
      && (!q || searchText(o).includes(q)));
  }, [orgs, query, profile]);

  if (!orgs) return html`<div class="section">${t('common.loading')}</div>`;
  const featured = orgs.filter((o) => o.is_featured);
  const projectCount = orgs.reduce((n, o) => n + o.projects.length, 0);

  return html`<div>
    <section class="hero">
      <div class="deco-ring" style=${{ top: '-120px', right: '-80px', width: '420px', height: '420px', border: '1px solid rgba(203,232,43,0.22)' }}></div>
      <div class="deco-ring" style=${{ top: '-40px', right: '40px', width: '260px', height: '260px', border: '1px solid rgba(255,255,255,0.10)' }}></div>
      <div class="deco-ring" style=${{ bottom: '-90px', left: '-60px', width: '300px', height: '300px', borderRadius: '80px', transform: 'rotate(24deg)', border: '1px solid rgba(255,255,255,0.08)' }}></div>
      <div class="hero-inner">
        <div class="hero-kicker">${t('home.kicker')}</div>
        <h1>${t('home.title')}</h1>
        <p>${t('home.intro')}</p>
        <div class="hero-stats">
          <div><div class="hero-stat-value">${orgs.length}</div><div class="hero-stat-label">${t('home.stat_orgs')}</div></div>
          <div><div class="hero-stat-value">${projectCount}</div><div class="hero-stat-label">${t('home.stat_projects')}</div></div>
          <div><div class="hero-stat-value">${PROFILE_TYPES.length}</div><div class="hero-stat-label">${t('home.stat_profiles')}</div></div>
        </div>
      </div>
    </section>

    ${featured.length > 0 && html`<section class="section" style=${{ paddingTop: '56px', paddingBottom: '8px', marginTop: '0' }}>
      <div class="section-head"><h2 class="h2">${t('home.featured')}</h2><div class="section-note">${t('home.featured_note')}</div></div>
      <div class="grid-featured">${featured.slice(0, 3).map((o) => html`<${OrgCard} key=${o.id} org=${o} featured=${true} />`)}</div>
    </section>`}

    <div class="search-wrap" style=${featured.length ? { marginTop: '48px' } : null}>
      <div class="search-card">
        <input class="input" type="search" value=${query} placeholder=${t('home.search_placeholder')} onInput=${(e) => setQuery(e.target.value)} />
        <div class="chips">
          <button type="button" class="chip" aria-pressed=${!profile} onClick=${() => setProfile(null)}>${t('home.all')}</button>
          ${PROFILE_TYPES.map((p) => html`<button key=${p} type="button" class="chip" aria-pressed=${profile === p} onClick=${() => setProfile(p)}>${t('profile_type.' + p)}</button>`)}
        </div>
      </div>
    </div>

    <section class="section">
      <div class="section-head"><h2 class="h2">${profile ? t('profile_type.' + profile) : t('home.full_portfolio')}</h2>
        <div class="section-note">${t('home.results', { n: filtered.length })}</div></div>
      ${filtered.length
        ? html`<div class="grid-cards">${filtered.map((o) => html`<${OrgCard} key=${o.id} org=${o} />`)}</div>`
        : html`<div class="empty-state"><strong>${t('home.no_results_title')}</strong>${t('home.no_results_text')}</div>`}
    </section>
  </div>`;
}
