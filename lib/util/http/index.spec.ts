import dnsPromises from 'node:dns/promises';
import { ZodError, z } from 'zod/v4';
import * as httpMock from '~test/http-mock.ts';
import { logger } from '~test/util.ts';
import { GlobalConfig } from '../../config/global.ts';
import {
  EXTERNAL_HOST_ERROR,
  HOST_BLOCKED,
  HOST_DISABLED,
} from '../../constants/error-messages.ts';
import { pkg } from '../../expose.ts';
import { hasProxy } from '../../proxy.ts';
import * as memCache from '../cache/memory/index.ts';
import { resetCache } from '../cache/repository/index.ts';
import * as hostRules from '../host-rules.ts';
import { applyDefaultHeaders } from './http.ts';
import { Http, HttpError } from './index.ts';
import * as queue from './queue.ts';
import * as throttle from './throttle.ts';
import type { HttpResponse } from './types.ts';

vi.mock('node:dns/promises', () => ({
  default: { lookup: vi.fn() },
}));
vi.mock('../../proxy.ts', () => ({
  hasProxy: vi.fn(),
}));

const baseUrl = 'http://renovate.com';

describe('util/http/index', () => {
  let http: Http;

  beforeEach(() => {
    http = new Http('dummy');
    hostRules.clear();
    queue.clear();
    throttle.clear();
    resetCache();
  });

  describe('applyDefaultHeaders', () => {
    afterEach(() => {
      GlobalConfig.reset();
    });

    it('sets default user-agent', () => {
      const options = {};
      applyDefaultHeaders(options);
      expect(options).toMatchObject({
        headers: {
          'user-agent': `Renovate/${pkg.version} (https://github.com/renovatebot/renovate)`,
        },
      });
    });

    it('uses userAgent when set as a plain string', () => {
      GlobalConfig.set({ userAgent: 'custom-agent/1.0' });
      const options = {};
      applyDefaultHeaders(options);
      expect(options).toMatchObject({
        headers: { 'user-agent': 'custom-agent/1.0' },
      });
    });

    it('interpolates {{renovateVersion}} in a custom userAgent template', () => {
      GlobalConfig.set({
        userAgent: 'MyRenovate/{{renovateVersion}} (my-instance)',
      });
      const options = {};
      applyDefaultHeaders(options);
      expect(options).toMatchObject({
        headers: {
          'user-agent': `MyRenovate/${pkg.version} (my-instance)`,
        },
      });
    });

    it('renders unknown template variables as empty string', () => {
      GlobalConfig.set({ userAgent: 'my-agent/{{unknownVar}}' });
      const options = {};
      applyDefaultHeaders(options);
      expect(options).toMatchObject({
        headers: { 'user-agent': 'my-agent/' },
      });
    });

    it('supports Handlebars helpers in userAgent template', () => {
      GlobalConfig.set({
        userAgent: '{{lowercase "MyRenovate"}}/{{renovateVersion}}',
      });
      const options = {};
      applyDefaultHeaders(options);
      expect(options).toMatchObject({
        headers: { 'user-agent': `myrenovate/${pkg.version}` },
      });
    });

    it('supports conditional Handlebars syntax in userAgent template', () => {
      GlobalConfig.set({
        userAgent:
          '{{#if renovateVersion}}Renovate/{{renovateVersion}}{{else}}Renovate{{/if}}',
      });
      const options = {};
      applyDefaultHeaders(options);
      expect(options).toMatchObject({
        headers: { 'user-agent': `Renovate/${pkg.version}` },
      });
    });

    it('preserves existing headers', () => {
      const options = { headers: { authorization: 'Bearer token' } };
      applyDefaultHeaders(options);
      expect(options.headers).toMatchObject({
        authorization: 'Bearer token',
        'user-agent': `Renovate/${pkg.version} (https://github.com/renovatebot/renovate)`,
      });
    });
  });

  it('get', async () => {
    httpMock.scope(baseUrl).get('/test').reply(200);
    await expect(http.getText('http://renovate.com/test')).resolves.toEqual({
      authorization: false,
      body: '',
      headers: {},
      statusCode: 200,
    });
    expect(httpMock.allUsed()).toBeTrue();
  });

  it('returns 429 error', async () => {
    httpMock.scope(baseUrl).get('/test').reply(429);
    await expect(http.get('http://renovate.com/test')).rejects.toThrow(
      'Request failed with status code 429 (Too Many Requests): GET http://renovate.com/test',
    );
    expect(httpMock.allUsed()).toBeTrue();
  });

  it('returns 401 error', async () => {
    httpMock
      .scope('https://renovate.com')
      .get('/v2/')
      .reply(401, '', {
        'www-authenticate': [
          'Bearer realm="https://renovate.com/v2/token",service="container_registry",scope="*"',
          'Basic realm="https://renovate.com/v2"',
        ],
      })
      .get('/v2/')
      .reply(401, '', [
        'WWW-Authenticate',
        'Bearer realm="https://renovate.com/v2/token",service="container_registry",scope="*"',
        'www-authenticate',
        'Basic realm="https://renovate.com/v2"',
      ]);
    let resp = await http.get('https://renovate.com/v2/', {
      throwHttpErrors: false,
    });
    expect(resp.statusCode).toEqual(401);
    expect(resp.headers['www-authenticate']).toEqual(
      `Bearer realm="https://renovate.com/v2/token",service="container_registry",scope="*", Basic realm="https://renovate.com/v2"`,
    );

    resp = await http.get('https://renovate.com/v2/', {
      throwHttpErrors: false,
    });
    expect(resp.statusCode).toEqual(401);
    expect(resp.headers['www-authenticate']).toEqual(
      `Bearer realm="https://renovate.com/v2/token",service="container_registry",scope="*", Basic realm="https://renovate.com/v2"`,
    );

    expect(httpMock.allUsed()).toBeTrue();
  });

  it('converts 404 error to ExternalHostError', async () => {
    httpMock.scope(baseUrl).get('/test').reply(404);
    hostRules.add({ abortOnError: true });
    await expect(http.get('http://renovate.com/test')).rejects.toThrow(
      EXTERNAL_HOST_ERROR,
    );
    expect(httpMock.allUsed()).toBeTrue();
  });

  it('disables hosts', async () => {
    hostRules.add({ matchHost: 'renovate.com', enabled: false });
    await expect(http.get('http://renovate.com/test')).rejects.toThrow(
      HOST_DISABLED,
    );
  });

  it('ignores 404 error and does not throw ExternalHostError', async () => {
    httpMock.scope(baseUrl).get('/test').reply(404);
    hostRules.add({ abortOnError: true, abortIgnoreStatusCodes: [404] });
    await expect(http.get('http://renovate.com/test')).rejects.toThrow(
      'Request failed with status code 404 (Not Found): GET http://renovate.com/test',
    );
    expect(httpMock.allUsed()).toBeTrue();
  });

  it('does not pass auth on redirects', async () => {
    hostRules.add({ matchHost: 'renovate.com', token: 'secret' });

    httpMock
      .scope(baseUrl, { reqheaders: { authorization: 'Bearer secret' } })
      .get('/test')
      .reply(302, undefined, {
        location: 'http://renovate.test/redirected?X-Amz-Algorithm=xxx',
      });

    httpMock
      .scope('http://renovate.test', { badheaders: ['authorization'] })
      .get('/redirected?X-Amz-Algorithm=xxx')
      .reply(200);

    await expect(http.get('http://renovate.com/test')).resolves.toBeDefined();
  });

  it('getJson', async () => {
    httpMock
      .scope(baseUrl, {
        reqheaders: {
          accept: 'application/json',
        },
      })
      .get('/')
      .reply(200, '{ "test": true }', { etag: 'abc123' });

    const res = await http.getJsonUnchecked('http://renovate.com');

    expect(res).toEqual({
      authorization: false,
      body: {
        test: true,
      },
      headers: {
        etag: 'abc123',
      },
      statusCode: 200,
    });
  });

  it('postJson', async () => {
    httpMock.scope(baseUrl).post('/').reply(200, {});
    await expect(
      http.postJson('http://renovate.com', { body: {}, baseUrl }),
    ).resolves.toEqual({
      authorization: false,
      body: {},
      headers: {
        'content-type': 'application/json',
      },
      statusCode: 200,
    });
    expect(httpMock.allUsed()).toBeTrue();
  });

  it('putJson', async () => {
    httpMock.scope(baseUrl).put('/').reply(200, {});
    await expect(
      http.putJson('http://renovate.com', { body: {}, baseUrl }),
    ).resolves.toEqual({
      authorization: false,
      body: {},
      headers: {
        'content-type': 'application/json',
      },
      statusCode: 200,
    });
    expect(httpMock.allUsed()).toBeTrue();
  });

  it('patchJson', async () => {
    httpMock.scope(baseUrl).patch('/').reply(200, {});
    await expect(
      http.patchJson('http://renovate.com', { body: {}, baseUrl }),
    ).resolves.toEqual({
      authorization: false,
      body: {},
      headers: {
        'content-type': 'application/json',
      },
      statusCode: 200,
    });
    expect(httpMock.allUsed()).toBeTrue();
  });

  it('deleteJson', async () => {
    httpMock.scope(baseUrl).delete('/').reply(200, {});
    await expect(
      http.deleteJson('http://renovate.com', { body: {}, baseUrl }),
    ).resolves.toEqual({
      authorization: false,
      body: {},
      headers: {
        'content-type': 'application/json',
      },
      statusCode: 200,
    });
    expect(httpMock.allUsed()).toBeTrue();
  });

  it('headJson', async () => {
    httpMock.scope(baseUrl).head('/').reply(200, undefined, {
      'content-type': 'application/json',
    });
    await expect(
      http.headJson('http://renovate.com', { baseUrl }),
    ).resolves.toEqual({
      authorization: false,
      body: '',
      headers: {
        'content-type': 'application/json',
      },
      statusCode: 200,
    });
    expect(httpMock.allUsed()).toBeTrue();
  });

  it('stream', async () => {
    httpMock.scope(baseUrl).get('/some').reply(200, {});

    const stream = http.stream('/some', {
      baseUrl,
    });
    expect(stream).toBeDefined();

    let data = '';

    stream.on('data', (c) => {
      data += c;
    });

    const done = new Promise((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    await done;

    expect(data).toBe('{}');
    expect(httpMock.allUsed()).toBeTrue();
  });

  it('disables hosts for stream', () => {
    hostRules.add({ matchHost: 'renovate.com', enabled: false });

    expect(() => http.stream('http://renovate.com/test')).toThrow(
      HOST_DISABLED,
    );
  });

  describe('host guard', () => {
    afterEach(() => {
      GlobalConfig.reset();
    });

    describe('by default', () => {
      describe('when response does not become config', () => {
        it('warns about, but allows, requests to internal hosts', async () => {
          httpMock.scope('http://10.1.2.3').get('/test').reply(200, 'ok');

          const res = await http.getText('http://10.1.2.3/test');

          expect(res.body).toBe('ok');
          expect(logger.logger.once.warn).toHaveBeenCalledWith(
            { hostname: '10.1.2.3', hostType: 'dummy' },
            expect.stringContaining('HTTP request to an internal host'),
          );
        });

        it('permits the platform endpoint host', async () => {
          GlobalConfig.set({ endpoint: 'http://10.1.2.3/api/v4/' });
          httpMock.scope('http://10.1.2.3').get('/test').reply(200, 'ok');

          const res = await http.getText('http://10.1.2.3/test');

          expect(res.body).toBe('ok');
        });

        it('permits a host the admin named in a trusted hostRule', async () => {
          hostRules.add({ matchHost: '10.1.2.3' }, { trusted: true });
          httpMock.scope('http://10.1.2.3').get('/test').reply(200, 'ok');

          const res = await http.getText('http://10.1.2.3/test');

          expect(res.body).toBe('ok');
        });

        it('does not require a scoped grant for a request which is not config', async () => {
          const plainHttp = new Http('preset');
          hostRules.add({ matchHost: '10.1.2.3' }, { trusted: true });
          httpMock
            .scope('http://10.1.2.3')
            .get('/preset.json')
            .reply(200, '{}');

          const res = await plainHttp.getText('http://10.1.2.3/preset.json');

          expect(res.body).toBe('{}');
        });
      });

      describe('when response becomes config', () => {
        it('warns about, but allows, an internal host with only an implicit grant', async () => {
          const presetHttp = new Http('preset', {
            responseBecomesConfig: true,
          });
          // an implicit grant is enough for lookups, but only warns for something which becomes config
          hostRules.add({ matchHost: '10.1.2.3' }, { trusted: true });
          httpMock
            .scope('http://10.1.2.3')
            .get('/preset.json')
            .reply(200, '{}');

          const res = await presetHttp.getText('http://10.1.2.3/preset.json');

          expect(res.body).toBe('{}');
          expect(logger.logger.once.warn).toHaveBeenCalledWith(
            { hostname: '10.1.2.3', hostType: 'preset' },
            expect.stringContaining('whose response becomes configuration'),
          );
        });
      });
    });

    describe('when internalHostAccess=block', () => {
      describe('when response does not become config', () => {
        it('blocks requests to internal hosts', async () => {
          GlobalConfig.set({ internalHostAccess: 'block' });

          await expect(http.get('http://127.0.0.1:8080/test')).rejects.toThrow(
            HOST_BLOCKED,
          );
          await expect(http.get('http://10.1.2.3/test')).rejects.toThrow(
            HOST_BLOCKED,
          );
        });

        it('does not let an untrusted hostRule permit an internal host', async () => {
          GlobalConfig.set({ internalHostAccess: 'block' });
          hostRules.add({ matchHost: '10.1.2.3' });

          await expect(http.get('http://10.1.2.3/test')).rejects.toThrow(
            HOST_BLOCKED,
          );
        });

        it('blocks the stream path too', () => {
          GlobalConfig.set({ internalHostAccess: 'block' });

          expect(() => http.stream('http://127.0.0.1/test')).toThrow(
            HOST_BLOCKED,
          );
        });
      });

      describe('when response becomes config', () => {
        it('requires a scoped grant', async () => {
          GlobalConfig.set({ internalHostAccess: 'block' });
          const presetHttp = new Http('preset', {
            responseBecomesConfig: true,
          });
          // an implicit grant is enough for lookups, but not for anything which becomes config
          hostRules.add({ matchHost: '10.1.2.3' }, { trusted: true });

          await expect(
            presetHttp.get('http://10.1.2.3/preset.json'),
          ).rejects.toThrow(HOST_BLOCKED);

          hostRules.add(
            { hostType: 'preset', matchHost: '10.1.2.3', allowInternal: true },
            { trusted: true },
          );
          httpMock
            .scope('http://10.1.2.3')
            .get('/preset.json')
            .reply(200, '{}');

          const res = await presetHttp.getText('http://10.1.2.3/preset.json');

          expect(res.body).toBe('{}');
        });
      });
    });

    describe('when internalHostAccess=warn', () => {
      describe('when response does not become config', () => {
        it('warns about, but allows, requests to internal hosts', async () => {
          GlobalConfig.set({ internalHostAccess: 'warn' });
          httpMock.scope('http://10.1.2.3').get('/test').reply(200, 'ok');

          const res = await http.getText('http://10.1.2.3/test');

          expect(res.body).toBe('ok');
          expect(logger.logger.once.warn).toHaveBeenCalledWith(
            { hostname: '10.1.2.3', hostType: 'dummy' },
            expect.stringContaining('HTTP request to an internal host'),
          );
        });
      });

      describe('when response becomes config', () => {
        it('warns about, but allows, an internal host with only an implicit grant', async () => {
          GlobalConfig.set({ internalHostAccess: 'warn' });
          const presetHttp = new Http('preset', {
            responseBecomesConfig: true,
          });
          hostRules.add({ matchHost: '10.1.2.3' }, { trusted: true });
          httpMock
            .scope('http://10.1.2.3')
            .get('/preset.json')
            .reply(200, '{}');

          const res = await presetHttp.getText('http://10.1.2.3/preset.json');

          expect(res.body).toBe('{}');
          expect(logger.logger.once.warn).toHaveBeenCalledWith(
            { hostname: '10.1.2.3', hostType: 'preset' },
            expect.stringContaining('whose response becomes configuration'),
          );
        });
      });
    });

    describe('when internalHostAccess=allow', () => {
      describe('when response does not become config', () => {
        it('blocks requests to metadata endpoints', async () => {
          GlobalConfig.set({ internalHostAccess: 'allow' });

          await expect(
            http.get('http://169.254.169.254/latest/meta-data/'),
          ).rejects.toThrow(HOST_BLOCKED);
          await expect(
            http.get('http://metadata.google.internal/computeMetadata/v1/'),
          ).rejects.toThrow(HOST_BLOCKED);
        });

        it('permits internal hosts', async () => {
          GlobalConfig.set({ internalHostAccess: 'allow' });
          httpMock.scope('http://10.1.2.3').get('/test').reply(200, 'ok');

          const res = await http.getText('http://10.1.2.3/test');

          expect(res.body).toBe('ok');
        });
      });

      describe('when response becomes config', () => {
        it('permits an internal host even without a scoped grant', async () => {
          GlobalConfig.set({ internalHostAccess: 'allow' });
          const presetHttp = new Http('preset', {
            responseBecomesConfig: true,
          });
          httpMock
            .scope('http://10.1.2.3')
            .get('/preset.json')
            .reply(200, '{}');

          const res = await presetHttp.getText('http://10.1.2.3/preset.json');

          expect(res.body).toBe('{}');
        });
      });
    });

    describe('redirects', () => {
      it('blocks a redirect to an internal host', async () => {
        httpMock
          .scope(baseUrl)
          .get('/redirect')
          .reply(302, '', { location: 'http://169.254.169.254/latest/' });

        await expect(http.get(`${baseUrl}/redirect`)).rejects.toThrow(
          HOST_BLOCKED,
        );
        expect(logger.logger.warn).toHaveBeenCalledWith(
          { url: 'http://169.254.169.254/latest/', hostType: 'dummy' },
          'Blocked HTTP request to a cloud instance-metadata endpoint',
        );
      });

      it('follows a redirect to a permitted host', async () => {
        httpMock
          .scope(baseUrl)
          .get('/redirect')
          .reply(302, '', { location: `${baseUrl}/target` });
        httpMock.scope(baseUrl).get('/target').reply(200, 'ok');

        const res = await http.getText(`${baseUrl}/redirect`);

        expect(res.body).toBe('ok');
      });

      it('strips authorization when redirected to another host', async () => {
        hostRules.add({ matchHost: 'renovate.com', token: 'secret-token' });
        httpMock
          .scope(baseUrl)
          .get('/redirect')
          .reply(302, '', { location: 'http://other.example.com/target' });
        httpMock
          .scope('http://other.example.com', {
            badheaders: ['authorization'],
          })
          .get('/target')
          .reply(200, 'ok');

        const res = await http.getText(`${baseUrl}/redirect`);

        expect(res.body).toBe('ok');
      });

      it('strips authorization when a redirect downgrades https to http', async () => {
        hostRules.add({ matchHost: 'renovate.com', token: 'secret-token' });
        httpMock
          .scope('https://renovate.com')
          .get('/redirect')
          .reply(302, '', { location: 'http://renovate.com/target' });
        httpMock
          .scope('http://renovate.com', {
            badheaders: ['authorization'],
          })
          .get('/target')
          .reply(200, 'ok');

        const res = await http.getText('https://renovate.com/redirect');

        expect(res.body).toBe('ok');
      });
    });

    describe('caching', () => {
      it('does not serve a cached response for a URL that is now blocked', async () => {
        GlobalConfig.set({ internalHostAccess: 'allow' });
        httpMock.scope('http://10.1.2.3').get('/cached').reply(200, 'ok');
        const res = await http.getText('http://10.1.2.3/cached');
        expect(res.body).toBe('ok');

        GlobalConfig.set({ internalHostAccess: 'block' });

        await expect(http.getText('http://10.1.2.3/cached')).rejects.toThrow(
          HOST_BLOCKED,
        );
      });
    });

    describe('proxied deployments', () => {
      beforeEach(() => {
        // a proxy agent resolves the target hostname itself, so the `dnsLookup` guard is replaced by a pre-flight lookup
        vi.mocked(hasProxy).mockReturnValue(true);
      });

      it('blocks a hostname which resolves to an internal address', async () => {
        GlobalConfig.set({ internalHostAccess: 'block' });
        vi.mocked(dnsPromises.lookup).mockResolvedValue([
          { address: '10.0.0.1', family: 4 },
        ] as never);

        await expect(http.get(`${baseUrl}/test`)).rejects.toThrow(HOST_BLOCKED);
      });

      it('warns about a hostname which resolves to an internal address by default', async () => {
        vi.mocked(dnsPromises.lookup).mockResolvedValue([
          { address: '10.0.0.1', family: 4 },
        ] as never);
        httpMock.scope(baseUrl).get('/test').reply(200, 'ok');

        const res = await http.getText(`${baseUrl}/test`);

        expect(res.body).toBe('ok');
        expect(logger.logger.once.warn).toHaveBeenCalledWith(
          { hostname: 'renovate.com', hostType: 'dummy' },
          expect.stringContaining('HTTP request to an internal host'),
        );
      });

      it('allows a hostname which resolves to a public address', async () => {
        vi.mocked(dnsPromises.lookup).mockResolvedValue([
          { address: '93.184.216.34', family: 4 },
        ] as never);
        httpMock.scope(baseUrl).get('/test').reply(200, 'ok');

        const res = await http.getText(`${baseUrl}/test`);

        expect(res.body).toBe('ok');
      });
    });
  });

  it('limits concurrency by host', async () => {
    hostRules.add({ matchHost: 'renovate.com', concurrentRequestLimit: 1 });

    let foo = false;
    let bar = false;
    let baz = false;

    function dummyResolve(_: unknown): void {
      return;
    }

    interface MockedRequestResponse<T = unknown> {
      request: Promise<T>;
      resolveRequest: (_?: T) => void;
      response: Promise<T>;
      resolveResponse: (_?: T) => void;
    }

    function mockRequestResponse(): MockedRequestResponse {
      let resolveRequest = dummyResolve;
      const request = new Promise((resolve) => {
        resolveRequest = resolve;
      });

      let resolveResponse = dummyResolve;
      const response = new Promise((resolve) => {
        resolveResponse = resolve;
      });

      return { request, resolveRequest, response, resolveResponse };
    }

    const {
      request: fooReq,
      resolveRequest: fooStart,
      response: fooResp,
      resolveResponse: fooFinish,
    } = mockRequestResponse();

    const {
      request: barReq,
      resolveRequest: barStart,
      response: barResp,
      resolveResponse: barFinish,
    } = mockRequestResponse();

    httpMock
      .scope(baseUrl)
      .get('/foo')
      .reply(200, () => {
        foo = true;
        fooStart();
        return fooResp;
      })
      .get('/bar')
      .reply(200, () => {
        bar = true;
        barStart();
        return barResp;
      })
      .get('/baz')
      .reply(200, () => {
        baz = true;
        return 'baz';
      });

    const all = Promise.all([
      http.get('http://renovate.com/foo'),
      http.get('http://renovate.com/bar'),
      http.get('http://renovate.com/baz'),
    ]);

    await fooReq;
    expect(foo).toBeTrue();
    expect(bar).toBeFalse();
    expect(baz).toBeFalse();
    fooFinish();

    await barReq;
    expect(foo).toBeTrue();
    expect(bar).toBeTrue();
    expect(baz).toBeFalse();
    barFinish();

    await all;
    expect(foo).toBeTrue();
    expect(bar).toBeTrue();
    expect(baz).toBeTrue();
  });

  it('getBuffer', async () => {
    httpMock.scope(baseUrl).get('/').reply(200, Buffer.from('test'));
    const res = await http.getBuffer('http://renovate.com');
    expect(res?.body).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(res.body).toString('utf-8')).toBe('test');
  });

  describe('retry', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', undefined);
      http = new Http('dummy');
    });

    it('works', async () => {
      httpMock
        .scope(baseUrl)
        .head('/')
        .reply(500)
        .head('/')
        .reply(200, undefined, { 'x-some-header': 'abc' });
      await expect(http.head('http://renovate.com')).resolves.toEqual({
        authorization: false,
        body: '',
        headers: {
          'x-some-header': 'abc',
        },
        statusCode: 200,
      });
      expect(httpMock.allUsed()).toBeTrue();
    });
  });

  describe('Schema support', () => {
    const Some = z
      .object({ x: z.number(), y: z.number() })
      .transform(({ x, y }) => `${x} + ${y} = ${x + y}`);

    beforeEach(() => {
      memCache.init();
    });

    afterEach(() => {
      memCache.reset();
    });

    describe('getPlain', () => {
      it('gets plain text with correct headers', async () => {
        httpMock.scope(baseUrl).get('/').reply(200, 'plain text response', {
          'content-type': 'text/plain',
        });

        const res = await http.getPlain('http://renovate.com');
        expect(res.body).toBe('plain text response');
        expect(res.headers['content-type']).toBe('text/plain');
      });

      it('works with custom options', async () => {
        httpMock
          .scope(baseUrl)
          .get('/')
          .matchHeader('custom', 'header')
          .reply(200, 'plain text response');

        const res = await http.getPlain('http://renovate.com', {
          headers: { custom: 'header' },
        });
        expect(res.body).toBe('plain text response');
      });
    });

    describe('getYamlUnchecked', () => {
      it('parses yaml response without schema', async () => {
        httpMock.scope(baseUrl).get('/').reply(200, 'x: 2\ny: 2');

        const res = await http.getYamlUnchecked('http://renovate.com');
        expect(res.body).toEqual({ x: 2, y: 2 });
      });

      it('parses yaml with options', async () => {
        httpMock
          .scope(baseUrl)
          .get('/')
          .matchHeader('custom', 'header')
          .reply(200, 'x: 2\ny: 2');

        const res = await http.getYamlUnchecked('http://renovate.com', {
          headers: { custom: 'header' },
        });
        expect(res.body).toEqual({ x: 2, y: 2 });
      });

      it('throws on invalid yaml', async () => {
        httpMock.scope(baseUrl).get('/').reply(200, '!@#$%^');

        await expect(
          http.getYamlUnchecked('http://renovate.com'),
        ).rejects.toThrow('Failed to parse YAML file');
      });
    });

    describe('getYaml', () => {
      it('parses yaml with schema validation', async () => {
        httpMock.scope(baseUrl).get('/').reply(200, 'x: 2\ny: 2');

        const res = await http.getYaml('http://renovate.com', Some);
        expect(res.body).toBe('2 + 2 = 4');
      });

      it('parses yaml with options and schema', async () => {
        httpMock
          .scope(baseUrl)
          .get('/')
          .matchHeader('custom', 'header')
          .reply(200, 'x: 2\ny: 2');

        const res = await http.getYaml(
          'http://renovate.com',
          { headers: { custom: 'header' } },
          Some,
        );
        expect(res.body).toBe('2 + 2 = 4');
      });

      it('throws on schema validation failure', async () => {
        httpMock.scope(baseUrl).get('/').reply(200, 'foo: bar');

        await expect(http.getYaml('http://renovate.com', Some)).rejects.toThrow(
          z.ZodError,
        );
      });

      it('throws on invalid yaml', async () => {
        httpMock.scope(baseUrl).get('/').reply(200, '!@#$%^');

        await expect(http.getYaml('http://renovate.com', Some)).rejects.toThrow(
          'Failed to parse YAML file',
        );
      });
    });

    describe('getYamlSafe', () => {
      it('returns successful result with schema validation', async () => {
        httpMock.scope('http://example.com').get('/').reply(200, 'x: 2\ny: 2');

        const { val, err } = await http
          .getYamlSafe('http://example.com', Some)
          .unwrap();

        expect(val).toBe('2 + 2 = 4');
        expect(err).toBeUndefined();
      });

      it('returns schema error result', async () => {
        httpMock
          .scope('http://example.com')
          .get('/')
          .reply(200, 'x: "2"\ny: "2"');

        const { val, err } = await http
          .getYamlSafe('http://example.com', Some)
          .unwrap();

        expect(val).toBeUndefined();
        expect(err).toBeInstanceOf(ZodError);
      });

      it('returns error result for invalid yaml', async () => {
        httpMock.scope('http://example.com').get('/').reply(200, '!@#$%^');

        const { val, err } = await http
          .getYamlSafe('http://example.com', Some)
          .unwrap();

        expect(val).toBeUndefined();
        expect(err).toBeDefined();
      });

      it('returns error result for network errors', async () => {
        httpMock
          .scope('http://example.com')
          .get('/')
          .replyWithError('network error');

        const { val, err } = await http
          .getYamlSafe('http://example.com', Some)
          .unwrap();

        expect(val).toBeUndefined();
        expect(err).toBeInstanceOf(HttpError);
      });

      it('works with options and schema', async () => {
        httpMock
          .scope('http://example.com')
          .get('/')
          .matchHeader('custom', 'header')
          .reply(200, 'x: 2\ny: 2');

        const { val, err } = await http
          .getYamlSafe(
            'http://example.com',
            { headers: { custom: 'header' } },
            Some,
          )
          .unwrap();

        expect(val).toBe('2 + 2 = 4');
        expect(err).toBeUndefined();
      });
    });

    describe('getJson', () => {
      it('uses schema for response body', async () => {
        httpMock
          .scope(baseUrl, {
            reqheaders: {
              accept: 'application/json',
            },
          })
          .get('/')
          .reply(200, JSON.stringify({ x: 2, y: 2 }));

        const { body }: HttpResponse = await http.getJson(
          'http://renovate.com',
          { headers: { accept: 'application/json' } },
          Some,
        );

        expect(body).toBe('2 + 2 = 4');
        expect(logger.logger.once.info).not.toHaveBeenCalled();
      });

      it('throws on schema mismatch', async () => {
        httpMock
          .scope(baseUrl, {
            reqheaders: {
              accept: 'application/json',
            },
          })
          .get('/')
          .reply(200, JSON.stringify({ foo: 'bar' }));

        await expect(http.getJson('http://renovate.com', Some)).rejects.toThrow(
          z.ZodError,
        );
      });
    });

    describe('getJsonSafe', () => {
      it('uses schema for response body', async () => {
        httpMock
          .scope('http://example.com')
          .get('/')
          .reply(200, JSON.stringify({ x: 2, y: 2 }));

        const { val, err } = await http
          .getJsonSafe('http://example.com', Some)
          .unwrap();

        expect(val).toBe('2 + 2 = 4');
        expect(err).toBeUndefined();
      });

      it('returns schema error result', async () => {
        httpMock
          .scope('http://example.com')
          .get('/')
          .reply(200, JSON.stringify({ x: '2', y: '2' }));

        const { val, err } = await http
          .getJsonSafe('http://example.com', Some)
          .unwrap();

        expect(val).toBeUndefined();
        expect(err).toBeInstanceOf(ZodError);
      });

      it('returns error result', async () => {
        httpMock.scope('http://example.com').get('/').replyWithError('unknown');

        const { val, err } = await http
          .getJsonSafe('http://example.com', Some)
          .unwrap();

        expect(val).toBeUndefined();
        expect(err).toBeInstanceOf(HttpError);
      });
    });

    describe('postJson', () => {
      it('uses schema for response body', async () => {
        httpMock
          .scope(baseUrl)
          .post('/')
          .reply(200, JSON.stringify({ x: 2, y: 2 }));

        const { body }: HttpResponse = await http.postJson(
          'http://renovate.com',
          Some,
        );

        expect(body).toBe('2 + 2 = 4');
        expect(logger.logger.once.info).not.toHaveBeenCalled();
      });

      it('throws on schema mismatch', async () => {
        httpMock
          .scope(baseUrl)
          .post('/')
          .reply(200, JSON.stringify({ foo: 'bar' }));

        await expect(
          http.postJson('http://renovate.com', Some),
        ).rejects.toThrow(z.ZodError);
      });
    });
  });

  describe('Throttling', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('works without throttling', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 1 });
      httpMock.scope(baseUrl).get('/foo').twice().reply(200, 'bar');

      const t1 = Date.now();
      await http.get('http://renovate.com/foo');
      await http.get('http://renovate.com/foo');
      const t2 = Date.now();

      expect(t2 - t1).toBeLessThan(100);
    });

    it('limits request rate by host', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      httpMock.scope(baseUrl).get('/foo').twice().reply(200, 'bar');
      hostRules.add({ matchHost: 'renovate.com', maxRequestsPerSecond: 0.25 });

      const t1 = Date.now();
      await http.get('http://renovate.com/foo');
      vi.advanceTimersByTime(4000);
      await http.get('http://renovate.com/foo');
      const t2 = Date.now();

      expect(t2 - t1).toBeGreaterThanOrEqual(4000);
    });
  });

  describe('getToml', () => {
    const Some = z
      .object({ x: z.number(), y: z.number() })
      .transform(({ x, y }) => `${x} + ${y} = ${x + y}`);

    it('parses toml with schema validation', async () => {
      httpMock.scope(baseUrl).get('/').reply(200, 'x = 2\ny = 2');

      const res = await http.getToml('http://renovate.com', Some);
      expect(res.body).toBe('2 + 2 = 4');
    });

    it('parses toml with options and schema', async () => {
      httpMock
        .scope(baseUrl, {
          reqheaders: {
            'Content-Type': 'application/toml',
          },
        })
        .get('/')
        .matchHeader('custom', 'header')
        .reply(200, 'x = 2\ny = 2');

      const res = await http.getToml(
        'http://renovate.com',
        { headers: { custom: 'header' } },
        Some,
      );
      expect(res.body).toBe('2 + 2 = 4');
    });

    it('throws on schema validation failure', async () => {
      httpMock
        .scope(baseUrl, {
          reqheaders: {
            'Content-Type': 'application/toml',
          },
        })
        .get('/')
        .reply(200, 'foo = "bar"');

      await expect(http.getToml('http://renovate.com', Some)).rejects.toThrow(
        z.ZodError,
      );
    });

    it('throws on invalid toml', async () => {
      httpMock
        .scope(baseUrl, {
          reqheaders: {
            'Content-Type': 'application/toml',
          },
        })
        .get('/')
        .reply(200, '!@#$%^');

      await expect(http.getToml('http://renovate.com')).rejects.toThrow(
        'Invalid TOML',
      );
    });
  });
});
