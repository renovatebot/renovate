import { Got } from 'got';
import { GotResponse } from '../../../lib/platform';
import { partial } from '../../util';
import { GiteaGotApi } from '../../../lib/platform/gitea/gitea-got-wrapper';

describe('platform/gitea/gitea-got-wrapper', () => {
  let api: GiteaGotApi;
  let got: jest.Mocked<Got> & jest.Mock;

  const baseURL = 'https://gitea.renovatebot.com/api/v1';

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.mock('../../../lib/util/got');

    api = (await import('../../../lib/platform/gitea/gitea-got-wrapper')).api;
    got = (await import('../../../lib/util/got')).api as any;
    api.setBaseUrl(baseURL);
  });

  it('supports responses without pagination when enabled', async () => {
    got.mockResolvedValueOnce(
      partial<GotResponse>({
        body: { hello: 'world' },
      })
    );

    const res = await api.get('pagination-example-1', { paginate: true });
    expect(res.body).toEqual({ hello: 'world' });
  });

  it('supports root-level pagination', async () => {
    got.mockResolvedValueOnce(
      partial<GotResponse>({
        body: ['abc', 'def', 'ghi'],
        headers: { 'x-total-count': '5' },
        url: `${baseURL}/pagination-example-1`,
      })
    );
    got.mockResolvedValueOnce(
      partial<GotResponse>({
        body: ['jkl'],
      })
    );
    got.mockResolvedValueOnce(
      partial<GotResponse>({
        body: ['mno', 'pqr'],
      })
    );

    const res = await api.get('pagination-example-1', { paginate: true });

    expect(res.body).toHaveLength(6);
    expect(res.body).toEqual(['abc', 'def', 'ghi', 'jkl', 'mno', 'pqr']);
    expect(got).toHaveBeenCalledTimes(3);
  });

  it('supports pagination on data property', async () => {
    got.mockResolvedValueOnce(
      partial<GotResponse>({
        body: { data: ['abc', 'def', 'ghi'] },
        headers: { 'x-total-count': '5' },
        url: `${baseURL}/pagination-example-2`,
      })
    );
    got.mockResolvedValueOnce(
      partial<GotResponse>({
        body: { data: ['jkl'] },
      })
    );
    got.mockResolvedValueOnce(
      partial<GotResponse>({
        body: { data: ['mno', 'pqr'] },
      })
    );

    const res = await api.get('pagination-example-2', { paginate: true });

    expect(res.body.data).toHaveLength(6);
    expect(res.body.data).toEqual(['abc', 'def', 'ghi', 'jkl', 'mno', 'pqr']);
    expect(got).toHaveBeenCalledTimes(3);
  });
});
