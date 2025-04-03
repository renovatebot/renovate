import * as memCache from './cache/memory';
import { getEnv, setCustomEnv, setUserEnv } from './env';

describe('util/env', () => {
  beforeEach(() => {
    process.env = {};
    memCache.init();
  });

  describe('getEnv', () => {
    it('return combined env', () => {
      expect(getEnv()).toMatchObject({});
    });

    it('encodes aliases', () => {
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
  });
});
