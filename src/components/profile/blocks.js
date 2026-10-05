// Content blocks of the public profile, per profile type, in the order of spec 1, table 6.3.
// Each block returns null when it has nothing to show (spec 1, 6.4).
import { html } from '../../lib/html.js';
import { formatNumber, formatPeriod, formatUSD, formatUSDRange } from '../../lib/format.js';
import { labels, milestoneStatus, present, sortedMilestones, sumRaised } from '../../lib/profileModel.js';
import { ReadMore, Tags } from '../ui.js';

function Block({ id, title, children }) {
  return html`<section class="pblock" id=${id}><h2 class="block-title">${title}</h2>${children}</section>`;
}

function SideCard({ title, children }) {
  return html`<div class="side-card"><div class="side-label">${title}</div>${children}</div>`;
}

const Text = ({ value, i18n }) => (present(value) ? html`<${ReadMore} text=${i18n.tx(value)} />` : null);

function Sub({ title, children }) {
  return html`<div class="sub"><div class="sub-title">${title}</div>${children}</div>`;
}

// ---------------------------------------------------------------- shared pieces
function revenueLine(rev, i18n) {
  if (!rev) return null;
  if (rev.pre_revenue) return i18n.t('profile.pre_revenue');
  if (!rev.amount_usd) return null;
  return i18n.t('profile.annual_revenue', { year: rev.year }) + ': ' + formatUSD(rev.amount_usd, i18n.lang);
}

function exportsLine(exp, i18n) {
  if (!exp) return null;
  if (exp.none) return i18n.t('profile.no_exports');
  if (exp.amount_usd) return i18n.t('profile.exports_year', { amount: formatUSD(exp.amount_usd, i18n.lang), year: exp.year });
  if (exp.pct != null) {
    const dest = labels(i18n, 'markets', exp.destinations).join(', ');
    return i18n.t('profile.exports_pct', { pct: exp.pct }) + (dest ? ' — ' + dest : '');
  }
  return null;
}

function clientLine(f, i18n) {
  const parts = [];
  if (f.client_count) parts.push(i18n.t('profile.active_clients', { n: formatNumber(f.client_count, i18n.lang) }));
  if (f.client_profiles && f.client_profiles.length) parts.push(labels(i18n, 'client_profiles', f.client_profiles).join(', '));
  return parts.join(' · ');
}

function Certifications({ f, i18n }) {
  if (!present(f.certifications)) return null;
  return html`<${Block} id="certifications" title=${i18n.t('block.certifications')}>
    <${Tags} variant="cert" items=${labels(i18n, 'certifications', f.certifications)} />
    ${present(f.certificate_numbers) && html`<p class="prose small">${i18n.t('profile.certificate_numbers')}: ${f.certificate_numbers}</p>`}
  <//>`;
}

function Description({ org, i18n, extra }) {
  if (!present(org.description) && !present(extra)) return null;
  return html`<section class="pblock" id="description">
    <div class="eyebrow">${i18n.t('block.description')}</div>
    ${present(org.description) && html`<${ReadMore} className="lead" text=${i18n.tx(org.description)} />`}
    ${present(extra) && html`<div style=${{ marginTop: '14px' }}><${ReadMore} text=${i18n.tx(extra)} /></div>`}
  </section>`;
}

function Milestones({ items, i18n }) {
  if (!present(items)) return null;
  return html`<div class="panel" id="key_milestones">
    <div class="eyebrow" style=${{ marginBottom: '20px' }}>${i18n.t('block.key_milestones')}</div>
    <div>${sortedMilestones(items).map((m, i) => {
      const st = milestoneStatus(m.period);
      return html`<div class="timeline-row" key=${i}>
        <div class="timeline-rail"><div class=${'timeline-dot ' + st}></div><div class="timeline-line"></div></div>
        <div class="timeline-content">
          <div class="timeline-head">
            <span class="timeline-date">${formatPeriod(m.period, i18n.lang)}</span>
            <span class=${'status-chip ' + st}>${i18n.t('profile.milestone_' + st)}</span>
          </div>
          <div class="timeline-text">${i18n.tx(m.description)}</div>
        </div>
      </div>`;
    })}</div>
  </div>`;
}

// ---------------------------------------------------------------- "What we're looking for" (side card 1)
function Rounds({ rounds, i18n }) {
  if (!present(rounds)) return null;
  return html`<div class="cta-rounds">${rounds.map((r, i) => html`
    <div class="cta-round" key=${i}>
      <div class="cta-value">${formatUSD(r.amount_usd, i18n.lang)}</div>
      <div class="cta-round-meta">${[i18n.label('round_stage', r.stage), formatPeriod(r.period, i18n.lang)].filter(Boolean).join(' · ')}</div>
      ${present(r.purpose) && html`<div class="cta-text">${i18n.tx(r.purpose)}</div>`}
    </div>`)}</div>`;
}

function CtaSection({ title, children }) {
  return html`<div class="cta-section"><div class="cta-label">${title}</div>${children}</div>`;
}

/** Side card 1 of every profile: Looking for + profile-specific items + "Request contact". */
export function LookingForCard({ org, project, i18n, onRequestContact, contactState }) {
  const f = project.fields;
  const t = i18n.t;
  const type = project.profile_type;
  const lookingFor = labels(i18n, 'partnership_types', org.partnership_types);
  let specific = null;
  if (type === 'A' || type === 'B') {
    specific = html`
      ${present(f.rounds) && html`<${CtaSection} title=${t('block.investment_sought')}><${Rounds} rounds=${f.rounds} i18n=${i18n} /><//>`}
      ${present(f.use_of_funds) && html`<${CtaSection} title=${t('block.use_of_funds')}><p class="cta-text">${i18n.tx(f.use_of_funds)}</p><//>`}`;
  } else if (type === 'C' || type === 'D') {
    const list = type === 'C' ? 'c_investment_types' : 'd_investment_types';
    specific = (present(f.investment_types) || present(f.investment_range)) && html`
      <${CtaSection} title=${t('block.investment_sought')}>
        ${present(f.investment_range) && html`<div class="cta-value">${formatUSDRange(f.investment_range, i18n.lang)}</div>`}
        <${Tags} variant="on-navy" items=${labels(i18n, list, f.investment_types)} />
      <//>`;
  } else {
    const list = type === 'E' ? 'e_partnership_models' : 'f_partnership_models';
    specific = html`
      ${present(f.partnership_models) && html`<${CtaSection} title=${t('block.partnership_model')}><${Tags} variant="on-navy" items=${labels(i18n, list, f.partnership_models)} /><//>`}
      ${(present(f.investment_range) || present(f.investment_description)) && html`<${CtaSection} title=${t('block.investment_sought')}>
        ${present(f.investment_range) && html`<div class="cta-value">${formatUSDRange(f.investment_range, i18n.lang)}</div>`}
        ${present(f.investment_description) && html`<p class="cta-text">${i18n.tx(f.investment_description)}</p>`}
      <//>`}`;
  }
  return html`<div class="cta-card">
    <div class="cta-title">${t('profile.looking_for_card')}</div>
    ${lookingFor.length > 0 && html`<${CtaSection} title=${t('profile.looking_for')}><${Tags} variant="on-navy" items=${lookingFor} /><//>`}
    ${specific}
    <button type="button" class="btn btn-lime btn-lg" onClick=${onRequestContact}>${t('profile.request_contact')}</button>
    ${contactState === 'sent' && html`<div class="cta-note">${t('profile.request_sent')}</div>`}
  </div>`;
}

// ---------------------------------------------------------------- per profile
function RaisedCard({ f, i18n, withRevenue }) {
  const has = present(f.raised) || f.raised_none || (withRevenue && revenueLine(f.revenue, i18n));
  if (!has) return null;
  const total = sumRaised(f.raised);
  return html`<${SideCard} title=${i18n.t('block.raised_to_date')}>
    ${f.raised_none && !present(f.raised) && html`<p>${i18n.t('profile.no_funds_raised')}</p>`}
    ${present(f.raised) && html`
      <div class="raised-total">${formatUSD(total, i18n.lang)}</div>
      <ul class="raised-list">${f.raised.map((r, i) => html`
        <li key=${i}><span>${i18n.label('raised_source', r.source)}${r.note ? ' (' + r.note + ')' : ''}</span><strong>${formatUSD(r.amount_usd, i18n.lang)}</strong></li>`)}
      </ul>`}
    ${withRevenue && revenueLine(f.revenue, i18n) && html`<p class="raised-revenue">${revenueLine(f.revenue, i18n)}</p>`}
  <//>`;
}

function TargetMarketsCard({ f, i18n }) {
  if (!present(f.target_markets)) return null;
  return html`<${SideCard} title=${i18n.t('block.target_markets')}><${Tags} items=${labels(i18n, 'markets', f.target_markets)} /><//>`;
}

function mainA(org, f, i18n) {
  const t = i18n.t;
  return [
    html`<${Description} key="d" org=${org} i18n=${i18n} />`,
    (present(f.lead_product_name) || present(f.lead_product_moa)) && html`<${Block} key="lp" id="lead_product" title=${t('block.lead_product')}>
      ${present(f.lead_product_name) && html`<div class="sub-title strong">${f.lead_product_name}</div>`}
      <${Text} value=${f.lead_product_moa} i18n=${i18n} />
    <//>`,
    present(f.pipeline) && html`<${Block} key="pl" id="pipeline" title=${t('block.pipeline')}>
      <ul class="list">${f.pipeline.map((p, i) => html`<li key=${i}><strong>${p.name}</strong>${present(p.indication) ? ' — ' + i18n.tx(p.indication) : ''}</li>`)}</ul>
    <//>`,
    (present(f.patents_filed) || present(f.patents_granted) || present(f.fto)) && html`<${Block} key="ip" id="ip_status" title=${t('block.ip_status')}>
      ${present(f.patents_filed) && html`<${Sub} title=${t('profile.patents_filed')}><${Text} value=${f.patents_filed} i18n=${i18n} /><//>`}
      ${present(f.patents_granted) && html`<${Sub} title=${t('profile.patents_granted')}><${Text} value=${f.patents_granted} i18n=${i18n} /><//>`}
      ${present(f.fto) && html`<${Sub} title=${t('profile.fto')}><p class="prose">${i18n.label('fto', f.fto)}</p><//>`}
    <//>`,
    html`<${Milestones} key="ms" items=${f.milestones} i18n=${i18n} />`,
    (present(f.gtm_models) || present(f.gtm_text)) && html`<${Block} key="gtm" id="go_to_market" title=${t('block.go_to_market')}>
      <${Tags} items=${labels(i18n, 'gtm_models', f.gtm_models)} />
      ${present(f.gtm_text) && html`<div style=${{ marginTop: '10px' }}><${Text} value=${f.gtm_text} i18n=${i18n} /></div>`}
    <//>`,
  ];
}

function mainB(org, f, i18n) {
  const t = i18n.t;
  const tagsText = (id, title, list, tags, text) => (present(tags) || present(text)) && html`<${Block} key=${id} id=${id} title=${title}>
    <${Tags} items=${labels(i18n, list, tags)} />
    ${present(text) && html`<div style=${{ marginTop: '10px' }}><${Text} value=${text} i18n=${i18n} /></div>`}
  <//>`;
  return [
    html`<${Description} key="d" org=${org} i18n=${i18n} extra=${f.platform_description} />`,
    tagsText('technology', t('block.technology'), 'technology_tags', f.technology_tags, f.technology_text),
    tagsText('business_model', t('block.business_model'), 'business_models', f.business_models, f.business_model_text),
    (present(f.traction) || revenueLine(f.revenue, i18n)) && html`<${Block} key="tr" id="traction" title=${t('block.traction')}>
      <${Text} value=${f.traction} i18n=${i18n} />
      ${revenueLine(f.revenue, i18n) && html`<p class="prose strong-line">${revenueLine(f.revenue, i18n)}</p>`}
    <//>`,
    present(f.competitive_edge) && html`<${Block} key="ce" id="competitive_edge" title=${t('block.competitive_edge')}><${Text} value=${f.competitive_edge} i18n=${i18n} /><//>`,
  ];
}

function servicesBlock(f, i18n, list) {
  return (present(f.services) || present(f.services_text)) && html`<${Block} key="sv" id="services" title=${i18n.t('block.services')}>
    <${Tags} items=${labels(i18n, list, f.services)} />
    ${present(f.services_text) && html`<div style=${{ marginTop: '10px' }}><${Text} value=${f.services_text} i18n=${i18n} /></div>`}
  <//>`;
}

function mainC(org, f, i18n) {
  const t = i18n.t;
  const facts = [clientLine(f, i18n), revenueLine(f.revenue, i18n), exportsLine(f.exports, i18n)];
  const factTitles = [t('block.client_profile'), t('block.revenue'), t('block.exports')];
  return [
    html`<${Description} key="d" org=${org} i18n=${i18n} />`,
    servicesBlock(f, i18n, 'c_services'),
    present(f.molecule_types) && html`<${Block} key="mt" id="molecule_types" title=${t('block.molecule_types')}><${Tags} items=${labels(i18n, 'molecule_types', f.molecule_types)} /><//>`,
    (present(f.capacity_scales) || present(f.utilization_pct) || present(f.capacity_text)) && html`<${Block} key="cp" id="capacity" title=${t('block.capacity')}>
      <${Tags} items=${labels(i18n, 'capacity_scale', f.capacity_scales).concat(present(f.utilization_pct) ? [t('profile.utilization', { pct: f.utilization_pct })] : [])} />
      ${present(f.capacity_text) && html`<div style=${{ marginTop: '10px' }}><${Text} value=${f.capacity_text} i18n=${i18n} /></div>`}
    <//>`,
    html`<${Certifications} key="ct" f=${f} i18n=${i18n} />`,
    facts.some(Boolean) && html`<${Block} key="cl" id="client_profile" title=${factTitles.filter((_, i) => facts[i]).join(' / ')}>
      <dl class="kv">${facts.map((v, i) => v && html`<${Fact} key=${i} k=${factTitles[i]} v=${v} />`)}</dl>
    <//>`,
    present(f.expansion_plan) && html`<${Block} key="ep" id="expansion_plan" title=${t('block.expansion_plan')}><${Text} value=${f.expansion_plan} i18n=${i18n} /><//>`,
  ];
}

const Fact = ({ k, v }) => html`<dt>${k}</dt><dd>${v}</dd>`;

function mainD(org, f, i18n) {
  const t = i18n.t;
  const money = [revenueLine(f.revenue, i18n), exportsLine(f.exports, i18n)];
  const moneyTitles = [t('block.revenue'), t('block.exports')];
  return [
    html`<${Description} key="d" org=${org} i18n=${i18n} />`,
    servicesBlock(f, i18n, 'd_services'),
    (present(f.therapeutic_areas) || present(f.scope_text)) && html`<${Block} key="ta" id="therapeutic_areas" title=${t('block.therapeutic_areas')}>
      <${Tags} items=${labels(i18n, 'therapeutic_areas', f.therapeutic_areas)} />
      ${present(f.scope_text) && html`<div style=${{ marginTop: '10px' }}><${Text} value=${f.scope_text} i18n=${i18n} /></div>`}
    <//>`,
    present(f.models) && html`<${Block} key="md" id="models" title=${t('block.models')}><${Text} value=${f.models} i18n=${i18n} /><//>`,
    html`<${Certifications} key="ct" f=${f} i18n=${i18n} />`,
    present(f.partner_sites) && html`<${Block} key="ps" id="partner_sites" title=${t('block.partner_sites')}>
      <ul class="list">${f.partner_sites.map((s, i) => html`<li key=${i}>${i18n.tx(s)}</li>`)}</ul>
    <//>`,
    clientLine(f, i18n) && html`<${Block} key="cl" id="client_profile" title=${t('block.client_profile')}><p class="prose">${clientLine(f, i18n)}</p><//>`,
    money.some(Boolean) && html`<${Block} key="re" id="revenue" title=${moneyTitles.filter((_, i) => money[i]).join(' / ')}>
      <dl class="kv">${money.map((v, i) => v && html`<${Fact} key=${i} k=${moneyTitles[i]} v=${v} />`)}</dl>
    <//>`,
  ];
}

function mainE(org, f, i18n) {
  const t = i18n.t;
  return [
    html`<${Description} key="d" org=${org} i18n=${i18n} />`,
    present(f.product_portfolio) && html`<${Block} key="pp" id="product_portfolio" title=${t('block.product_portfolio')}>
      <ul class="list">${f.product_portfolio.map((p, i) => html`<li key=${i}><strong>${i18n.tx(p.category)}</strong>${present(p.description) ? ' — ' + i18n.tx(p.description) : ''}</li>`)}</ul>
    <//>`,
    present(f.production_capacity) && html`<${Block} key="pc" id="production_capacity" title=${t('block.production_capacity')}><${Text} value=${f.production_capacity} i18n=${i18n} /><//>`,
    (present(f.export_markets) || present(f.export_markets_text)) && html`<${Block} key="em" id="export_markets" title=${t('block.export_markets')}>
      <${Tags} items=${labels(i18n, 'markets', f.export_markets)} />
      ${present(f.export_markets_text) && html`<div style=${{ marginTop: '10px' }}><${Text} value=${f.export_markets_text} i18n=${i18n} /></div>`}
    <//>`,
    html`<${Certifications} key="ct" f=${f} i18n=${i18n} />`,
    present(f.partnership_interests) && html`<div key="pi" class="panel highlight" id="partnership_interests">
      <div class="eyebrow" style=${{ marginBottom: '14px' }}>${t('block.partnership_interests')}</div>
      <div class="interest-grid">${f.partnership_interests.map((p, i) => html`
        <div class="interest" key=${i}><div class="sub-title strong">${i18n.tx(p.area)}</div><div class="timeline-text">${i18n.tx(p.description)}</div></div>`)}
      </div>
    </div>`,
    present(f.expansion_projects) && html`<${Block} key="ex" id="expansion_projects" title=${t('block.expansion_projects')}><${Text} value=${f.expansion_projects} i18n=${i18n} /><//>`,
  ];
}

function mainF(org, f, i18n) {
  const t = i18n.t;
  const share = f.market_share && present(f.market_share.pct) ? t('profile.market_share_value', { pct: f.market_share.pct, segment: i18n.tx(f.market_share.segment) }) : null;
  const facts = [share, revenueLine(f.revenue, i18n), exportsLine(f.exports, i18n)];
  const titles = [t('block.market_share'), t('block.revenue'), t('block.exports')];
  return [
    html`<${Description} key="d" org=${org} i18n=${i18n} />`,
    (present(f.products) || present(f.products_text)) && html`<${Block} key="pr" id="products" title=${t('block.products')}>
      ${present(f.products) && html`<ul class="list" style=${{ marginTop: 0 }}>${f.products.map((p, i) => html`<li key=${i}>${i18n.tx(p)}</li>`)}</ul>`}
      ${present(f.products_text) && html`<div style=${{ marginTop: '10px' }}><${Text} value=${f.products_text} i18n=${i18n} /></div>`}
    <//>`,
    (present(f.markets_served) || present(f.markets_text)) && html`<${Block} key="mk" id="markets" title=${t('block.markets')}>
      <${Tags} items=${labels(i18n, 'markets', f.markets_served)} />
      ${present(f.markets_text) && html`<div style=${{ marginTop: '10px' }}><${Text} value=${f.markets_text} i18n=${i18n} /></div>`}
    <//>`,
    html`<${Certifications} key="ct" f=${f} i18n=${i18n} />`,
    facts.some(Boolean) && html`<${Block} key="ms" id="market_share" title=${titles.filter((_, i) => facts[i]).join(' / ')}>
      <dl class="kv">${facts.map((v, i) => v && html`<${Fact} key=${i} k=${titles[i]} v=${v} />`)}</dl>
    <//>`,
    present(f.expansion_strategy) && html`<${Block} key="es" id="expansion_strategy" title=${t('block.expansion_strategy')}><${Text} value=${f.expansion_strategy} i18n=${i18n} /><//>`,
  ];
}

/** Main column blocks (2/3 width), in the order of table 6.3. */
export function mainBlocks(org, project, i18n) {
  const f = project.fields;
  const fn = { A: mainA, B: mainB, C: mainC, D: mainD, E: mainE, F: mainF }[project.profile_type];
  return fn(org, f, i18n).filter(Boolean);
}

/** Side column cards after "What we're looking for", in the order of table 6.3. */
export function otherSideCards(org, project, i18n) {
  const f = project.fields;
  switch (project.profile_type) {
    case 'A': return [html`<${RaisedCard} key="r" f=${f} i18n=${i18n} withRevenue=${true} />`, html`<${TargetMarketsCard} key="m" f=${f} i18n=${i18n} />`];
    case 'B': return [html`<${RaisedCard} key="r" f=${f} i18n=${i18n} />`];
    case 'C':
    case 'D': return [html`<${TargetMarketsCard} key="m" f=${f} i18n=${i18n} />`];
    default: return [];
  }
}
