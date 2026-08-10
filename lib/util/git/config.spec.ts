import { logger } from '~test/util.ts';
import { GlobalConfig } from '../../config/global.ts';
import {
  addGitConfigEnvironmentVariables,
  setNoVerify,
  simpleGitConfig,
} from './config.ts';

describe('util/git/config', () => {
  beforeEach(() => {
    GlobalConfig.reset();
    setCustomEnv({});
    setNoVerify(['push', 'commit']);
  });

  afterEach(() => {
    delete process.env.GIT_CONFIG_COUNT;
    delete process.env.GIT_CONFIG_KEY_0;
    delete process.env.GIT_CONFIG_KEY_1;
    delete process.env.GIT_CONFIG_VALUE_0;
    delete process.env.GIT_CONFIG_VALUE_1;
  });

  it('uses "close" events, ignores "exit" events from child processes', () => {
    expect(simpleGitConfig()).toEqual({
      completion: { onClose: true, onExit: false },
      config: ['core.quotePath=false'],
      unsafe: {
        allowUnsafeAskPass: true,
        allowUnsafeSshCommand: true,
        allowUnsafeConfigEnvCount: true,
      },
    });
  });

  it('uses timeout value from GlobalConfig', () => {
    GlobalConfig.set({ gitTimeout: 50000 });
    expect(simpleGitConfig()).toEqual({
      completion: { onClose: true, onExit: false },
      timeout: {
        block: 50000,
      },
      config: ['core.quotePath=false'],
      unsafe: {
        allowUnsafeAskPass: true,
        allowUnsafeSshCommand: true,
        allowUnsafeConfigEnvCount: true,
      },
    });
  });

  it('allows clearing Git hooks from the environment', () => {
    setCustomEnv({ RENOVATE_X_CLEAR_HOOKS: 'true' });

    expect(simpleGitConfig()).toMatchObject({
      unsafe: { allowUnsafeHooksPath: true },
    });
  });

  it('sets the commands that skip Git hooks', () => {
    setNoVerify(['commit']);

    expect(getNoVerify()).toEqual(['commit']);
  });

  it('throws', () => {
    // @ts-expect-error -- testing invalid input
    expect(() => setNoVerify(1)).toThrow(
      'config error: gitNoVerify should be an array of strings',
    );
  });

  it('appends entries without modifying the supplied environment', () => {
    const environmentVariables = {
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'existing-key',
      GIT_CONFIG_VALUE_0: 'existing-value',
      RANDOM_VARIABLE: 'random',
    };

    expect(
      addGitConfigEnvironmentVariables(environmentVariables, [
        { key: 'first-key', value: 'first-value' },
        { key: 'second-key', value: 'second-value' },
      ]),
    ).toStrictEqual({
      GIT_CONFIG_COUNT: '3',
      GIT_CONFIG_KEY_0: 'existing-key',
      GIT_CONFIG_KEY_1: 'first-key',
      GIT_CONFIG_KEY_2: 'second-key',
      GIT_CONFIG_VALUE_0: 'existing-value',
      GIT_CONFIG_VALUE_1: 'first-value',
      GIT_CONFIG_VALUE_2: 'second-value',
      RANDOM_VARIABLE: 'random',
    });
    expect(environmentVariables).toStrictEqual({
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'existing-key',
      GIT_CONFIG_VALUE_0: 'existing-value',
      RANDOM_VARIABLE: 'random',
    });
  });

  it('supports repeated additions', () => {
    const firstEnvironment = addGitConfigEnvironmentVariables({}, [
      { key: 'first-key', value: 'first-value' },
    ]);

    expect(
      addGitConfigEnvironmentVariables(firstEnvironment, [
        { key: 'second-key', value: 'second-value' },
      ]),
    ).toStrictEqual({
      GIT_CONFIG_COUNT: '2',
      GIT_CONFIG_KEY_0: 'first-key',
      GIT_CONFIG_KEY_1: 'second-key',
      GIT_CONFIG_VALUE_0: 'first-value',
      GIT_CONFIG_VALUE_1: 'second-value',
    });
  });

  it('ignores an invalid Git configuration count', () => {
    expect(
      addGitConfigEnvironmentVariables({ GIT_CONFIG_COUNT: 'invalid' }, [
        { key: 'new-key', value: 'new-value' },
      ]),
    ).toStrictEqual({
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'new-key',
      GIT_CONFIG_VALUE_0: 'new-value',
    });
    expect(logger.logger.warn).toHaveBeenCalledWith(
      { GIT_CONFIG_COUNT: 'invalid' },
      `Found GIT_CONFIG_COUNT env variable, but couldn't parse the value to an integer. Ignoring it.`,
    );
  });
});
