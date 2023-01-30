import githubScm from './scm';
import { commitFiles } from './index';

describe('modules/platform/github/scm', () => {
  it('available functions check', () => {
    expect(githubScm.commitAndPush).toBe(commitFiles);
  });
});
