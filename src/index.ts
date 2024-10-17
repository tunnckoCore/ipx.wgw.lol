import { createIPX, createIPXH3App, ipxFSStorage, ipxHttpStorage } from 'ipx';
import { fetchHandler } from './handlers.ts';

export function initApp() {
  const ipx = createIPX({
    storage: ipxFSStorage({ dir: './assets' }),
    httpStorage: ipxHttpStorage({ allowAllDomains: true, maxAge: 60 * 60 * 24 }),
  });
  const app = createIPXH3App(ipx);

  return { fetch: (req) => fetchHandler(req, app) };
}

export default initApp();
