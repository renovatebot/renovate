import type { RenovateConfig } from '~test/util.ts';
import { partial } from '~test/util.ts';
import { processResult } from './result.ts';

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
