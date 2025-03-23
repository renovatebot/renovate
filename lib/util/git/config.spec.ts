import { GlobalConfig } from '../../config/global';
import { setNoVerify, simpleGitConfig } from './config';

describe('util/git/config', () => {
  beforeEach(() => {
    GlobalConfig.reset();
  });

  it('uses "close" events, ignores "exit" events from child processes', () => {
    expect(simpleGitConfig()).toEqual({
      completion: { onClose: true, onExit: false },
      config: ['core.quotePath=false'],
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
    });
  });

  it('throws', () => {
    // @ts-expect-error -- testing invalid input
    expect(() => setNoVerify(1)).toThrowError(
      'config error: gitNoVerify should be an array of strings',
    );
  });
});
