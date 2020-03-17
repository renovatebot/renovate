import nock from 'nock';
import { getName } from '../../../test/util';
import { api } from '.';
import * as hostRules from '../host-rules';
import { GotJSONOptions } from './common';
import {
  PLATFORM_TYPE_GITEA,
  PLATFORM_TYPE_GITLAB,
  PLATFORM_TYPE_GITHUB,
} from '../../constants/platforms';

const baseUrl = 'https://api.github.com';

describe(getName(__filename), () => {
  beforeEach(() => {
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    hostRules.clear();
    global.repoCache = {};
    nock.enableNetConnect();
  });

  async function got(opts?: Partial<GotJSONOptions>) {
    const { body, request } = (await api('some', {
      method: 'GET',
      baseUrl,
      json: true,
      ...opts,
    })) as any;
    return { body, options: request.gotOptions };
  }

  function mock(opts?: nock.Options, times = 1) {
    return nock(baseUrl, opts)
      .get('/some')
      .times(times)
      .reply(200, {});
  }

  it('uses  bearer auth', async () => {
    const req = mock({ reqheaders: { authorization: 'Bearer XXX' } }, 2);
    hostRules.add({ baseUrl, token: 'XXX' });

    expect(await got()).toMatchSnapshot();
    expect(await got({ token: 'XXX' })).toMatchSnapshot();
    expect(req.isDone()).toBe(true);
  });

  it('uses  basic auth', async () => {
    const req = mock({ reqheaders: { authorization: 'Basic OnRlc3Q=' } }, 2);

    hostRules.add({ password: 'test', timeout: 60000 });

    expect(await got()).toMatchSnapshot();
    expect(await got({ auth: ':test' })).toMatchSnapshot();
    expect(req.isDone()).toBe(true);
  });

  it('uses token auth', async () => {
    const req = mock({ reqheaders: { authorization: 'token XXX' } });
    hostRules.add({ baseUrl, token: 'XXX' });
    expect(await got({ hostType: PLATFORM_TYPE_GITEA })).toMatchSnapshot();
    expect(req.isDone()).toBe(true);
  });

  it('uses private-token auth', async () => {
    const req = mock({ reqheaders: { 'private-token': 'XXX' } });
    hostRules.add({ baseUrl, token: 'XXX' });
    global.repoCache = null;
    expect(await got({ hostType: PLATFORM_TYPE_GITLAB })).toMatchSnapshot();
    expect(req.isDone()).toBe(true);
  });

  it('uses cache', async () => {
    const req = mock();
    const res = await got({ hostType: PLATFORM_TYPE_GITHUB });
    expect(res).toMatchSnapshot();
    expect(await got({ hostType: PLATFORM_TYPE_GITHUB })).toMatchObject(res);
    expect(req.isDone()).toBe(true);
  });

  it('uses no cache', async () => {
    const req = mock({})
      .head('/some')
      .reply(200, {})
      .get('/some')
      .replyWithError('not-found');

    expect(
      await got({
        hostType: PLATFORM_TYPE_GITHUB,
        useCache: false,
      })
    ).toMatchSnapshot();

    expect(
      await got({ hostType: PLATFORM_TYPE_GITHUB, method: 'HEAD' })
    ).toMatchSnapshot();

    global.repoCache = {};

    await expect(got({ hostType: PLATFORM_TYPE_GITHUB })).rejects.toThrowError(
      'not-found'
    );

    expect(req.isDone()).toBe(true);
    expect(global.repoCache).toEqual({});
  });

  it('streams no cache', async () => {
    const req = mock();

    const stream = api.stream('/some', {
      baseUrl,
    });
    expect(stream).toBeDefined();

    let data = '';

    stream.on('data', c => {
      data += c;
    });

    const done = new Promise((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    await done;

    expect(data).toBe('{}');
    expect(req.isDone()).toBe(true);
    expect(global.repoCache).toEqual({});
  });
});
