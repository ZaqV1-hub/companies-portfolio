// Directory / home: program presentation, search and filters, documents, company cards.
import { html, useEffect, useMemo, useState } from '../../lib/html.js';
import * as api from '../../services/api.js?v=20261030-intake1';
import { useI18n } from '../../lib/i18n.js';
import { PROFILE_TYPES, searchText } from '../../lib/profileModel.js';
import { href } from '../../lib/router.js';
import { OrgCard } from '../../components/OrgCard.js?v=20261014-api-recovery3';
import { EMPTY_FILTERS, FILTER_DEFS, activeFilterCount, matchesFilters, matchingProject } from '../../lib/directoryFilters.js';

export function DirectoryPage() {
  const { t, label, lang } = useI18n();
  const [orgs, setOrgs] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const profile = filters.profile;
  const setFilter = (key, value) => setFilters({ ...filters, [key]: value });

  useEffect(() => { api.listPublicOrganizations().then(setOrgs); }, []);
  useEffect(() => { setSelectedDocument(null); api.listPublicDocuments(lang).then(setDocuments).catch(()=>setDocuments([])); }, [lang]);

  const filtered = useMemo(() => {
    if (!orgs) return [];
    const q = query.trim().toLowerCase();
    return orgs.filter((o) => matchesFilters(o, filters) && (!q || searchText(o).includes(q)));
  }, [orgs, query, filters]);

  if (!orgs) return html`<div class="section">${t('common.loading')}</div>`;
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
        <div class="hero-company-action"><a class="btn btn-lime hero-company-signup" href=${href('/company/signup')}>${lang === 'pt' ? 'Cadastre sua empresa' : 'Add your company'}</a><span>${lang === 'pt' ? 'Inscrição sujeita à aprovação da Abiquifi' : 'Application subject to Abiquifi approval'}</span></div>
        <div class="hero-stats">
          <div><div class="hero-stat-value">${orgs.length}</div><div class="hero-stat-label">${t('home.stat_orgs')}</div></div>
          <div><div class="hero-stat-value">${projectCount}</div><div class="hero-stat-label">${t('home.stat_projects')}</div></div>
          <div><div class="hero-stat-value">${PROFILE_TYPES.length}</div><div class="hero-stat-label">${t('home.stat_profiles')}</div></div>
        </div>
      </div>
    </section>

    <div class="search-wrap discovery-layout">
      <div class="search-card">
        <input class="input" type="search" value=${query} placeholder=${t('home.search_placeholder')} onInput=${(e) => setQuery(e.target.value)} />
        <div class="chips">
          <button type="button" class="chip" aria-pressed=${!profile} onClick=${() => setFilter('profile', '')}>${t('home.all')}</button>
          ${PROFILE_TYPES.map((p) => html`<button key=${p} type="button" class="chip" aria-pressed=${profile === p} onClick=${() => setFilter('profile', p)}>${t('profile_type.' + p)}</button>`)}
        </div>
        <div class="filters">
          ${FILTER_DEFS.map(([key, list, values]) => html`<label key=${key} class="filter">
            <span>${t('filters.' + key)}</span>
            <select class=${filters[key] ? 'on' : ''} value=${filters[key]} onChange=${(e) => setFilter(key, e.target.value)}>
              <option value="">${t('filters.any')}</option>
              ${values.map((v) => html`<option key=${v} value=${v}>${list ? label(list, v) : t('filters.trl_min', { n: v })}</option>`)}
            </select>
          </label>`)}
          ${activeFilterCount(filters) > 0 && html`<button type="button" class="btn-link filters-clear" onClick=${() => setFilters(EMPTY_FILTERS)}>${t('filters.clear')}</button>`}
        </div>
      </div>
      <aside class="home-documents" aria-label=${t('documents.title')}>
        <div class="home-documents-head"><span class="home-documents-icon" aria-hidden="true">PDF</span><h2>${t('documents.title')}</h2></div>
        <p>${t('documents.intro')}</p>
        ${documents.length ? html`<div class="home-document-list">${documents.map((document)=>html`<button type="button" class="home-document" key=${document.id} onClick=${()=>setSelectedDocument(document)}><span class="home-document-name">${lang==='pt' ? document.title_pt || document.title_en : document.title_en || document.title_pt}</span><span class="home-document-view">${t('documents.view')} ↗</span></button>`)}</div>` : html`<p class="home-documents-empty">${t('documents.empty')}</p>`}
      </aside>
    </div>

    <section class="section">
      <div class="section-head"><h2 class="h2">${profile ? t('profile_type.' + profile) : t('home.full_portfolio')}</h2>
        <div class="section-note">${t('home.results', { n: filtered.length })}</div></div>
      ${filtered.length
        ? html`<div class="grid-cards">${filtered.map((o) => html`<${OrgCard} key=${o.id} org=${o} project=${matchingProject(o, filters)} />`)}</div>`
        : html`<div class="empty-state"><strong>${t('home.no_results_title')}</strong>${t('home.no_results_text')}</div>`}
    </section>
    ${selectedDocument && html`<div class="doc-modal-backdrop" onClick=${(event)=>{if(event.target===event.currentTarget)setSelectedDocument(null)}}>
      <div class="doc-modal" role="dialog" aria-modal="true" aria-label=${lang==='pt' ? selectedDocument.title_pt : selectedDocument.title_en}>
        <div class="doc-modal-head"><strong>${lang==='pt' ? selectedDocument.title_pt || selectedDocument.title_en : selectedDocument.title_en || selectedDocument.title_pt}</strong><div><a class="btn btn-outline" href=${selectedDocument.url} target="_blank" rel="noopener">${t('documents.open_new_tab')}</a><button type="button" class="modal-close" aria-label=${t('common.close')} onClick=${()=>setSelectedDocument(null)}>×</button></div></div>
        <iframe title=${lang==='pt' ? selectedDocument.title_pt : selectedDocument.title_en} src=${selectedDocument.url}></iframe>
      </div>
    </div>`}
  </div>`;
}
