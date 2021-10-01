import { simpleGitConfig } from './simple-git';

describe('config/simple-git', () => {
  it('uses "close" events, ignores "exit" events from child processes', () => {
    expect(simpleGitConfig()).toEqual({
      completion: { onClose: true, onExit: false },
    });
  });
});
