import nock from 'nock';
import { getName } from '../../../test/util';
import { Http } from '.';

const baseUrl = 'http://renovate.com';

describe(getName(__filename), () => {
  let http: Http;

  beforeEach(() => {
    http = new Http('dummy');
    nock.cleanAll();
  });
  it('get', async () => {
    nock(baseUrl)
      .get('/test')
      .reply(200);
    expect(await http.get('http://renovate.com/test')).toMatchSnapshot();
    expect(nock.isDone()).toBe(true);
  });
  it('getJson', async () => {
    nock(baseUrl)
      .get('/')
      .reply(200, '{ "test": true }');
    expect(await http.getJson('http://renovate.com')).toMatchSnapshot();
  });
  it('postJson', async () => {
    nock(baseUrl)
      .post('/')
      .reply(200, {});
    expect(
      await http.postJson('http://renovate.com', { body: {}, baseUrl })
    ).toMatchSnapshot();
    expect(nock.isDone()).toBe(true);
  });

  it('stream', async () => {
    nock(baseUrl)
      .get('/some')
      .reply(200, {});

    const stream = http.stream('/some', {
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
    expect(nock.isDone()).toBe(true);
    expect(global.repoCache).toEqual({});
  });
});
