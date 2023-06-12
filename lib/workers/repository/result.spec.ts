import { RenovateConfig, partial } from '../../../test/util';
import { processResult } from './result';

// default values
let config = partial<RenovateConfig>({
  repoIsActivated: true,
  repoIsOnboarded: true,
});

beforeEach(() => {
  jest.resetAllMocks();
});

describe('workers/repository/result', () => {
  describe('processResult()', () => {
    it('runs', () => {
      const result = processResult(config, 'done');
      expect(result).not.toBeNil();
    });
  });
});
