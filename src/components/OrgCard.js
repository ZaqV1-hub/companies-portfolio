// Directory card (spec 1, 6.1): logo, name, profile chip, subtitle, 2 lines of description,
// stage (profiles A and B), "What we're looking for" summary, number of projects; "Updating" badge when provisional.
import { cx, html } from '../lib/html.js';
import { useI18n } from '../lib/i18n.js';
import { lookingForSummary, stage, subtitle } from '../lib/profileModel.js';
import { href } from '../lib/router.js';
import { LogoPlate } from './ui.js';

function CardStage({ project, i18n }) {
  const s = stage(project);
  if (!s || s.index < 0) return null;
  const label = i18n.label(s.list, s.steps[s.index]) + (s.trl ? ' · TRL ' + s.trl : '');
  return html`<div>
    <div class="card-stage">${s.steps.map((step, i) => html`<span key=${step} class=${i <= s.index ? 'on' : ''}></span>`)}</div>
    <div class="card-stage-label">${label}</div>
  </div>`;
}

export function OrgCard({ org, featured, project: shown }) {
  const i18n = useI18n();
  const { t, tx } = i18n;
  const project = shown || org.projects[0];
  const n = org.projects.length;
  const summary = lookingForSummary(project, i18n);
  return html`<a class=${cx('card', featured && 'featured')} href=${href('/org/' + org.id + (project !== org.projects[0] ? '?project=' + project.id : ''))}>
    <div class="card-cover" style=${org.cover_url ? { backgroundImage: "linear-gradient(165deg, rgba(20,27,52,.18), rgba(20,27,52,.5)), url('" + org.cover_url + "')" } : null}>
      <${LogoPlate} org=${org} className="logo-plate" />
      ${org.public_state === 'provisional' && html`<span class="cover-badge updating">${t('common.updating')}</span>`}
    </div>
    <div class="card-body">
      <div class="card-title-row">
        <div class="card-title">${org.name}</div>
        <div class="pill">${t('profile_type_short.' + project.profile_type)}</div>
      </div>
      <div class="card-subtitle">${subtitle(project, i18n)}</div>
      <div class="card-desc">${tx(org.description)}</div>
      <${CardStage} project=${project} i18n=${i18n} />
      <div class="card-foot">
        <div>
          ${summary && html`<div class="card-metric">${summary}</div>`}
          ${n > 1 && html`<div class="card-projects">${t('common.projects_count', { n })}</div>`}
        </div>
        <div class="card-more">${featured ? t('home.view_profile') : t('home.view_more')}</div>
      </div>
    </div>
  </a>`;
}
