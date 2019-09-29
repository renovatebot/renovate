import { bootstrap } from '../lib/proxy';

describe('proxy', () => {
  const httpProxy = 'http://example.org/http-proxy';
  const httpsProxy = 'http://example.org/https-proxy';
  const noProxy = 'http://example.org/no-proxy';

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
  it('respects NO_PROXY', () => {
    process.env.NO_PROXY = noProxy;
    const result = bootstrap();
    expect(result.NO_PROXY).toEqual(noProxy);
  });
});
