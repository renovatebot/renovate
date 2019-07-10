import * as utils from '../../../lib/platform/bitbucket/utils';
import { GotApi } from '../../../lib/platform/common';

jest.mock('../../../lib/platform/bitbucket/bb-got-wrapper');

const api: jest.Mocked<
  GotApi
> = require('../../../lib/platform/bitbucket/bb-got-wrapper').api;

const range = (count: number) => [...Array(count).keys()];

describe('accumulateValues()', () => {
  it('paginates', async () => {
    api.get.mockReturnValueOnce({
      body: {
        values: range(10),
        next:
          'https://api.bitbucket.org/2.0/repositories/?pagelen=10&after=9&role=contributor',
      },
    } as any);
    api.get.mockReturnValueOnce({
      body: {
        values: range(10),
        next:
          'https://api.bitbucket.org/2.0/repositories/?pagelen=10&after=19&role=contributor',
      },
    } as any);
    api.get.mockReturnValueOnce({
      body: {
        values: range(5),
      },
    } as any);
    const res = await utils.accumulateValues('some-url', 'get', null, 10);
    expect(res).toHaveLength(25);
    expect(api.get).toHaveBeenCalledTimes(3);
  });
});
