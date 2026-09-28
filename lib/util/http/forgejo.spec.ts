import * as httpMock from '~test/http-mock.ts';
import * as hostRules from '../host-rules.ts';
import { ForgejoHttp, setBaseUrl } from './forgejo.ts';
import { setBaseUrl as setGiteaBaseUrl } from './gitea.ts';

describe('util/http/forgejo', () => {
  const baseUrl = 'https://code.forgejo.org/api/v1';

  let forgejoHttp: ForgejoHttp;

  beforeEach(() => {
    forgejoHttp = new ForgejoHttp();
    hostRules.clear();

    setBaseUrl(baseUrl);
    setGiteaBaseUrl('https://gitea.renovatebot.com/api/v1');
  });

  it('resolves relative urls against its own base url', async () => {
    httpMock.scope(baseUrl).get('/some/path').reply(200, { hello: 'world' });

    const res = await forgejoHttp.getJsonUnchecked('some/path');

    expect(res.body).toEqual({ hello: 'world' });
  });

  it('uses the forgejo host type by default', async () => {
    hostRules.add({ hostType: 'forgejo', token: 'secret' });
    httpMock
      .scope(baseUrl, { reqheaders: { authorization: 'Bearer secret' } })
      .get('/some/path')
      .reply(200, { hello: 'world' });

    const res = await forgejoHttp.getJsonUnchecked('some/path');

    expect(res.body).toEqual({ hello: 'world' });
  });

  it('paginates like gitea', async () => {
    httpMock
      .scope(baseUrl)
      .get('/pagination-example-1')
      .reply(200, ['abc', 'def', 'ghi'], { 'x-total-count': '4' })
      .get('/pagination-example-1?page=2')
      .reply(200, ['jkl']);

    const res = await forgejoHttp.getJsonUnchecked('pagination-example-1', {
      paginate: true,
    });

    expect(res.body).toEqual(['abc', 'def', 'ghi', 'jkl']);
  });
});
