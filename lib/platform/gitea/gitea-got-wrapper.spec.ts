import * as httpMock from '../../../test/httpMock';
import { api } from './gitea-got-wrapper';

describe('platform/gitea/gitea-got-wrapper', () => {
  const baseUrl = 'https://gitea.renovatebot.com/api/v1';

  beforeEach(() => {
    jest.resetAllMocks();

    httpMock.reset();
    httpMock.setup();

    api.setBaseUrl(baseUrl);
  });

  it('supports responses without pagination when enabled', async () => {
    httpMock
      .scope(baseUrl)
      .get('/pagination-example-1')
      .reply(200, { hello: 'world' });

    const res = await api.get('pagination-example-1', { paginate: true });
    expect(res.body).toEqual({ hello: 'world' });
    expect(httpMock.getTrace()).toMatchSnapshot();
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

    const res = await api.get(`${baseUrl}/pagination-example-1`, {
      paginate: true,
    });
    httpMock.getTrace();

    expect(res.body).toHaveLength(6);
    expect(res.body).toEqual(['abc', 'def', 'ghi', 'jkl', 'mno', 'pqr']);
    expect(httpMock.getTrace()).toMatchSnapshot();
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

    const res = await api.get('pagination-example-2', { paginate: true });
    expect(res.body.data).toHaveLength(6);
    expect(res.body.data).toEqual(['abc', 'def', 'ghi', 'jkl', 'mno', 'pqr']);
    expect(httpMock.getTrace()).toMatchSnapshot();
  });
});
