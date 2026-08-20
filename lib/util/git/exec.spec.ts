import { GlobalConfig } from '../../config/global.ts';
import { setCustomEnv, setUserEnv } from '../env.ts';
import { exec as _exec } from '../exec/index.ts';
import { add, clear } from '../host-rules.ts';
import { withGitEnvironment } from './exec.ts';

vi.mock('../exec/index.ts');

const exec = vi.mocked(_exec);

describe('util/git/exec', () => {
  beforeEach(() => {
    GlobalConfig.reset();
    setCustomEnv({});
    setUserEnv({});
    clear();
  });

  afterEach(() => {
    delete process.env.GIT_CONFIG_COUNT;
    delete process.env.GIT_CONFIG_KEY_0;
    delete process.env.GIT_CONFIG_VALUE_0;
  });

  it('appends authentication to approved runtime Git configuration', async () => {
    exec.mockResolvedValue({ stdout: '', stderr: '' });
    const gitExec = withGitEnvironment();
    setCustomEnv({
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'existing-key',
      GIT_CONFIG_VALUE_0: 'existing-value',
    });
    add({
      hostType: 'github',
      matchHost: 'api.github.com',
      token: 'token123',
    });

    await gitExec('command', {
      extraEnv: { EXTRA_VARIABLE: 'extra' },
      env: { FORCED_VARIABLE: 'forced' },
      docker: {
        envVars: ['EXISTING_DOCKER_VARIABLE', 'GIT_CONFIG_COUNT'],
      },
    });

    expect(exec).toHaveBeenCalledExactlyOnceWith('command', {
      extraEnv: { EXTRA_VARIABLE: 'extra' },
      env: {
        FORCED_VARIABLE: 'forced',
        GIT_CONFIG_COUNT: '4',
        GIT_CONFIG_KEY_0: 'existing-key',
        GIT_CONFIG_KEY_1: 'url.https://ssh:token123@github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://git:token123@github.com/.insteadOf',
        GIT_CONFIG_KEY_3: 'url.https://token123@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'existing-value',
        GIT_CONFIG_VALUE_1: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_2: 'git@github.com:',
        GIT_CONFIG_VALUE_3: 'https://github.com/',
      },
      docker: {
        envVars: [
          'EXISTING_DOCKER_VARIABLE',
          'GIT_CONFIG_COUNT',
          'GIT_CONFIG_KEY_0',
          'GIT_CONFIG_VALUE_0',
          'GIT_CONFIG_KEY_1',
          'GIT_CONFIG_VALUE_1',
          'GIT_CONFIG_KEY_2',
          'GIT_CONFIG_VALUE_2',
          'GIT_CONFIG_KEY_3',
          'GIT_CONFIG_VALUE_3',
        ],
      },
    });
  });

  it('does not import unapproved runtime Git configuration', async () => {
    exec.mockResolvedValue({ stdout: '', stderr: '' });
    const gitExec = withGitEnvironment();
    process.env.GIT_CONFIG_COUNT = '1';
    process.env.GIT_CONFIG_KEY_0 = 'process-key';
    process.env.GIT_CONFIG_VALUE_0 = 'process-value';
    add({
      hostType: 'github',
      matchHost: 'api.github.com',
      token: 'token123',
    });

    await gitExec('command');

    expect(exec).toHaveBeenCalledExactlyOnceWith('command', {
      env: {
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0: 'url.https://ssh:token123@github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://git:token123@github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://token123@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'https://github.com/',
      },
    });
  });

  it('forces approved runtime Git configuration without authentication', async () => {
    exec.mockResolvedValue({ stdout: '', stderr: '' });
    const gitExec = withGitEnvironment();
    setCustomEnv({
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'existing-key',
      GIT_CONFIG_VALUE_0: 'existing-value',
    });

    await gitExec('command');

    expect(exec).toHaveBeenCalledExactlyOnceWith('command', {
      env: {
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'existing-key',
        GIT_CONFIG_VALUE_0: 'existing-value',
      },
    });
  });
});
