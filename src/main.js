// Entry point: loads translations and data, then mounts the app.
import { html } from './lib/html.js';
import { loadDictionaries } from './lib/i18n.js';
import { App } from './App.js?v=202611-profile-modals1';

async function start() {
  document.getElementById('root').textContent = 'Conectando ao portfólio...';
  await loadDictionaries();
  document.title = 'Companies Portfolio · Brazilian Pharma & Health';
  window.ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
}

start().catch((err) => {
  console.error(err);
  document.getElementById('root').textContent = 'Não foi possível carregar o portfólio. Atualize a página para tentar novamente.';
});
