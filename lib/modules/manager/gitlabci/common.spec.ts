import { isGitlabIncludeLocal } from './common';

const includeLocal = { local: 'something' };
const includeProject = { project: 'something' };

describe('modules/manager/gitlabci/common', () => {
  describe('isGitlabIncludeLocal()', () => {
    it('returns true if GitlabInclude is GitlabIncludeLocal', () => {
      expect(isGitlabIncludeLocal(includeLocal)).toBe(true);
    });

    it('returns false if GitlabInclude is not GitlabIncludeLocal', () => {
      expect(isGitlabIncludeLocal(includeProject)).toBe(false);
    });
  });
});
