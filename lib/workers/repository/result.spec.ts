import type { RenovateConfig } from '../../../test/util';
import { partial } from '../../../test/util';
import { processResult } from './result';

let config: RenovateConfig;

beforeEach(() => {
  config = partial<RenovateConfig>({
    repoIsActivated: true,
    repoIsOnboarded: true,
  });
});

describe('workers/repository/result', () => {
  describe('processResult()', () => {
    it('runs', () => {
      const result = processResult(config, 'done');
      expect(result).not.toBeNil();
    });
  });
});
