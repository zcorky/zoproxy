const version = '1.0.1';
// import * as pkg from '../../package.json';

export function getUserAgent() {
  const appName = 'Ghost Proxy Hub';
  const appVersion = version; // pkg.version;

  return `${appName}/${appVersion}`;
}