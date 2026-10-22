// Entry point: loads translations and data, then mounts the app.
import { html } from './lib/html.js';
import { loadDictionaries } from './lib/i18n.js';
import * as api from './services/api.js?v=20261021-investor1';
import { App } from './App.js?v=20261021-investor4';

async function start() {
  document.getElementById('root').textContent = 'Conectando ao portfólio...';
  await Promise.all([loadDictionaries(), api.init()]);
  document.title = 'Companies Portfolio · Brazilian Pharma & Health';
  window.ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
}

start().catch((err) => {
  console.error(err);
  document.getElementById('root').textContent = 'Não foi possível carregar o portfólio. Atualize a página para tentar novamente.';
});
