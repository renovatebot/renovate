import { bootstrap, hasProxy } from './proxy';

jest.mock('global-agent');

describe('proxy', () => {
  const httpProxy = 'http://example.org/http-proxy';
  const httpsProxy = 'http://example.org/https-proxy';
  const noProxy = 'http://example.org/no-proxy';

  beforeEach(() => {
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.NO_PROXY;
    delete process.env.no_proxy;
  });

  it('respects HTTP_PROXY', () => {
    process.env.HTTP_PROXY = httpProxy;
    bootstrap();
    expect(hasProxy()).toBeTrue();
  });
  it('respects HTTPS_PROXY', () => {
    process.env.HTTPS_PROXY = httpsProxy;
    bootstrap();
    expect(hasProxy()).toBeTrue();
  });
  it('does nothing', () => {
    process.env.no_proxy = noProxy;
    bootstrap();
    expect(hasProxy()).toBeFalse();
  });
});
