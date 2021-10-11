import { simpleGitConfig } from './config';

describe('util/git/config', () => {
  it('uses "close" events, ignores "exit" events from child processes', () => {
    expect(simpleGitConfig()).toEqual({
      completion: { onClose: true, onExit: false },
    });
  });
});
