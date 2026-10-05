// Public profile page layout (spec 1, 6.2). Used by the public site and by the form preview.
// Receives a PUBLIC organization (no focal point) and renders it in the current language.
import { cx, html, useState } from '../../lib/html.js';
import { formatDate } from '../../lib/format.js';
import { useI18n } from '../../lib/i18n.js';
import { present, stage, subtitle } from '../../lib/profileModel.js';
import { LogoPlate } from '../ui.js';
import { LookingForCard, mainBlocks, otherSideCards } from './blocks.js';

function StageChart({ project, i18n }) {
  const s = stage(project);
  if (!s || s.index < 0) return null;
  return html`<div class=${cx('hero-stage', s.steps.length === 3 && 'three')}>
    <div class="hero-stage-steps">
      ${s.steps.map((step, i) => html`<div class="stage-step" key=${step}>
        <div class=${cx('stage-bar', i < s.index && 'done', i === s.index && 'current')}></div>
        <div class=${cx('stage-label', i === s.index && 'current')}>${i18n.label(s.list, step)}</div>
      </div>`)}
    </div>
    ${s.trl && html`<div class="hero-trl"><span>TRL</span><strong>${s.trl}</strong><small>/9</small></div>`}
  </div>`;
}

function stageChip(project, i18n) {
  const s = stage(project);
  if (!s || s.index < 0) return null;
  const label = i18n.label(s.list, s.steps[s.index]);
  return s.trl ? label + ' · ' + i18n.t('profile.trl', { n: s.trl }) : label;
}

function Header({ org, project, i18n, backHref }) {
  const t = i18n.t;
  const sub = subtitle(project, i18n);
  const chip = stageChip(project, i18n);
  const place = [org.city, org.state].filter(Boolean).join(' / ');
  return html`<div class="profile-hero" style=${org.cover_url ? { backgroundImage: "url('" + org.cover_url + "')" } : null}>
    <div class="profile-hero-inner">
      ${backHref && html`<a class="btn btn-ghost-light" href=${backHref}>${t('common.back_to_directory')}</a>`}
      <div class="profile-hero-row">
        <${LogoPlate} org=${org} className="hero-plate" />
        <div style=${{ flex: '1 1 340px', minWidth: 0 }}>
          <span class="hero-chip">${t('profile_type.' + project.profile_type)}</span>
          <h1>${org.name}</h1>
          ${sub && html`<p class="subtitle">${sub}</p>`}
          <div class="hero-meta">
            ${chip && html`<span class="meta-chip">${chip}</span>`}
            ${org.size && html`<span class="meta-chip">${i18n.label('size', org.size)}</span>`}
            ${place && html`<span>${place}</span>`}
            ${org.website && html`<a href=${org.website} target="_blank" rel="noopener">${org.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>`}
            ${org.public_state === 'provisional' || !org.last_approved_at
              ? html`<span class="badge-updating">${t('common.updating')}</span>`
              : html`<span>${t('common.updated_on', { date: formatDate(org.last_approved_at, i18n.lang) })}</span>`}
          </div>
          <${StageChart} project=${project} i18n=${i18n} />
        </div>
      </div>
    </div>
  </div>`;
}

function ProjectSelector({ org, project, i18n, onSelect }) {
  if (org.projects.length < 2) return null;
  return html`<div class="project-selector-wrap">
    <div class="eyebrow">${i18n.t('profile.projects')} · ${org.projects.length}</div>
    <div class="project-selector" role="tablist">
      ${org.projects.map((p) => html`<button key=${p.id} type="button" role="tab" aria-selected=${p.id === project.id}
          class=${cx('project-tab', p.id === project.id && 'on')} onClick=${() => onSelect(p.id)}>
        <span class="project-tab-type">${i18n.t('profile_type_short.' + p.profile_type)}</span>
        <span class="project-tab-title">${subtitle(p, i18n)}</span>
        ${present(p.summary) && html`<span class="project-tab-summary">${i18n.tx(p.summary)}</span>`}
      </button>`)}
    </div>
  </div>`;
}

function Leadership({ org, i18n }) {
  if (!present(org.leadership)) return null;
  return html`<section class="full-block" id="leadership">
    <h2 class="block-title">${i18n.t('profile.leadership')}</h2>
    <div class="leader-grid">${org.leadership.slice(0, 4).map((p, i) => html`
      <div class="leader" key=${i}>
        <div class="leader-avatar">${p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
        <div><div class="leader-name">${p.name}</div><div class="leader-role">${i18n.tx(p.role)}</div>
        ${present(p.experience) && html`<div class="leader-exp">${i18n.tx(p.experience)}</div>`}</div>
      </div>`)}
    </div>
  </section>`;
}

function Gallery({ org, i18n }) {
  const [open, setOpen] = useState(null);
  if (!present(org.gallery)) return null;
  return html`<section class="full-block" id="gallery">
    <h2 class="block-title">${i18n.t('profile.gallery')}</h2>
    <div class="gallery">${org.gallery.slice(0, 6).map((g, i) => html`
      <button key=${i} type="button" class="gallery-item" style=${{ backgroundImage: "url('" + g.url + "')" }} onClick=${() => setOpen(g)}>
        <span>${i18n.tx(g.caption)}</span>
      </button>`)}
    </div>
    ${open && html`<figure class="lightbox" onClick=${() => setOpen(null)}>
      <img src=${open.url} alt=${i18n.tx(open.caption)} /><figcaption>${i18n.tx(open.caption)}</figcaption>
    </figure>`}
  </section>`;
}

/**
 * @param {object} props
 * @param {PublicOrganization} props.org
 * @param {string} [props.projectId] selected project (defaults to the first)
 * @param {(projectId: string) => void} props.onSelectProject
 * @param {(projectId: string) => void} props.onRequestContact
 * @param {string} [props.contactState] 'sent' after a request
 * @param {string} [props.backHref]
 */
export function ProfileView({ org, projectId, onSelectProject, onRequestContact, contactState, backHref }) {
  const i18n = useI18n();
  const project = org.projects.find((p) => p.id === projectId) || org.projects[0];
  if (!project) return null;
  const cta = html`<${LookingForCard} org=${org} project=${project} i18n=${i18n}
    onRequestContact=${() => onRequestContact(project.id)} contactState=${contactState} />`;
  const side = otherSideCards(org, project, i18n);
  return html`<div class="profile">
    <${Header} org=${org} project=${project} i18n=${i18n} backHref=${backHref} />
    <div class="profile-body">
      <${ProjectSelector} org=${org} project=${project} i18n=${i18n} onSelect=${onSelectProject} />
      <div class="profile-cta-mobile">${cta}</div>
      <main class="profile-main">${mainBlocks(org, project, i18n)}</main>
      <aside class="profile-side">
        <div class="profile-cta-desktop">${cta}</div>
        ${side}
      </aside>
      <${Leadership} org=${org} i18n=${i18n} />
      <${Gallery} org=${org} i18n=${i18n} />
      <footer class="profile-footer">
        <span>${i18n.t('profile.footer')}</span>
        ${org.last_approved_at && org.public_state === 'published'
          ? html`<span>${i18n.t('profile.last_approval', { date: formatDate(org.last_approved_at, i18n.lang) })}</span>`
          : html`<span>${i18n.t('profile.provisional_footer')}</span>`}
      </footer>
    </div>
  </div>`;
}
