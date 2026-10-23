const color = { navy: '151D3B', blue: '00657C', lime: 'C9EB20', pale: 'F2F6FA', white: 'FFFFFF', muted: '6B7890' };
const iso = (value) => value ? new Date(value).toISOString().slice(0, 10) : '';
const inRange = (value, from, to) => Boolean(value && value >= from && value <= to);

export async function exportCrmWorkbook({ rows, lang, from, to, filters, label }) {
  if (!window.ExcelJS) throw new Error('ExcelJS unavailable');
  const en = lang === 'en';
  const name = (pt, english) => en ? english : pt;
  const book = new window.ExcelJS.Workbook();
  book.creator = 'Companies Portfolio';
  book.created = new Date();
  const sheet = book.addWorksheet(name('Contatos do CRM', 'CRM contacts'), {
    views: [{ state: 'frozen', ySplit: 9 }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = [
    { width: 27 }, { width: 33 }, { width: 29 }, { width: 26 }, { width: 24 },
    { width: 20 }, { width: 20 }, { width: 17 }, { width: 18 }, { width: 18 },
    { width: 18 }, { width: 17 }, { width: 16 },
  ];
  sheet.mergeCells('A1:M2');
  const title = sheet.getCell('A1');
  title.value = name('CRM · Contatos e atividades', 'CRM · Contacts and activity');
  title.font = { name: 'Aptos Display', size: 20, bold: true, color: { argb: color.white } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.navy } };
  title.alignment = { vertical: 'middle', indent: 1 };
  for (const row of [1, 2]) { sheet.getRow(row).height = 23; for (let c = 1; c <= 13; c++) sheet.getRow(row).getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.navy } }; }
  sheet.mergeCells('A3:M3');
  sheet.getCell('A3').value = `${name('Período', 'Period')}: ${from} – ${to}   ·   ${name('Registros', 'Records')}: ${rows.length}`;
  sheet.getCell('A3').font = { bold: true, color: { argb: color.blue }, size: 11 };
  sheet.getRow(3).height = 25;
  const details = [
    [name('Empresa', 'Company'), filters.company], [name('Origem', 'Source'), filters.origin],
    [name('Fase', 'Stage'), filters.phase], [name('Dados', 'Data'), filters.demo],
    [name('Busca', 'Search'), filters.search], [name('Filtro do gráfico', 'Chart filter'), filters.chart],
  ];
  details.forEach(([key, value], index) => {
    const r = 4 + Math.floor(index / 3), c = 1 + index % 3 * 4;
    sheet.mergeCells(r, c, r, c + 1);
    sheet.mergeCells(r, c + 2, r, c + 3);
    const k = sheet.getCell(r, c), v = sheet.getCell(r, c + 2);
    k.value = key; v.value = value || name('Todos', 'All');
    k.font = { bold: true, color: { argb: color.navy } };
    v.font = { color: { argb: color.muted } };
    sheet.getRow(r).height = 21;
  });
  sheet.mergeCells('A7:M7');
  sheet.getCell('A7').value = name('A planilha contém somente os contatos exibidos pelos filtros acima. As interações são contadas dentro do período selecionado.',
    'This workbook contains only contacts shown by the filters above. Interactions are counted within the selected period.');
  sheet.getCell('A7').font = { italic: true, color: { argb: color.muted }, size: 10 };
  sheet.getRow(7).height = 24;
  const headers = en
    ? ['Contact', 'Email', 'Institution', 'Company', 'Responsible', 'Source', 'Stage', 'Status', 'Created at', 'Last activity', 'Interactions', 'Website request', 'Demo']
    : ['Contato', 'E-mail', 'Instituição', 'Empresa', 'Responsável', 'Origem', 'Fase', 'Situação', 'Criado em', 'Última atividade', 'Interações', 'Pedido pelo site', 'Demonstração'];
  const header = sheet.getRow(9);
  header.values = headers;
  header.height = 29;
  header.eachCell((cell) => {
    cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: color.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.blue } };
    cell.alignment = { vertical: 'middle', indent: 1 };
  });
  rows.forEach((item, index) => {
    const activity = (item.interactions || []).filter((it) => inRange(it.date, from, to));
    const last = activity.map((it) => it.date).sort().at(-1) || '';
    const rel = item.relationship;
    const record = sheet.getRow(10 + index);
    record.values = [item.contact.name, item.contact.email, item.institution.name, item.organization_name,
      rel.owner_name || name('Não atribuído', 'Unassigned'), rel.origin || '', label('classification', rel.classification),
      label('rel_status', rel.status), iso(rel.created_at), last, activity.length,
      rel.origin === 'Portfólio' ? name('Sim', 'Yes') : name('Não', 'No'), rel.is_demo ? 'DEMO' : ''];
    record.height = 25;
    record.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: 'Aptos', size: 10, color: { argb: color.navy } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 ? color.pale : color.white } };
      cell.alignment = { vertical: 'middle', indent: 1 };
      cell.border = { bottom: { style: 'hair', color: { argb: 'DCE5EC' } } };
    });
  });
  sheet.autoFilter = { from: 'A9', to: `M${Math.max(9, 9 + rows.length)}` };
  sheet.printTitlesRow = '1:9';
  const buffer = await book.xlsx.writeBuffer();
  const file = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `crm-${from}-${to}.xlsx`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
