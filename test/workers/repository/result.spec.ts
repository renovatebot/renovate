import { processResult } from '../../../lib/workers/repository/result';
import { RenovateConfig, getConfig } from '../../util';

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig;
});

describe('workers/repository/result', () => {
  describe('processResult()', () => {
    it('runs', () => {
      processResult(config, 'done');
    });
  });
});
