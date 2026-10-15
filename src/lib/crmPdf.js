// Download a vector PDF of the currently filtered CRM dashboard.
// jsPDF is bundled locally and loaded only when export is requested.
let libraryPromise;

function loadLibrary() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (!libraryPromise) libraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('vendor/jspdf.umd.min.js', document.baseURI).href;
    script.onload = () => window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error('PDF library unavailable'));
    script.onerror = () => reject(new Error('PDF library unavailable'));
    document.head.append(script);
  }).catch((error) => { libraryPromise = null; throw error; });
  return libraryPromise;
}

const ink = [10, 42, 66];
const blue = [0, 99, 124];
const lime = [190, 217, 15];
const muted = [86, 112, 132];
const pale = [237, 244, 247];
const edge = [216, 227, 232];

function text(doc, value, x, y, size = 9, color = ink, bold = false, options) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text(Array.isArray(value) ? value.map(String) : String(value ?? ''), x, y, options);
}

function card(doc, x, y, width, height) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...edge);
  doc.roundedRect(x, y, width, height, 2, 2, 'FD');
}

function panel(doc, x, y, width, height, title, items) {
  card(doc, x, y, width, height);
  text(doc, title, x + 5, y + 8, 11, ink, true);
  const shown = items.filter((item) => item[1] > 0).slice(0, 7);
  if (!shown.length) { text(doc, '—', x + 5, y + 20, 10, muted); return; }
  const max = Math.max(1, ...shown.map((item) => item[1]));
  const rowHeight = Math.min(9, (height - 19) / shown.length);
  shown.forEach(([label, value], index) => {
    const rowY = y + 17 + index * rowHeight;
    const caption = doc.splitTextToSize(String(label), width * .35)[0] || '';
    text(doc, caption, x + 5, rowY, 8, muted);
    const trackX = x + width * .43;
    const trackWidth = width * .43;
    doc.setFillColor(...pale); doc.roundedRect(trackX, rowY - 3, trackWidth, 3.5, 1, 1, 'F');
    doc.setFillColor(...blue); doc.roundedRect(trackX, rowY - 3, Math.max(1, trackWidth * value / max), 3.5, 1, 1, 'F');
    text(doc, value, x + width - 5, rowY, 8, ink, true, { align: 'right' });
  });
}

function pageHeader(doc, title, subtitle, page, demo) {
  doc.setFillColor(...ink);
  doc.rect(0, 0, 297, 24, 'F');
  text(doc, title, 14, 11, 16, [255, 255, 255], true);
  text(doc, subtitle, 14, 19, 8, [214, 229, 237]);
  if (demo) {
    doc.setFillColor(...lime); doc.roundedRect(264, 7, 18, 8, 1.5, 1.5, 'F');
    text(doc, 'DEMO', 273, 12.5, 8, ink, true, { align: 'center' });
  }
  doc.setDrawColor(...edge); doc.line(14, 198, 283, 198);
  text(doc, `Companies Portfolio  ·  ${page}`, 14, 204, 8, muted);
  text(doc, new Date().toLocaleDateString(), 283, 204, 8, muted, false, { align: 'right' });
}

function activityChart(doc, items, metric, title, metricName, interval, lang) {
  const x = 14, y = 67, width = 269, height = 66;
  card(doc, x, y, width, height);
  text(doc, title, x + 5, y + 8, 11, ink, true);
  const values = items.map((item) => item[metric] || 0);
  const max = Math.max(1, ...values);
  const total = values.reduce((sum, value) => sum + value, 0);
  text(doc, `${metricName} / ${interval}  ·  Total: ${total}`, x + 5, y + 14, 8, muted);
  const plotX = x + 16, plotY = y + 21, plotWidth = width - 23, plotHeight = 32;
  [0, .5, 1].forEach((fraction) => {
    const lineY = plotY + plotHeight * (1 - fraction);
    doc.setDrawColor(...edge); doc.line(plotX, lineY, plotX + plotWidth, lineY);
    text(doc, Number((max * fraction).toFixed(1)), plotX - 3, lineY + 1, 7, muted, false, { align: 'right' });
  });
  const barWidth = Math.min(5, plotWidth / Math.max(1, items.length) * .65);
  items.forEach((item, index) => {
    const center = plotX + (index + .5) * plotWidth / items.length;
    const value = item[metric] || 0;
    const h = value / max * plotHeight;
    if (value) { doc.setFillColor(...blue); doc.rect(center - barWidth / 2, plotY + plotHeight - h, barWidth, h, 'F'); }
    if (items.length <= 12) text(doc, value, center, plotY + plotHeight - h - 2, 7, ink, true, { align: 'center' });
  });
  if (items.length) {
    if (items.length === 1) text(doc, items[0].label, plotX + plotWidth / 2, y + height - 5, 7, muted, false, { align: 'center' });
    else {
      text(doc, items[0].label, plotX, y + height - 5, 7, muted);
      text(doc, items[items.length - 1].label, plotX + plotWidth, y + height - 5, 7, muted, false, { align: 'right' });
    }
  } else {
    text(doc, lang === 'en' ? 'No activity in this period.' : 'Sem atividade neste período.', plotX + plotWidth / 2, plotY + 17, 9, muted, false, { align: 'center' });
  }
}

export async function exportCrmPdf(report) {
  const JsPDF = await loadLibrary();
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const title = report.lang === 'en' ? 'CRM dashboard' : 'Painel do CRM';
  const subtitle = `${report.from} – ${report.to}  ·  ${report.company}`;
  pageHeader(doc, title, subtitle, '1 / 2', report.demoCount > 0);
  const labels = report.metrics;
  const width = (269 - 5 * 3) / 6;
  labels.forEach(([name, value], index) => {
    const x = 14 + index * (width + 3);
    card(doc, x, 30, width, 30);
    text(doc, value, x + 5, 44, 18, ink, true);
    text(doc, doc.splitTextToSize(name, width - 8).slice(0, 2), x + 5, 51, 7, muted);
  });
  activityChart(doc, report.activity, report.metric, report.activityTitle, report.activityName, report.activityInterval, report.lang);
  panel(doc, 14, 138, 86, 55, report.chartTitles.phases, report.charts.phases);
  panel(doc, 105, 138, 86, 55, report.chartTitles.status, report.charts.status);
  panel(doc, 196, 138, 87, 55, report.chartTitles.sla, report.charts.sla);
  doc.addPage();
  pageHeader(doc, title, subtitle, '2 / 2', report.demoCount > 0);
  panel(doc, 14, 31, 86, 72, report.chartTitles.origins, report.charts.origins);
  panel(doc, 105, 31, 86, 72, report.chartTitles.types, report.charts.types);
  panel(doc, 196, 31, 87, 72, report.chartTitles.investors, report.charts.investors);
  card(doc, 14, 109, 269, 82);
  text(doc, report.chartTitles.companies, 19, 117, 11, ink, true);
  const companies = report.companies.slice(0, 9);
  const max = Math.max(1, ...companies.map((item) => item[1]));
  companies.forEach(([name, value], index) => {
    const y = 127 + index * 6.6;
    text(doc, doc.splitTextToSize(name, 85)[0], 19, y, 8, muted);
    doc.setFillColor(...pale); doc.roundedRect(109, y - 3, 151, 3.5, 1, 1, 'F');
    doc.setFillColor(...blue); doc.roundedRect(109, y - 3, Math.max(1, 151 * value / max), 3.5, 1, 1, 'F');
    text(doc, value, 277, y, 8, ink, true, { align: 'right' });
  });
  if (report.demoCount) text(doc, report.lang === 'en' ? 'Includes fictional demonstration records.' : 'Inclui registros fictícios de demonstração.', 19, 186, 8, muted);
  doc.save(`companies-portfolio-crm-${report.from}-${report.to}.pdf`);
}
