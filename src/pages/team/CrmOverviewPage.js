import { html, useEffect, useMemo, useState } from '../../lib/html.js';
import * as api from '../../services/api.js';
import { useI18n } from '../../lib/i18n.js';
import { href } from '../../lib/router.js';
import { exportCrmPdf } from '../../lib/crmPdf.js?v=20261014-crm-nobanner3';
import { ContactTable, useContactRows } from '../crm/ContactsListPage.js?v=20261014-crm-nobanner3';

const date = (value) => value ? new Date(value).toISOString().slice(0, 10) : '';
const today = () => date(new Date());
const ago = (days) => { const value = new Date(); value.setDate(value.getDate() - days); return date(value); };
const within = (value, from, to) => Boolean(value && value >= from && value <= to);
const meetings = new Set(['in_person_meeting', 'virtual_meeting']);
const phases = ['lead', 'nia', 'npia', 'br', 'incomplete'];

function totals(items) {
  const map = new Map();
  for (const item of items) map.set(item || 'Não informado', (map.get(item || 'Não informado') || 0) + 1);
  return [...map].sort((a, b) => b[1] - a[1]);
}

function BarChart({ title, description, items, selected, onSelect }) {
  const { lang } = useI18n();
  const max = Math.max(1, ...items.map((item) => item[1]));
  return html`<section class="crm-viz-card">${title && html`<h2>${title}</h2>`}${description && html`<p>${description}</p>`}<div class="crm-bars">
    ${items.length ? items.map(([key, value, caption]) => html`<button type="button" key=${key} disabled=${!onSelect}
      class=${selected === key ? 'crm-bar-row selected' : 'crm-bar-row'} aria-pressed=${onSelect ? selected === key : undefined}
      title=${`${caption || key}: ${value}`} onClick=${() => onSelect?.(selected === key ? '' : key)}>
      <span>${caption || key}</span><span class="crm-bar-track"><i style=${{ width: `${value / max * 100}%` }}></i></span><strong>${value}</strong></button>`)
    : html`<span class="crm-empty">${lang === 'en' ? 'No data in this period.' : 'Sem dados neste período.'}</span>`}</div></section>`;
}

function exportCsv(rows, lang) {
  const header = lang === 'en' ? ['Contact','Email','Institution','Company','Source','Stage','Status','Created at','Last interaction','Interactions','Demo']
    : ['Contato','E-mail','Instituição','Empresa','Origem','Fase','Situação','Criado em','Última interação','Interações','Demonstração'];
  const lines = [header, ...rows.map((r) => [r.contact.name,r.contact.email,r.institution.name,r.organization_name,r.relationship.origin,
    r.relationship.classification,r.relationship.status,date(r.relationship.created_at),date(r.last_interaction),r.interaction_count,r.relationship.is_demo ? 'DEMO' : ''])];
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const blob = new Blob(['\ufeff' + lines.map((row) => row.map(quote).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `crm-contatos-${today()}.csv`;
  document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CrmOverviewPage({ team = true }) {
  const { t, label, lang } = useI18n();
  const L = (pt, en) => lang === 'en' ? en : pt;
  const [data, reloadRows] = useContactRows();
  const [summary, setSummary] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [period, setPeriod] = useState('year');
  const [custom, setCustom] = useState({ from: ago(29), to: today() });
  const [filter, setFilter] = useState({ company:'', origin:'', phase:'', demo:'all', search:'' });
  const [selected, setSelected] = useState({});
  const [metric, setMetric] = useState('new');
  const [limit, setLimit] = useState(25);
  const [error, setError] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const refresh = () => (team ? Promise.all([api.getCrmDashboard(new Date().getFullYear()), api.listDuplicateCandidates(), reloadRows()])
    : Promise.all([Promise.resolve({ queue: [] }), Promise.resolve([]), reloadRows()]))
    .then(([dashboard, found]) => { setSummary(dashboard); setDuplicates(found); setError(''); })
    .catch(() => setError(L('Não foi possível carregar os dados do CRM.', 'Could not load CRM data.')));
  useEffect(() => { refresh(); }, []);

  const rows = data?.rows || [];
  const [from, to] = period === 'custom' ? [custom.from, custom.to] : period === 'year'
    ? [`${new Date().getFullYear()}-01-01`, today()] : [ago(period === 'today' ? 0 : Number(period) - 1), today()];
  const companies = useMemo(() => [...new Map(rows.map((r) => [r.relationship.organization_id, r.organization_name])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1])), [rows]);
  const origins = useMemo(() => [...new Set(rows.map((r) => r.relationship.origin).filter(Boolean))].sort(), [rows]);
  const rangeRows = rows.filter((r) => (!filter.company || r.relationship.organization_id === filter.company)
    && (!filter.origin || r.relationship.origin === filter.origin)
    && (!filter.phase || r.relationship.classification === filter.phase)
    && (filter.demo === 'all' || Boolean(r.relationship.is_demo) === (filter.demo === 'demo'))
    && (!selected.phase || r.relationship.classification === selected.phase)
    && (!selected.origin || r.relationship.origin === selected.origin)
    && (!selected.status || r.relationship.status === selected.status)
    && (!selected.investor || (r.institution.investor_type || 'Não informado') === selected.investor)
    && (!selected.type || (r.interactions || []).some((i) => (i.type || 'Não informado') === selected.type && within(i.date, from, to)))
    && (!selected.sla || (r.pending_request ? r.pending_request.business_days > (data?.deadlines?.contact_overdue_business_days || 15) ? 'overdue'
      : r.pending_request.business_days >= (data?.deadlines?.contact_warning_business_days || 10) ? 'warning' : 'on_time' : 'none') === selected.sla)
    && (within(date(r.relationship.created_at), from, to) || (r.interactions || []).some((i) => within(i.date, from, to))));
  const active = rangeRows.filter((r) => !selected.bucket || within(date(r.relationship.created_at), selected.bucket.from, selected.bucket.to)
    || (r.interactions || []).some((i) => within(i.date, selected.bucket.from, selected.bucket.to)));
  const measureFrom = selected.bucket?.from || from;
  const measureTo = selected.bucket?.to || to;
  const found = active.filter((r) => !filter.search || [r.contact.name,r.contact.email,r.institution.name,r.organization_name]
    .some((value) => String(value || '').toLowerCase().includes(filter.search.toLowerCase())));
  const interactions = active.flatMap((r) => (r.interactions || []).filter((i) => within(i.date, measureFrom, measureTo)));
  const fresh = active.filter((r) => within(date(r.relationship.created_at), measureFrom, measureTo));
  const activityInteractions = rangeRows.flatMap((r) => (r.interactions || []).filter((i) => within(i.date, from, to)));
  const activityFresh = rangeRows.filter((r) => within(date(r.relationship.created_at), from, to));
  const pending = active.filter((r) => r.pending_request);
  const overdueDays = data?.deadlines?.contact_overdue_business_days || 15;
  const warningDays = data?.deadlines?.contact_warning_business_days || 10;
  const overdue = pending.filter((r) => r.pending_request.business_days > overdueDays).length;
  const warning = pending.filter((r) => r.pending_request.business_days >= warningDays && r.pending_request.business_days <= overdueDays).length;
  const days = from && to && from <= to ? Math.min(730, Math.floor((new Date(to) - new Date(from)) / 86400000) + 1) : 0;
  const step = days > 120 ? 30 : days > 45 ? 7 : 1;
  const activity = [];
  for (let index = 0; index < days; index += step) {
    const first = date(new Date(new Date(from).getTime() + index * 86400000));
    const last = date(new Date(new Date(from).getTime() + Math.min(days - 1, index + step - 1) * 86400000));
    const during = activityInteractions.filter((i) => within(i.date, first, last));
    activity.push({ from: first, to: last, label: first === last ? first.slice(5) : `${first.slice(5)}–${last.slice(5)}`,
      new: activityFresh.filter((r) => within(date(r.relationship.created_at), first, last)).length,
      inter: during.length, meet: during.filter((i) => meetings.has(i.type)).length,
      site: activityFresh.filter((r) => r.relationship.origin === 'Portfólio' && within(date(r.relationship.created_at), first, last)).length });
  }
  const maxActivity = Math.max(1, ...activity.map((item) => item[metric]));
  const activityName = { new:L('Novos contatos','New contacts'), inter:L('Interações','Interactions'),
    meet:L('Reuniões','Meetings'), site:L('Pedidos pelo site','Website requests') }[metric];
  const activityTotal = activity.reduce((sum, item) => sum + item[metric], 0);
  const activityInterval = step === 1 ? L('dia','day') : step === 7 ? L('semana','week') : L('mês','month');
  const activityCaption = L(`Cada coluna mostra ${activityName.toLowerCase()} por ${activityInterval}. Clique em uma coluna para filtrar o painel.`,
    `Each column shows ${activityName.toLowerCase()} per ${activityInterval}. Click a column to filter the dashboard.`);
  const pick = (key) => (value) => setSelected((current) => ({ ...current, [key]: value }));
  const pickBucket = (item) => setSelected((current) => ({ ...current,
    bucket: current.bucket?.from === item.from ? null : { from: item.from, to: item.to } }));
  const change = (key, value) => { setFilter({ ...filter, [key]: value }); setLimit(25); };
  const metrics = [[L('Novos contatos','New contacts'), fresh.length],[L('Interações','Interactions'),interactions.length],
    [L('Reuniões','Meetings'),interactions.filter((i) => meetings.has(i.type)).length],
    [L('Pedidos pelo site','Website requests'),fresh.filter((r) => r.relationship.origin === 'Portfólio').length],
    [L('Em atenção','Needs attention'),warning],[L('Atrasados','Overdue'),overdue]];
  const generatePdf = async () => {
    setPdfBusy(true);
    try {
      await exportCrmPdf({ lang, from: measureFrom, to: measureTo,
        company: companies.find(([id]) => id === filter.company)?.[1] || L('Todas as empresas','All companies'),
        metrics, activity, metric,
        activityTitle: L('Atividade no período','Activity over time'), activityName, activityInterval,
        chartTitles: { phases:L('Fases','Stages'), status:L('Situação','Status'), sla:L('Prazo de retorno','Response time'),
          origins:L('Origens','Sources'), types:L('Tipos de interação','Interaction types'),
          investors:L('Perfil do investidor','Investor profile'), companies:L('Contatos por empresa','Contacts by company') },
        charts: {
          phases:phases.map((phase) => [label('classification',phase),active.filter((r) => r.relationship.classification === phase).length]),
          status:totals(active.map((r) => r.relationship.status)).map(([key,value]) => [label('rel_status',key),value]),
          sla:[[L('Em dia','On time'),pending.length-warning-overdue],[L('Em atenção','Needs attention'),warning],[L('Atrasado','Overdue'),overdue]],
          origins:totals(fresh.map((r) => r.relationship.origin)),
          types:totals(interactions.map((i) => i.type)).map(([key,value]) => [key === 'Não informado' ? L('Não informado','Not provided') : label('interaction_types',key),value]),
          investors:totals(active.map((r) => r.institution.investor_type)).map(([key,value]) => [key === 'Não informado' ? L('Não informado','Not provided') : label('investor_types',key),value]),
        },
        companies:companies.map(([id,name]) => [name,active.filter((r) => r.relationship.organization_id === id).length]),
      });
    } catch { setError(L('Não foi possível gerar o PDF. Tente novamente.','Could not create the PDF. Please try again.')); }
    finally { setPdfBusy(false); }
  };
  const merge = async (item) => {
    try { if (item.kind === 'contact') await api.mergeContacts(item.a.id, item.b.id);
      else await api.mergeInstitutions(item.a.id, item.b.id); refresh(); }
    catch { setError(L('Não foi possível unir os registros.', 'Could not merge the records.')); }
  };
  if (!data || !summary) return html`<div>${error || t('common.loading')}</div>`;

  return html`<div class="crm-page crm-dashboard">
    <div class="crm-sticky"><div><h1 class="page-title">CRM · Dashboard</h1><div class="page-subtitle">${team ? L('Contatos, atividades e oportunidades do programa','Program contacts, activities and opportunities') : L('Contatos e atividades da empresa','Company contacts and activities')}</div></div>
      <div class="review-actions"><button type="button" class="btn btn-outline crm-no-print" disabled=${pdfBusy} onClick=${generatePdf}>${pdfBusy ? L('Gerando PDF...','Creating PDF...') : L('Exportar PDF','Export PDF')}</button>
        <button type="button" class="btn btn-outline crm-no-print" onClick=${() => exportCsv(found, lang)}>${L('Exportar CSV','Export CSV')}</button>
        <a class="btn btn-lime btn-lg" href=${href(team ? '/team/crm/new' : '/company/contacts/new')}>+ ${L('Adicionar contato','Add contact')}</a></div></div>
    ${error && html`<div class="notice">${error}</div>`}
    <p class="crm-print-context">${L('Período','Period')}: ${selected.bucket?.from || from} – ${selected.bucket?.to || to} · ${L('Empresa','Company')}: ${companies.find(([id]) => id === filter.company)?.[1] || L('Todas','All')} · ${L('Dados','Data')}: ${filter.demo === 'demo' ? 'DEMO' : filter.demo === 'real' ? L('Reais','Real') : L('Todos','All')}</p>
    <section class="crm-viz-filters"><div class="crm-periods">${[['today',L('Hoje','Today')],['7',L('7 dias','7 days')],['30',L('30 dias','30 days')],['90',L('90 dias','90 days')],['year',L('Este ano','This year')],['custom',L('Personalizado','Custom')]]
      .map(([key, name]) => html`<button type="button" key=${key} class=${period === key ? 'active' : ''} onClick=${() => { setPeriod(key); pick('bucket')(null); }}>${name}</button>`)}</div>
      ${period === 'custom' && html`<label>${L('De','From')} <input type="date" value=${custom.from} onChange=${(e) => setCustom({ ...custom, from: e.target.value })} /></label>
        <label>${L('Até','To')} <input type="date" value=${custom.to} onChange=${(e) => setCustom({ ...custom, to: e.target.value })} /></label>`}
      ${team && html`<label>${L('Empresa','Company')} <select value=${filter.company} onChange=${(e) => change('company', e.target.value)}><option value="">${L('Todas','All')}</option>
        ${companies.map(([id, name]) => html`<option key=${id} value=${id}>${name}</option>`)}</select></label>`}
      <label>${L('Origem','Source')} <select value=${filter.origin} onChange=${(e) => change('origin', e.target.value)}><option value="">${L('Todas','All')}</option>
        ${origins.map((origin) => html`<option key=${origin} value=${origin}>${origin}</option>`)}</select></label>
      <label>${L('Fase','Stage')} <select value=${filter.phase} onChange=${(e) => change('phase', e.target.value)}><option value="">${L('Todas','All')}</option>
        ${phases.map((phase) => html`<option key=${phase} value=${phase}>${label('classification', phase)}</option>`)}</select></label>
      <label>${L('Dados','Data')} <select value=${filter.demo} onChange=${(e) => change('demo', e.target.value)}>
        <option value="all">${L('Todos','All')}</option><option value="real">${L('Somente reais','Real only')}</option><option value="demo">${L('Somente demo','Demo only')}</option></select></label></section>
    ${Object.values(selected).some(Boolean) && html`<div class="crm-cross">${L('Filtro de gráfico ativo','Chart filter active')} <button type="button" onClick=${() => setSelected({})}>${L('Limpar filtros','Clear filters')}</button></div>`}
    <section class="crm-viz-kpis">${metrics.map(([name, value]) => html`<div class="crm-viz-kpi" key=${name}><strong>${value}</strong><span>${name}</span></div>`)}</section>
    <section class="crm-viz-card"><div class="crm-viz-head"><div><h2>${L('Atividade no período','Activity over time')}</h2><p>${activityCaption}</p></div>
      <div class="crm-periods">${[['new',L('Novos','New')],['inter',L('Interações','Interactions')],['meet',L('Reuniões','Meetings')],['site',L('Pedidos pelo site','Website requests')]]
        .map(([key, name]) => html`<button type="button" key=${key} class=${metric === key ? 'active' : ''} onClick=${() => setMetric(key)}>${name}</button>`)}</div></div>
      <div class="crm-activity-summary"><strong>${activityName}: ${activityTotal}</strong><span>${L('De','From')} ${from} ${L('até','to')} ${to} · ${L('Intervalo','Interval')}: ${activityInterval}</span></div>
      ${activityTotal ? html`<div class="crm-activity-scroll"><div class="crm-activity-chart" style=${{minWidth:`${Math.max(480,activity.length * (step === 1 ? 40 : 76))}px`}}>
        <div class="crm-activity-axis" aria-hidden="true"><span>${maxActivity}</span><span>${maxActivity / 2}</span><span>0</span></div>
        <div class="crm-activity-plot" role="group" aria-label=${`${activityName} ${L('por','per')} ${activityInterval}`}>
          <div class="crm-activity-grid" aria-hidden="true"><i></i><i></i><i></i></div>
          ${activity.map((item, index) => { const barHeight = item[metric] / maxActivity * 136;
            const showDate = activity.length <= (step === 1 ? 7 : 12) || index === 0 || index === activity.length - 1
              || index % Math.ceil(activity.length / (step === 1 ? 7 : 12)) === 0;
            return html`<button type="button" class=${selected.bucket?.from === item.from ? 'crm-activity-col selected' : 'crm-activity-col'} key=${index}
              title=${`${item.from} – ${item.to}: ${item[metric]} ${activityName.toLowerCase()}`}
              aria-label=${`${item.from} – ${item.to}: ${item[metric]} ${activityName.toLowerCase()}`}
              aria-pressed=${selected.bucket?.from === item.from} onClick=${() => pickBucket(item)}>
              <strong class="crm-activity-value" style=${{bottom:`${34 + barHeight}px`}}>${item[metric]}</strong>
              ${item[metric] > 0 && html`<span class="crm-activity-fill" style=${{height:`${barHeight}px`}}></span>`}
              <span class="crm-activity-date">${showDate ? item.label : ''}</span></button>`; })}
        </div></div></div>` : html`<p class="crm-activity-empty">${L(`Nenhum registro de ${activityName.toLowerCase()} neste período.`,
          `No ${activityName.toLowerCase()} recorded in this period.`)}</p>`}
      <details><summary>${L('Ver dados em tabela','View data as a table')}</summary><div class="crm-activity-table"><strong>${L('Período','Period')}</strong><strong>${L('Novos','New')}</strong><strong>${L('Interações','Interactions')}</strong><strong>${L('Reuniões','Meetings')}</strong><strong>${L('Pedidos','Requests')}</strong>
        ${activity.map((item, index) => html`<div key=${index}>${item.label}</div><div>${item.new}</div><div>${item.inter}</div><div>${item.meet}</div><div>${item.site}</div>`)}</div></details></section>
    <div class="crm-viz-grid two"><${BarChart} title=${L('Fases · classificação Apex','Stages · Apex classification')} description=${L('Contatos ativos no período. Clique para filtrar.','Active contacts in this period. Click to filter.')}
      items=${phases.map((phase) => [phase, active.filter((r) => r.relationship.classification === phase).length, label('classification', phase)])}
      selected=${selected.phase} onSelect=${pick('phase')} />
      <section class="crm-viz-card"><h2>${L('Situação e prazos','Status and deadlines')}</h2><p>${L('Prazo de retorno em dias úteis.','Response time in business days.')}</p>
        <div class="crm-viz-subtitle">${L('Prazo de retorno','Response time')}</div><${BarChart} title="" selected=${selected.sla} onSelect=${pick('sla')}
          items=${[['on_time',pending.length-warning-overdue,L('Em dia','On time')],['warning',warning,L('Em atenção','Needs attention')],['overdue',overdue,L('Atrasado','Overdue')]]} />
        <div class="crm-viz-subtitle">${L('Situação do relacionamento','Relationship status')}</div><${BarChart} title="" items=${totals(active.map((r) => r.relationship.status)).map(([key,value]) => [key,value,label('rel_status',key)])}
          selected=${selected.status} onSelect=${pick('status')} /></section></div>
    <div class="crm-viz-grid three"><${BarChart} title=${L('Origem dos novos contatos','Source of new contacts')} description=${L('Contatos cadastrados no período.','Contacts created in this period.')}
      items=${totals(fresh.map((r) => r.relationship.origin)).map(([key,value]) => [key,value,key === 'Não informado' ? L('Não informado','Not provided') : key])} selected=${selected.origin} onSelect=${pick('origin')} />
      <${BarChart} title=${L('Tipos de interação','Interaction types')} description=${L('Interações realizadas no período.','Interactions recorded in this period.')}
        items=${totals(interactions.map((i) => i.type)).map(([key,value]) => [key,value,key === 'Não informado' ? L('Não informado','Not provided') : label('interaction_types',key)])}
        selected=${selected.type} onSelect=${pick('type')} />
      <${BarChart} title=${L('Perfil do investidor','Investor profile')} description=${L('Contatos ativos no período.','Active contacts in this period.')}
        items=${totals(active.map((r) => r.institution.investor_type)).map(([key,value]) => [key,value,key === 'Não informado' ? L('Não informado','Not provided') : label('investor_types',key)])}
        selected=${selected.investor} onSelect=${pick('investor')} /></div>
    ${team && html`<section class="crm-viz-card"><h2>${L('Por empresa','By company')}</h2><p>${L('Inclui contatos diretos do programa, sem vínculo com o portfólio.','Includes direct program contacts not linked to a portfolio company.')}</p>
      <div class="crm-company-summary"><div class="head"><span>${L('Empresa','Company')}</span><span>${L('Contatos','Contacts')}</span><span>${L('Novos','New')}</span><span>${L('Interações','Interactions')}</span><span>${L('Reuniões','Meetings')}</span></div>
        ${companies.map(([id,name]) => { const group = active.filter((r) => r.relationship.organization_id === id);
          const events = group.flatMap((r) => (r.interactions || []).filter((i) => within(i.date, measureFrom, measureTo)));
          return html`<button type="button" key=${id} onClick=${() => change('company', filter.company === id ? '' : id)}>
            <span>${name}</span><span>${group.length}</span><span>${group.filter((r) => within(date(r.relationship.created_at), measureFrom, measureTo)).length}</span>
            <span>${events.length}</span><span>${events.filter((i) => meetings.has(i.type)).length}</span></button>`; })}</div></section>`}
    <section class="crm-viz-card crm-print-hide"><div class="crm-viz-head"><div><h2>${L('Tabela de contatos','Contact table')} (${found.length})</h2><p>${L('Contatos criados ou com interação no período.','Contacts created or interacted with in this period.')}</p></div>
      <input class="input input-sm" type="search" placeholder=${L('Buscar contato, e-mail ou instituição','Search contact, email or institution')} value=${filter.search}
        onInput=${(e) => change('search', e.target.value)} /></div>
      <div class="crm-table-scroll"><${ContactTable} rows=${found.slice(0, limit)} base=${team ? '/team/crm' : '/company/contacts'} team=${team} /></div>
      ${found.length > limit && html`<button type="button" class="btn btn-outline" onClick=${() => setLimit(limit + 25)}>${L('Mostrar mais contatos','Show more contacts')}</button>`}</section>
    ${team && html`<section class="crm-viz-card crm-print-hide"><h2>${L('Validações pendentes','Pending reviews')} (${summary.queue.length + duplicates.length})</h2>
      ${!summary.queue.length && !duplicates.length && html`<p>${L('Nenhuma validação pendente.','No pending reviews.')}</p>`}
      ${summary.queue.map((item) => html`<a class="crm-pending-row" key=${item.kind + item.relationship_id} href=${href('/team/crm/' + item.relationship_id)}>
        <strong>${item.contact_name}</strong><span>${item.organization_name || 'Programa Abiquifi'}</span><span>${item.kind === 'npia' ? 'NPIA' : L('Classificação','Classification')}</span></a>`)}
      ${duplicates.map((item,index) => html`<div class="crm-pending-row" key=${index}><strong>${item.a.name}</strong>
        <span>${L('Possível duplicado:','Possible duplicate:')} ${item.b.name}</span><button type="button" class="btn btn-outline" onClick=${() => merge(item)}>${L('Unir registros','Merge records')}</button></div>`)}</section>`}
  </div>`;
}
