import { bootstrap, hasProxy } from './proxy';

describe('proxy', () => {
  const httpProxy = 'http://example.org/http-proxy';
  const httpsProxy = 'http://example.org/https-proxy';
  const noProxy = 'http://example.org/no-proxy';

  beforeEach(() => {
    delete process.env.HTTP_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.https_proxy;
    delete process.env.NO_PROXY;
    delete process.env.no_proxy;
  });

  it('respects HTTP_PROXY', () => {
    process.env.HTTP_PROXY = httpProxy;
    bootstrap();
    expect(hasProxy()).toBeTrue();
  });

  it('copies upper case HTTP_PROXY to http_proxy', () => {
    process.env.HTTP_PROXY = httpProxy;
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
    process.env.HTTPS_PROXY = httpsProxy;
    bootstrap();
    expect(hasProxy()).toBeTrue();
  });

  it('copies upper case HTTPS_PROXY to https_proxy', () => {
    process.env.HTTPS_PROXY = httpsProxy;
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
    process.env.no_proxy = noProxy;
    bootstrap();
    expect(hasProxy()).toBeFalse();
  });
});
