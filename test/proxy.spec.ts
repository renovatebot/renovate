import { bootstrap } from '../lib/proxy';

describe('proxy', () => {
  const httpProxy = 'http://example.org/http-proxy';
  const httpsProxy = 'http://example.org/https-proxy';
  const noProxy = 'http://example.org/no-proxy';

  beforeAll(() => {
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.NO_PROXY;
    delete process.env.no_proxy;
  });

  it('respects HTTP_PROXY', () => {
    process.env.HTTP_PROXY = httpProxy;
    const result = bootstrap();
    expect(result.HTTP_PROXY).toEqual(httpProxy);
  });
  it('respects HTTPS_PROXY', () => {
    process.env.HTTPS_PROXY = httpsProxy;
    const result = bootstrap();
    expect(result.HTTPS_PROXY).toEqual(httpsProxy);
  });
  it('respects no_proxy', () => {
    process.env.no_proxy = noProxy;
    const result = bootstrap();
    expect(result.NO_PROXY).toEqual(noProxy);
  });
});
