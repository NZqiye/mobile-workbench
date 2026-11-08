import versions from './bundled-asset-versions.json';

export function bundledAssetUrl(source) {
  if (typeof source !== 'string' || !source.startsWith('/') || source.startsWith('//')) return source;
  const pathname = source.split(/[?#]/)[0];
  const scope = Object.keys(versions).find(prefix => prefix.endsWith('/') ? pathname.startsWith(prefix) : pathname === prefix);
  if (!scope) return source;
  const [url, fragment] = source.split('#', 2);
  const params = new URLSearchParams(url.split('?')[1] || '');
  params.set('bundle', versions[scope]);
  return `${pathname}?${params}${fragment ? `#${fragment}` : ''}`;
}
