import { GlobalConfig } from '../../config/global';
import { gitTimeoutConfig, simpleGitConfig } from './config';
describe('util/git/config', () => {
  it('uses "close" events, ignores "exit" events from child processes', () => {
    expect(simpleGitConfig()).toEqual({
      completion: { onClose: true, onExit: false },
    });
  });
  it('uses git timeout', () => {
    const mockStaticF = jest.fn().mockReturnValue(10000);
    GlobalConfig.get = mockStaticF;
    expect(gitTimeoutConfig()).toEqual({
      timeout: {
        block: 10000,
      },
    });
  });
});
