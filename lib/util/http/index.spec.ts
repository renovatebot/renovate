import { z } from 'zod';
import * as httpMock from '../../../test/http-mock';
import { logger } from '../../../test/util';
import {
  EXTERNAL_HOST_ERROR,
  HOST_DISABLED,
} from '../../constants/error-messages';
import * as memCache from '../cache/memory';
import * as hostRules from '../host-rules';
import * as queue from './queue';
import * as throttle from './throttle';
import type { HttpResponse } from './types';
import { Http } from '.';

const baseUrl = 'http://renovate.com';

describe('util/http/index', () => {
  let http: Http;

  beforeEach(() => {
    http = new Http('dummy');
    hostRules.clear();
    queue.clear();
    throttle.clear();
  });

  it('get', async () => {
    httpMock.scope(baseUrl).get('/test').reply(200);
    expect(await http.get('http://renovate.com/test')).toEqual({
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
      'Response code 429 (Too Many Requests)'
    );
    expect(httpMock.allUsed()).toBeTrue();
  });

  it('converts 404 error to ExternalHostError', async () => {
    httpMock.scope(baseUrl).get('/test').reply(404);
    hostRules.add({ abortOnError: true });
    await expect(http.get('http://renovate.com/test')).rejects.toThrow(
      EXTERNAL_HOST_ERROR
    );
    expect(httpMock.allUsed()).toBeTrue();
  });

  it('disables hosts', async () => {
    hostRules.add({ matchHost: 'renovate.com', enabled: false });
    await expect(http.get('http://renovate.com/test')).rejects.toThrow(
      HOST_DISABLED
    );
  });

  it('ignores 404 error and does not throw ExternalHostError', async () => {
    httpMock.scope(baseUrl).get('/test').reply(404);
    hostRules.add({ abortOnError: true, abortIgnoreStatusCodes: [404] });
    await expect(http.get('http://renovate.com/test')).rejects.toThrow(
      'Response code 404 (Not Found)'
    );
    expect(httpMock.allUsed()).toBeTrue();
  });

  it('getJson', async () => {
    httpMock
      .scope(baseUrl, {
        reqheaders: {
          accept: 'application/json',
        },
      })
      .get('/')
      .reply(200, '{ "test": true }');
    expect(await http.getJson('http://renovate.com')).toEqual({
      authorization: false,
      body: {
        test: true,
      },
      headers: {},
      statusCode: 200,
    });
  });

  it('postJson', async () => {
    httpMock.scope(baseUrl).post('/').reply(200, {});
    expect(
      await http.postJson('http://renovate.com', { body: {}, baseUrl })
    ).toEqual({
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
    expect(
      await http.putJson('http://renovate.com', { body: {}, baseUrl })
    ).toEqual({
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
    expect(
      await http.patchJson('http://renovate.com', { body: {}, baseUrl })
    ).toEqual({
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
    expect(
      await http.deleteJson('http://renovate.com', { body: {}, baseUrl })
    ).toEqual({
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
    httpMock.scope(baseUrl).head('/').reply(200, {});
    expect(await http.headJson('http://renovate.com', { baseUrl })).toEqual({
      authorization: false,
      body: {},
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
      HOST_DISABLED
    );
  });

  it('retries', async () => {
    const NODE_ENV = process.env.NODE_ENV;
    try {
      delete process.env.NODE_ENV;
      httpMock
        .scope(baseUrl)
        .head('/')
        .reply(500)
        .head('/')
        .reply(200, undefined, { 'x-some-header': 'abc' });
      expect(await http.head('http://renovate.com')).toEqual({
        authorization: false,
        body: '',
        headers: {
          'x-some-header': 'abc',
        },
        statusCode: 200,
      });
      expect(httpMock.allUsed()).toBeTrue();
    } finally {
      process.env.NODE_ENV = NODE_ENV;
    }
  });

  it('limits concurrency by host', async () => {
    hostRules.add({ matchHost: 'renovate.com', concurrentRequestLimit: 1 });

    let foo = false;
    let bar = false;
    let baz = false;

    const dummyResolve = (_: unknown): void => {
      return;
    };

    interface MockedRequestResponse<T = unknown> {
      request: Promise<T>;
      resolveRequest: (_?: T) => void;
      response: Promise<T>;
      resolveResponse: (_?: T) => void;
    }

    const mockRequestResponse = (): MockedRequestResponse => {
      let resolveRequest = dummyResolve;
      const request = new Promise((resolve) => {
        resolveRequest = resolve;
      });

      let resolveResponse = dummyResolve;
      const response = new Promise((resolve) => {
        resolveResponse = resolve;
      });

      return { request, resolveRequest, response, resolveResponse };
    };

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
    expect(res?.body).toBeInstanceOf(Buffer);
    expect(res?.body.toString('utf-8')).toBe('test');
  });

  describe('Schema support', () => {
    const SomeSchema = z
      .object({ x: z.number(), y: z.number() })
      .transform(({ x, y }) => `${x} + ${y} = ${x + y}`);

    beforeEach(() => {
      jest.resetAllMocks();
      memCache.init();
    });

    afterEach(() => {
      memCache.reset();
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

        const { body }: HttpResponse<string> = await http.getJson(
          'http://renovate.com',
          { headers: { accept: 'application/json' } },
          SomeSchema
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

        await expect(
          http.getJson('http://renovate.com', SomeSchema)
        ).rejects.toThrow(z.ZodError);
      });
    });

    describe('postJson', () => {
      it('uses schema for response body', async () => {
        httpMock
          .scope(baseUrl)
          .post('/')
          .reply(200, JSON.stringify({ x: 2, y: 2 }));

        const { body }: HttpResponse<string> = await http.postJson(
          'http://renovate.com',
          SomeSchema
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
          http.postJson('http://renovate.com', SomeSchema)
        ).rejects.toThrow(z.ZodError);
      });
    });
  });

  describe('Throttling', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('works without throttling', async () => {
      jest.useFakeTimers({ advanceTimers: 1 });
      httpMock.scope(baseUrl).get('/foo').twice().reply(200, 'bar');

      const t1 = Date.now();
      await http.get('http://renovate.com/foo');
      await http.get('http://renovate.com/foo');
      const t2 = Date.now();

      expect(t2 - t1).toBeLessThan(100);
    });

    it('limits request rate by host', async () => {
      jest.useFakeTimers({ advanceTimers: true });
      httpMock.scope(baseUrl).get('/foo').twice().reply(200, 'bar');
      hostRules.add({ matchHost: 'renovate.com', maxRequestsPerSecond: 0.25 });

      const t1 = Date.now();
      await http.get('http://renovate.com/foo');
      jest.advanceTimersByTime(4000);
      await http.get('http://renovate.com/foo');
      const t2 = Date.now();

      expect(t2 - t1).toBeGreaterThanOrEqual(4000);
    });
  });

  describe('Etag caching', () => {
    it('returns cached data for status=304', async () => {
      type FooBar = { foo: string; bar: string };
      const data: FooBar = { foo: 'foo', bar: 'bar' };
      httpMock
        .scope(baseUrl, { reqheaders: { 'If-None-Match': 'foobar' } })
        .get('/foo')
        .reply(304);

      const res = await http.getJson<FooBar>(`/foo`, {
        baseUrl,
        etagCache: {
          etag: 'foobar',
          data,
        },
      });

      expect(res.statusCode).toBe(304);
      expect(res.body).toEqual(data);
      expect(res.body).not.toBe(data);
    });

    it('bypasses schema parsing', async () => {
      const FooBar = z
        .object({ foo: z.string(), bar: z.string() })
        .transform(({ foo, bar }) => ({
          foobar: `${foo}${bar}`.toUpperCase(),
        }));
      const data = FooBar.parse({ foo: 'foo', bar: 'bar' });
      httpMock
        .scope(baseUrl, { reqheaders: { 'If-None-Match': 'foobar' } })
        .get('/foo')
        .reply(304);

      const res = await http.getJson(
        `/foo`,
        {
          baseUrl,
          etagCache: {
            etag: 'foobar',
            data,
          },
        },
        FooBar
      );

      expect(res.statusCode).toBe(304);
      expect(res.body).toEqual(data);
      expect(res.body).not.toBe(data);
    });

    it('returns new data for status=200', async () => {
      type FooBar = { foo: string; bar: string };
      const oldData: FooBar = { foo: 'foo', bar: 'bar' };
      const newData: FooBar = { foo: 'FOO', bar: 'BAR' };
      httpMock
        .scope(baseUrl, { reqheaders: { 'If-None-Match': 'foobar' } })
        .get('/foo')
        .reply(200, newData);

      const res = await http.getJson<FooBar>(`/foo`, {
        baseUrl,
        etagCache: {
          etag: 'foobar',
          data: oldData,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(newData);
      expect(res.body).not.toBe(newData);
    });
  });
});
