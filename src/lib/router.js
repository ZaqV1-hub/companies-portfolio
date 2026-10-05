// Hash router: works on any static server (#/org/nintx?project=x). The real deploy can keep it.
import { useEffect, useState } from './html.js';

function parse(hash) {
  const raw = (hash || '').replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const query = {};
  new URLSearchParams(qs || '').forEach((v, k) => { query[k] = v; });
  return { path, parts: path.split('/').filter(Boolean), query };
}

export function useRoute() {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(path, { keepScroll } = {}) {
  if (location.hash !== '#' + path) location.hash = path;
  if (!keepScroll) window.scrollTo(0, 0);
}

/** Props for a link: html`<a ...${link('/org/x')}>` keeps real hrefs (open in new tab works). */
export function href(path) {
  return '#' + path;
}
