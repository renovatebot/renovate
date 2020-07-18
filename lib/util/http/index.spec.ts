import nock from 'nock';
import { getName } from '../../../test/util';
import {
  EXTERNAL_HOST_ERROR,
  HOST_DISABLED,
} from '../../constants/error-messages';
import * as hostRules from '../host-rules';
import { Http } from '.';

const baseUrl = 'http://renovate.com';

describe(getName(__filename), () => {
  let http: Http;

  beforeEach(() => {
    http = new Http('dummy');
    nock.cleanAll();
    hostRules.clear();
  });
  it('get', async () => {
    nock(baseUrl).get('/test').reply(200);
    expect(await http.get('http://renovate.com/test')).toMatchSnapshot();
    expect(nock.isDone()).toBe(true);
  });
  it('returns 429 error', async () => {
    nock(baseUrl).get('/test').reply(429);
    await expect(http.get('http://renovate.com/test')).rejects.toThrow(
      'Response code 429 (Too Many Requests)'
    );
    expect(nock.isDone()).toBe(true);
  });
  it('converts 404 error to ExternalHostError', async () => {
    nock(baseUrl).get('/test').reply(404);
    hostRules.add({ abortOnError: true });
    await expect(http.get('http://renovate.com/test')).rejects.toThrow(
      EXTERNAL_HOST_ERROR
    );
    expect(nock.isDone()).toBe(true);
  });
  it('disables hosts', async () => {
    hostRules.add({ hostName: 'renovate.com', enabled: false });
    await expect(http.get('http://renovate.com/test')).rejects.toThrow(
      HOST_DISABLED
    );
  });
  it('ignores 404 error and does not throw ExternalHostError', async () => {
    nock(baseUrl).get('/test').reply(404);
    hostRules.add({ abortOnError: true, abortIgnoreStatusCodes: [404] });
    await expect(http.get('http://renovate.com/test')).rejects.toThrow(
      'Response code 404 (Not Found)'
    );
    expect(nock.isDone()).toBe(true);
  });
  it('getJson', async () => {
    nock(baseUrl).get('/').reply(200, '{ "test": true }');
    expect(await http.getJson('http://renovate.com')).toMatchSnapshot();
  });
  it('postJson', async () => {
    nock(baseUrl).post('/').reply(200, {});
    expect(
      await http.postJson('http://renovate.com', { body: {}, baseUrl })
    ).toMatchSnapshot();
    expect(nock.isDone()).toBe(true);
  });
  it('putJson', async () => {
    nock(baseUrl).put('/').reply(200, {});
    expect(
      await http.putJson('http://renovate.com', { body: {}, baseUrl })
    ).toMatchSnapshot();
    expect(nock.isDone()).toBe(true);
  });
  it('patchJson', async () => {
    nock(baseUrl).patch('/').reply(200, {});
    expect(
      await http.patchJson('http://renovate.com', { body: {}, baseUrl })
    ).toMatchSnapshot();
    expect(nock.isDone()).toBe(true);
  });
  it('deleteJson', async () => {
    nock(baseUrl).delete('/').reply(200, {});
    expect(
      await http.deleteJson('http://renovate.com', { body: {}, baseUrl })
    ).toMatchSnapshot();
    expect(nock.isDone()).toBe(true);
  });
  it('headJson', async () => {
    nock(baseUrl).head('/').reply(200, {});
    expect(
      await http.headJson('http://renovate.com', { baseUrl })
    ).toMatchSnapshot();
    expect(nock.isDone()).toBe(true);
  });

  it('stream', async () => {
    nock(baseUrl).get('/some').reply(200, {});

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
    expect(nock.isDone()).toBe(true);
  });

  it('retries', async () => {
    const NODE_ENV = process.env.NODE_ENV;
    try {
      delete process.env.NODE_ENV;
      nock(baseUrl)
        .head('/')
        .reply(500)
        .head('/')
        .reply(200, undefined, { 'x-some-header': 'abc' });
      expect(await http.head('http://renovate.com')).toMatchSnapshot();
      expect(nock.isDone()).toBe(true);
    } finally {
      process.env.NODE_ENV = NODE_ENV;
    }
  });
});
