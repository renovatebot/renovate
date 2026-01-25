import { processResult } from './result.ts';
import type { RenovateConfig } from '~test/util.js';
import { partial } from '~test/util.js';

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
