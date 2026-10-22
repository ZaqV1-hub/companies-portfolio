// Clean URLs for the public site and both private areas; old hash links still resolve.
import { useEffect, useState } from './html.js';

function appPath(pathname) {
  return pathname.replace(/^\/empresa(?=\/|$)/, '/company').replace(/^\/(painel|panel)(?=\/|$)/, '/team');
}

function publicPath(path) {
  const englishArea = /^\/(company|panel|team)(?=\/|$)/.test(location.pathname);
  if (englishArea) return path.replace(/^\/empresa(?=\/|$)/, '/company').replace(/^\/(painel|team)(?=\/|$)/, '/panel');
  return path.replace(/^\/company(?=\/|$)/, '/empresa').replace(/^\/team(?=\/|$)/, '/painel');
}

function parse() {
  const legacy = location.hash.startsWith('#/') ? location.hash.slice(1) : null;
  const url = new URL(legacy || location.href, location.origin);
  const path = appPath(url.pathname);
  const query = {};
  url.searchParams.forEach((v, k) => { query[k] = v; });
  const areaLang = /^\/(empresa|painel)(?=\/|$)/.test(url.pathname) ? 'pt'
    : /^\/(company|panel|team)(?=\/|$)/.test(url.pathname) ? 'en' : null;
  return { path, parts: path.split('/').filter(Boolean), query, areaLang };
}

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onChange);
    window.addEventListener('app:navigate', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('popstate', onChange);
      window.removeEventListener('app:navigate', onChange);
    };
  }, []);
  return route;
}

export function navigate(path, { keepScroll } = {}) {
  const url = publicPath(path);
  if (location.pathname + location.search + location.hash !== url) {
    history.pushState(null, '', url);
    window.dispatchEvent(new Event('app:navigate'));
  }
  if (!keepScroll) window.scrollTo(0, 0);
}

/** Links work directly, including reloads and opening in a new tab. */
export function href(path) {
  return publicPath(path);
}
