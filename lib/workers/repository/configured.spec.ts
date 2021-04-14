import { RenovateConfig, getConfig, getName } from '../../../test/util';
import { checkIfConfigured } from './configured';

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
});

describe(getName(__filename), () => {
  describe('checkIfConfigured()', () => {
    it('returns', () => {
      expect(() => checkIfConfigured(config)).not.toThrow();
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
