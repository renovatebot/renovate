import { processResult } from './result';
import { RenovateConfig, getConfig } from '../../../test/util';

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
});

describe('workers/repository/result', () => {
  describe('processResult()', () => {
    it('runs', () => {
      processResult(config, 'done');
    });
  });
});
