import { RenovateConfig, getConfig } from '../../../test/util';
import { processResult } from './result';

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
