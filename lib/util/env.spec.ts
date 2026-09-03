import { clearEnv } from '~test/util.ts';
import * as memCache from './cache/memory/index.ts';
import { getEnv, setCustomEnv, setUserEnv } from './env.ts';

describe('util/env', () => {
  beforeEach(() => {
    clearEnv();
    memCache.init();
  });

  describe('getEnv', () => {
    it('return combined env', () => {
      vi.stubEnv('RENOVATE_MEND_HOSTED', 'true');
      setUserEnv({
        SOME_KEY: 'SOME_VALUE',
      });
      setCustomEnv({
        SOME_CUSTOM_ENV_KEY: 'SOME_CUSTOM_ENV_VALUE',
      });
      expect(getEnv()).toMatchObject({
        RENOVATE_MEND_HOSTED: 'true',
        SOME_KEY: 'SOME_VALUE',
        SOME_CUSTOM_ENV_KEY: 'SOME_CUSTOM_ENV_VALUE',
      });
    });

    it('maintains precendence', () => {
      vi.stubEnv('SOME_KEY', 'processEnvValue');
      setUserEnv({
        SOME_KEY: 'userEnvValue',
      });
      setCustomEnv({
        SOME_KEY: 'customValue',
      });
      expect(getEnv()).toMatchObject({
        SOME_KEY: 'userEnvValue',
      });
    });
  });
});
