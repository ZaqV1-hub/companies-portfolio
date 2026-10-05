// Entry point: loads translations and data, then mounts the app.
import { html } from './lib/html.js';
import { loadDictionaries } from './lib/i18n.js';
import * as api from './services/api.js';
import { App } from './App.js';

async function start() {
  await Promise.all([loadDictionaries(), api.init()]);
  document.title = 'Companies Portfolio · Brazilian Pharma & Health';
  window.ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
}

start().catch((err) => {
  console.error(err);
  document.getElementById('root').textContent = 'Could not start the app: ' + err.message
    + ' — serve the folder over HTTP (see README).';
});
