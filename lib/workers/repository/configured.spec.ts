import { checkIfConfigured } from './configured';
import type { RenovateConfig } from '~test/util';
import { partial } from '~test/util';

let config: RenovateConfig;

beforeEach(() => {
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
