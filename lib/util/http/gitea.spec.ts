import * as httpMock from '../../../test/http-mock';
import { GiteaHttp, setBaseUrl } from './gitea';

describe('util/http/gitea', () => {
  const baseUrl = 'https://gitea.renovatebot.com/api/v1';

  let giteaHttp: GiteaHttp;

  beforeEach(() => {
    giteaHttp = new GiteaHttp();

    setBaseUrl(baseUrl);
  });

  it('supports responses without pagination when enabled', async () => {
    httpMock
      .scope(baseUrl)
      .get('/pagination-example-1')
      .reply(200, { hello: 'world' });

    const res = await giteaHttp.getJson('pagination-example-1', {
      paginate: true,
    });
    expect(res.body).toEqual({ hello: 'world' });
  });

  it('supports root-level pagination', async () => {
    httpMock
      .scope(baseUrl)
      .get('/pagination-example-1')
      .reply(200, ['abc', 'def', 'ghi'], { 'x-total-count': '5' })
      .get('/pagination-example-1?page=2')
      .reply(200, ['jkl'])
      .get('/pagination-example-1?page=3')
      .reply(200, ['mno', 'pqr']);

    const res = await giteaHttp.getJson(`${baseUrl}/pagination-example-1`, {
      paginate: true,
    });

    expect(res.body).toHaveLength(6);
    expect(res.body).toEqual(['abc', 'def', 'ghi', 'jkl', 'mno', 'pqr']);
  });

  it('supports pagination on data property', async () => {
    httpMock
      .scope(baseUrl)
      .get('/pagination-example-2')
      .reply(200, { data: ['abc', 'def', 'ghi'] }, { 'x-total-count': '5' })
      .get('/pagination-example-2?page=2')
      .reply(200, { data: ['jkl'] })
      .get('/pagination-example-2?page=3')
      .reply(200, { data: ['mno', 'pqr'] });

    const res = await giteaHttp.getJson<{ data: string[] }>(
      'pagination-example-2',
      {
        paginate: true,
      },
    );
    expect(res.body.data).toHaveLength(6);
    expect(res.body.data).toEqual(['abc', 'def', 'ghi', 'jkl', 'mno', 'pqr']);
  });

  it('handles pagination with empty response', async () => {
    httpMock
      .scope(baseUrl)
      .get('/pagination-example-3')
      .reply(200, { data: ['abc', 'def', 'ghi'] }, { 'x-total-count': '5' })
      .get('/pagination-example-3?page=2')
      .reply(200, { data: [] });

    const res = await giteaHttp.getJson<{ data: string[] }>(
      'pagination-example-3',
      {
        paginate: true,
      },
    );
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data).toEqual(['abc', 'def', 'ghi']);
  });
});
