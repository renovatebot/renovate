import { getName } from '../../../test/util';
import * as memCache_ from '../../util/cache/memory';
import { printRequestStats } from './stats';

jest.mock('../../util/cache/memory');

const memCache: any = memCache_ as any;

describe(getName(__filename), () => {
  describe('printRequestStats()', () => {
    it('runs', () => {
      memCache.get = jest.fn(() => [
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
