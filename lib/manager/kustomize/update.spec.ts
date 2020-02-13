import { readFileSync } from 'fs';
import { updateDependency } from './update';

const kustomizeGitSSHBase = readFileSync(
  'lib/manager/kustomize/__fixtures__/gitSshBase.yaml',
  'utf8'
);

const kustomizeGitSSHSubdir = readFileSync(
  'lib/manager/kustomize/__fixtures__/gitSubdir.yaml',
  'utf8'
);

const kustomizeHTTP = readFileSync(
  'lib/manager/kustomize/__fixtures__/kustomizeHttp.yaml',
  'utf8'
);

const kustomizeWithLocal = readFileSync(
  'lib/manager/kustomize/__fixtures__/kustomizeWithLocal.yaml',
  'utf8'
);

const nonKustomize = readFileSync(
  'lib/manager/kustomize/__fixtures__/service.yaml',
  'utf8'
);

describe('manager/kustomize/update', () => {
  describe('updateDependency', () => {
    it('properly replaces a remote base with a subpath', () => {
      const upgrade = {
        source: 'git@github.com:kubernetes-sigs/kustomize.git',
        depName:
          'git@github.com:kubernetes-sigs/kustomize.git//examples/helloWorld',
        currentValue: 'v2.0.0',
        newValue: 'v2.0.1',
      };
      const res = updateDependency({
        fileContent: kustomizeGitSSHSubdir,
        upgrade,
      });
      expect(res).not.toEqual(kustomizeGitSSHSubdir);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('replaces existing value', () => {
      const upgrade = {
        source: 'git@github.com:moredhel/remote-kustomize.git',
        depName: 'git@github.com:moredhel/remote-kustomize.git',
        currentValue: 'v0.0.1',
        newValue: 'v0.0.2',
      };
      const res = updateDependency({
        fileContent: kustomizeGitSSHBase,
        upgrade,
      });
      expect(res).not.toEqual(kustomizeGitSSHBase);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('updating twice should be a noop', () => {
      const upgrade = {
        source: 'git@github.com:moredhel/remote-kustomize.git',
        depName: 'git@github.com:moredhel/remote-kustomize.git',
        currentValue: 'v0.0.1',
        newValue: 'v0.0.2',
      };
      const res = updateDependency({
        fileContent: kustomizeGitSSHBase,
        upgrade,
      });
      const res2 = updateDependency({ fileContent: res, upgrade });
      expect(res2).toEqual(res);
    });
    it('replaces existing value if quoted', () => {
      const upgrade = {
        source: 'github.com/user/repo//deploy',
        depName: 'github.com/user/repo',
        currentValue: 'v0.0.1',
        newValue: 'v0.0.2',
      };
      const res = updateDependency({ fileContent: kustomizeHTTP, upgrade });
      expect(res).not.toEqual(kustomizeGitSSHBase);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('returns same file if no version bump', () => {
      const upgrade = {
        depName: 'git@github.com:moredhel/remote-kustomize.git',
        currentValue: 'v0.0.1',
        newValue: 'v0.0.1',
      };
      const res = updateDependency({
        fileContent: kustomizeGitSSHBase,
        upgrade,
      });
      expect(res).toEqual(kustomizeGitSSHBase);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('returns same file if mismatch', () => {
      const upgrade = {
        depName: 'git@github.com:moredhel/invalid-repo.git',
        currentValue: 'v0.0.1',
        newValue: 'v0.0.1',
      };
      const res = updateDependency({
        fileContent: kustomizeGitSSHSubdir,
        upgrade,
      });
      expect(res).toEqual(kustomizeGitSSHSubdir);
    });
    it('returns null if error', () => {
      const res = updateDependency({ fileContent: null, upgrade: null });
      expect(res).toBeNull();
    });
    it('returns null if upgrade is not defined', () => {
      const res = updateDependency({ fileContent: 'a\nb', upgrade: null });
      expect(res).toBeNull();
    });
  });
});
