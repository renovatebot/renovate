import { RenovateConfig, partial } from '../../../test/util';
import { checkIfConfigured } from './configured';

let config: RenovateConfig;

beforeEach(() => {
  jest.resetAllMocks();
  config = partial<RenovateConfig>({
    enabled: true,
    forkProcessing: 'auto',
  });
});

describe('workers/repository/configured', () => {
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
      expect(() => checkIfConfigured(config)).toThrow();
    });
  });
});
