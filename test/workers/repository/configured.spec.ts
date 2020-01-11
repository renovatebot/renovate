import { checkIfConfigured } from '../../../lib/workers/repository/configured';
import { getConfig, RenovateConfig } from '../../util';

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig;
});

describe('workers/repository/configured', () => {
  describe('checkIfConfigured()', () => {
    it('returns', () => {
      checkIfConfigured(config);
    });
    it('throws if disabled', () => {
      config.enabled = false;
      expect(() => checkIfConfigured(config)).toThrow();
    });
    it('throws if unconfigured fork', () => {
      config.enabled = true;
      config.isFork = true;
      config.renovateJsonPresent = false;
      expect(() => checkIfConfigured(config)).toThrow();
    });
  });
});
