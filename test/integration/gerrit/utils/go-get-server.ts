import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { type Server, createServer } from 'node:https';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { codeBlock } from 'common-tags';

export interface GoGetServer {
  /** Module path host:port, e.g. `127.0.0.1:34567` */
  moduleHost: string;
  close: () => Promise<void>;
}

/**
 * Minimal HTTPS vanity import server for go-get discovery.
 * Renovate always requests `https://{module}?go-get=1`, so this must speak TLS
 * (self-signed; pair with NODE_TLS_REJECT_UNAUTHORIZED=0 in the test).
 *
 * Serves meta pointing at a Gerrit git URL so BaseGoDatasource can resolve
 * modules to gerrit-tags.
 */
export async function startGoGetServer(opts: {
  /** Gerrit project name (may contain slashes) */
  project: string;
  /** Gerrit base URL, e.g. http://localhost:8080 */
  gerritBaseUrl: string;
}): Promise<GoGetServer> {
  const project = opts.project.replace(/^\/+/, '');
  const gerritBase = opts.gerritBaseUrl.replace(/\/+$/, '');
  const gitUrl = `${gerritBase}/a/${project}`;

  const certDir = mkdtempSync(join(tmpdir(), 'goget-cert-'));
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-keyout',
      'key.pem',
      '-out',
      'cert.pem',
      '-days',
      '1',
      '-nodes',
      '-subj',
      '/CN=127.0.0.1',
    ],
    { cwd: certDir, stdio: 'pipe' },
  );
  const key = readFileSync(join(certDir, 'key.pem'));
  const cert = readFileSync(join(certDir, 'cert.pem'));
  rmSync(certDir, { recursive: true, force: true });

  let moduleHost = '';

  const server: Server = createServer({ key, cert }, (req, res) => {
    const url = new URL(req.url ?? '/', `https://${req.headers.host}`);
    if (!url.searchParams.has('go-get')) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    const modulePath = `${moduleHost}/${project}`;
    const body = codeBlock`
      <!DOCTYPE html><html><head>
      <meta name="go-import" content="${modulePath} git ${gitUrl}">
      </head><body></body></html>
    `;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(body);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const { port } = server.address() as AddressInfo;
  moduleHost = `127.0.0.1:${port}`;

  return {
    moduleHost,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
