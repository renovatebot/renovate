import * as memCache from './cache/memory';
import { getEnv, setCustomEnv, setUserEnv } from './env';

describe('util/env', () => {
  beforeEach(() => {
    process.env = {};
    memCache.init();
  });

  describe('getEnv', () => {
    it('return combined env', () => {
      process.env.RENOVATE_MEND_HOSTED = 'true';
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
      process.env.SOME_KEY = 'processEnvValue';
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
