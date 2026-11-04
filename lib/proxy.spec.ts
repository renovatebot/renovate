import { bootstrap, hasProxy } from './proxy.ts';
import * as sanitize from './util/sanitize.ts';

const addSecretForSanitizing = vi.spyOn(sanitize, 'addSecretForSanitizing');

describe('proxy', () => {
  const httpProxy = 'http://example.org:8080';
  const httpsProxy = 'https://example.org:8443';
  const noProxy = 'http://noproxy.example.org';

  beforeEach(() => {
    vi.stubEnv('RENOVATE_X_GLOBAL_AGENT', undefined);
    vi.stubEnv('HTTP_PROXY', undefined);
    vi.stubEnv('http_proxy', undefined);
    vi.stubEnv('HTTPS_PROXY', undefined);
    vi.stubEnv('https_proxy', undefined);
    vi.stubEnv('NO_PROXY', undefined);
    vi.stubEnv('no_proxy', undefined);
  });

  it('respects HTTP_PROXY', async () => {
    vi.stubEnv('HTTP_PROXY', httpProxy);
    await bootstrap();
    expect(hasProxy()).toBeTrue();
  });

  it('copies upper case HTTP_PROXY to http_proxy for global-agent', async () => {
    vi.stubEnv('HTTP_PROXY', httpProxy);
    vi.stubEnv('RENOVATE_X_GLOBAL_AGENT', 'true');
    await bootstrap();
    expect(hasProxy()).toBeTrue();
    expect(process.env.HTTP_PROXY).toBeDefined();
    expect(process.env.http_proxy).toBeDefined();

    expect(process.env.HTTPS_PROXY).toBeUndefined();
    expect(process.env.https_proxy).toBeUndefined();
    expect(process.env.NO_PROXY).toBeUndefined();
    expect(process.env.no_proxy).toBeUndefined();
  });

  it('respects HTTPS_PROXY', async () => {
    vi.stubEnv('HTTPS_PROXY', httpsProxy);
    await bootstrap();
    expect(hasProxy()).toBeTrue();
  });

  it('copies upper case HTTPS_PROXY to https_proxy for global-agent', async () => {
    vi.stubEnv('HTTPS_PROXY', httpsProxy);
    vi.stubEnv('RENOVATE_X_GLOBAL_AGENT', 'true');
    await bootstrap();
    expect(hasProxy()).toBeTrue();
    expect(process.env.HTTPS_PROXY).toBeDefined();
    expect(process.env.https_proxy).toBeDefined();

    expect(process.env.HTTP_PROXY).toBeUndefined();
    expect(process.env.http_proxy).toBeUndefined();
    expect(process.env.NO_PROXY).toBeUndefined();
    expect(process.env.no_proxy).toBeUndefined();
  });

  it('does nothing', async () => {
    vi.stubEnv('no_proxy', noProxy);
    await bootstrap();
    expect(hasProxy()).toBeFalse();
  });

  it('sanitizes password from HTTP_PROXY credentials', async () => {
    vi.stubEnv('HTTP_PROXY', 'http://user:s3cr3t@example.org');
    await bootstrap();
    expect(addSecretForSanitizing).toHaveBeenCalledWith('s3cr3t', 'global');
  });

  it('sanitizes password from HTTPS_PROXY credentials', async () => {
    vi.stubEnv('HTTPS_PROXY', 'http://user:s3cr3t@example.org');
    await bootstrap();
    expect(addSecretForSanitizing).toHaveBeenCalledWith('s3cr3t', 'global');
  });

  it('sanitizes password from lower case https_proxy credentials', async () => {
    vi.stubEnv('https_proxy', 'http://user:s3cr3t@example.org');
    await bootstrap();
    expect(addSecretForSanitizing).toHaveBeenCalledWith('s3cr3t', 'global');
  });

  it('does not sanitize username-only proxy credentials', async () => {
    vi.stubEnv('HTTP_PROXY', 'http://user@example.org');
    await bootstrap();
    expect(addSecretForSanitizing).not.toHaveBeenCalled();
  });

  it('sanitizes password-only proxy credentials', async () => {
    vi.stubEnv('HTTP_PROXY', 'http://:s3cr3t@example.org');
    await bootstrap();
    expect(addSecretForSanitizing).toHaveBeenCalledWith('s3cr3t', 'global');
  });

  it('does not sanitize when proxy has no credentials', async () => {
    vi.stubEnv('HTTP_PROXY', httpProxy);
    await bootstrap();
    expect(addSecretForSanitizing).not.toHaveBeenCalled();
  });
});
