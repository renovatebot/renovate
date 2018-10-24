const tunnel = require('tunnel');
const gotAgent = require('../../lib/util/got-agent');

jest.mock('tunnel');
tunnel.httpOverHttp.mockReturnValue('httpOverHttp');
tunnel.httpsOverHttp.mockReturnValue('httpsOverHttp');
tunnel.httpOverHttps.mockReturnValue('httpOverHttps');
tunnel.httpsOverHttps.mockReturnValue('httpsOverHttps');

const configureProxyEnv = ({
  protocol = 'http',
  proxyAuth = null,
  host = 'myproxy',
  port = '1234',
} = {}) => {
  const proxy = [
    `${protocol}://`,
    proxyAuth ? `${proxyAuth}@` : '',
    `${host}:${port}`,
  ].join('');

  process.env.HTTP_PROXY = proxy;
  process.env.HTTPS_PROXY = proxy;
  process.env.NO_PROXY = 'www.noproxy.com,*.wildcardnoproxy.com';

  return {
    proxy: {
      host,
      port,
      proxyAuth,
    },
  };
};

describe('applyPackageRules()', () => {
  let originalEnv;
  beforeAll(() => {
    originalEnv = {
      HTTP_PROXY: process.env.HTTP_PROXY,
      HTTPS_PROXY: process.env.HTTPS_PROXY,
      NO_PROXY: process.env.NO_PROXY,
    };

    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.NO_PROXY;
  });

  afterAll(() => {
    Object.assign(process.env, originalEnv);
  });

  beforeEach(() => {
    tunnel.httpOverHttp.mockClear();
    tunnel.httpsOverHttp.mockClear();
    tunnel.httpOverHttps.mockClear();
    tunnel.httpsOverHttps.mockClear();
  });

  describe('gotAgent()', () => {
    it('should return undefined if no proxy is configured', () => {
      expect(gotAgent('http://some.website.com')).toBeUndefined();
    });
    it('should return undefined if proxy is configured but path match the noproxy list', () => {
      configureProxyEnv();

      expect(gotAgent('http://www.noproxy.com/some/path')).toBeUndefined();
      expect(gotAgent('https://www.noproxy.com/some/path')).toBeUndefined();
      expect(gotAgent('http://www.noproxy.com')).toBeUndefined();
      expect(
        gotAgent('http://domain.wildcardnoproxy.com/some/path')
      ).toBeUndefined();
      expect(
        gotAgent('https://domain.wildcardnoproxy.com/some/path')
      ).toBeUndefined();
    });
    it('should return a valid agent when using HTTP proxy', () => {
      const proxyConfig = configureProxyEnv();

      expect(gotAgent('http://www.website.com/some/path')).toEqual({
        http: 'httpOverHttp',
        https: 'httpsOverHttp',
      });
      expect(gotAgent('https://www.securewebsite.com/some/path')).toEqual({
        http: 'httpOverHttp',
        https: 'httpsOverHttp',
      });

      expect(tunnel.httpOverHttp).toBeCalledWith(proxyConfig);
      expect(tunnel.httpsOverHttp).toBeCalledWith(proxyConfig);
    });

    it('should return a valid agent when using HTTPS proxy', () => {
      const proxyConfig = configureProxyEnv({ protocol: 'https' });

      expect(gotAgent('http://www.website.com/some/path')).toEqual({
        http: 'httpOverHttps',
        https: 'httpsOverHttps',
      });
      expect(gotAgent('https://www.securewebsite.com/some/path')).toEqual({
        http: 'httpOverHttps',
        https: 'httpsOverHttps',
      });

      expect(tunnel.httpOverHttps).toBeCalledWith(proxyConfig);
      expect(tunnel.httpsOverHttps).toBeCalledWith(proxyConfig);
    });

    it('should return a valid agent when using a proxy with authentication', () => {
      const proxyConfig = configureProxyEnv({ proxyAuth: 'username@password' });

      expect(gotAgent('http://www.website.com/some/path')).toEqual({
        http: 'httpOverHttp',
        https: 'httpsOverHttp',
      });
      expect(gotAgent('https://www.securewebsite.com/some/path')).toEqual({
        http: 'httpOverHttp',
        https: 'httpsOverHttp',
      });

      expect(tunnel.httpOverHttp).toBeCalledWith(proxyConfig);
      expect(tunnel.httpsOverHttp).toBeCalledWith(proxyConfig);
    });
  });
});
