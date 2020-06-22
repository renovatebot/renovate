import * as runCache_ from '../../util/cache/run';
import { printRequestStats } from './stats';

jest.mock('../../util/cache/run');

const runCache: any = runCache_ as any;

describe('workers/repository/stats', () => {
  describe('printRequestStats()', () => {
    it('runs', () => {
      runCache.get = jest.fn(() => [
        {
          method: 'get',
          url: 'https://api.github.com/api/v3/user',
          duration: 100,
        },
        {
          method: 'post',
          url: 'https://api.github.com/graphql',
          duration: 130,
        },
        {
          method: 'post',
          url: 'https://api.github.com/graphql',
          duration: 150,
        },
        {
          method: 'get',
          url: 'https://api.github.com/api/v3/repositories',
          duration: 500,
        },
        { method: 'get', url: 'https://auth.docker.io', duration: 200 },
      ]);
      expect(printRequestStats()).toBeUndefined();
    });
  });
});
