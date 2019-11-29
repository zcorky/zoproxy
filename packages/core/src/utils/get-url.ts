export function getUrl(path: string, target: string): string {
  return `${target}${path}`
    .replace(/\/+/g, '/')
    .replace('http:/', 'http://')
    .replace('https:/', 'https://');
}