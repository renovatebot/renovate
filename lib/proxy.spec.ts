import { bootstrap, hasProxy } from './proxy.ts';
import * as sanitize from './util/sanitize.ts';

const addSecretForSanitizing = vi.spyOn(sanitize, 'addSecretForSanitizing');

describe('proxy', () => {
  const httpProxy = 'http://example.org/http-proxy';
  const httpsProxy = 'http://example.org/https-proxy';
  const noProxy = 'http://example.org/no-proxy';

  beforeEach(() => {
    vi.stubEnv('HTTP_PROXY', undefined);
    vi.stubEnv('http_proxy', undefined);
    vi.stubEnv('HTTPS_PROXY', undefined);
    vi.stubEnv('https_proxy', undefined);
    vi.stubEnv('NO_PROXY', undefined);
    vi.stubEnv('no_proxy', undefined);
  });

  it('respects HTTP_PROXY', () => {
    vi.stubEnv('HTTP_PROXY', httpProxy);
    bootstrap();
    expect(hasProxy()).toBeTrue();
  });

  it('copies upper case HTTP_PROXY to http_proxy', () => {
    vi.stubEnv('HTTP_PROXY', httpProxy);
    bootstrap();
    expect(hasProxy()).toBeTrue();
    expect(process.env.HTTP_PROXY).toBeDefined();
    expect(process.env.http_proxy).toBeDefined();

    expect(process.env.HTTPS_PROXY).toBeUndefined();
    expect(process.env.https_proxy).toBeUndefined();
    expect(process.env.NO_PROXY).toBeUndefined();
    expect(process.env.no_proxy).toBeUndefined();
  });

  it('respects HTTPS_PROXY', () => {
    vi.stubEnv('HTTPS_PROXY', httpsProxy);
    bootstrap();
    expect(hasProxy()).toBeTrue();
  });

  it('copies upper case HTTPS_PROXY to https_proxy', () => {
    vi.stubEnv('HTTPS_PROXY', httpsProxy);
    bootstrap();
    expect(hasProxy()).toBeTrue();
    expect(process.env.HTTPS_PROXY).toBeDefined();
    expect(process.env.https_proxy).toBeDefined();

    expect(process.env.HTTP_PROXY).toBeUndefined();
    expect(process.env.http_proxy).toBeUndefined();
    expect(process.env.NO_PROXY).toBeUndefined();
    expect(process.env.no_proxy).toBeUndefined();
  });

  it('does nothing', () => {
    vi.stubEnv('no_proxy', noProxy);
    bootstrap();
    expect(hasProxy()).toBeFalse();
  });

  it('sanitizes password from HTTP_PROXY credentials', () => {
    vi.stubEnv('HTTP_PROXY', 'http://user:s3cr3t@example.org');
    bootstrap();
    expect(addSecretForSanitizing).toHaveBeenCalledWith('s3cr3t', 'global');
  });

  it('sanitizes password from HTTPS_PROXY credentials', () => {
    vi.stubEnv('HTTPS_PROXY', 'http://user:s3cr3t@example.org');
    bootstrap();
    expect(addSecretForSanitizing).toHaveBeenCalledWith('s3cr3t', 'global');
  });

  it('does not sanitize username-only proxy credentials', () => {
    vi.stubEnv('HTTP_PROXY', 'http://user@example.org');
    bootstrap();
    expect(addSecretForSanitizing).not.toHaveBeenCalled();
  });

  it('sanitizes password-only proxy credentials', () => {
    vi.stubEnv('HTTP_PROXY', 'http://:s3cr3t@example.org');
    bootstrap();
    expect(addSecretForSanitizing).toHaveBeenCalledWith('s3cr3t', 'global');
  });

  it('does not sanitize when proxy has no credentials', () => {
    vi.stubEnv('HTTP_PROXY', httpProxy);
    bootstrap();
    expect(addSecretForSanitizing).not.toHaveBeenCalled();
  });
});
