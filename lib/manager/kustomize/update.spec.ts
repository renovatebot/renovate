import { readFileSync } from 'fs';
import {
  DATASOURCE_GIT_TAGS,
  DATASOURCE_DOCKER,
} from '../../constants/data-binary-source';
import { updateDependency } from './update';

const dockerImages = readFileSync(
  'lib/manager/kustomize/__fixtures__/gitImages.yaml',
  'utf8'
);

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

describe('manager/kustomize/update', () => {
  describe('updateDependency', () => {
    it('should return null if no file is passed in', () => {
      const res = updateDependency({
        fileContent: null,
        upgrade: { depType: DATASOURCE_DOCKER },
      });
      expect(res).toBeNull();

      const res2 = updateDependency({
        fileContent: null,
        upgrade: { depType: DATASOURCE_GIT_TAGS },
      });
      expect(res2).toBeNull();
    });
    it('returns the default file if depType is not supported', () => {
      const upgrade = {
        source: 'git@github.com:kubernetes-sigs/kustomize.git',
        lookupName: 'git@github.com:kubernetes-sigs/kustomize.git',
        depName:
          'git@github.com:kubernetes-sigs/kustomize.git//examples/helloWorld',
        currentValue: 'v2.0.0',
        newValue: 'v2.0.1',
        depType: 'invalid-deptype',
      };
      const res = updateDependency({
        fileContent: kustomizeGitSSHSubdir,
        upgrade,
      });
      expect(res).toEqual(kustomizeGitSSHSubdir);
    });
    it('properly replaces a remote base with a subpath', () => {
      const upgrade = {
        source: 'git@github.com:kubernetes-sigs/kustomize.git',
        lookupName: 'git@github.com:kubernetes-sigs/kustomize.git',
        depName:
          'git@github.com:kubernetes-sigs/kustomize.git//examples/helloWorld',
        currentValue: 'v2.0.0',
        newValue: 'v2.0.1',
        depType: DATASOURCE_GIT_TAGS,
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
        depType: DATASOURCE_GIT_TAGS,
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
        depType: DATASOURCE_GIT_TAGS,
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
        depType: DATASOURCE_GIT_TAGS,
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
        depType: DATASOURCE_GIT_TAGS,
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
        depType: DATASOURCE_GIT_TAGS,
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
      const file = 'a\nb';
      const res = updateDependency({ fileContent: file, upgrade: null });
      expect(res).toEqual(file);
    });
  });
});

describe('manager/kustomize/update/image', () => {
  it('should set the image tag correctly when its the second key', () => {
    const upgrade = {
      depName: 'node',
      currentValue: 'v0.1.0',
      newValue: 'v0.1.1',
      depType: DATASOURCE_DOCKER,
    };
    const res = updateDependency({ fileContent: dockerImages, upgrade });
    expect(res.includes(upgrade.newValue)).toBe(true);
  });
  it('should set the image tag correctly when its the first key', () => {
    const upgrade = {
      depName: 'group/instance',
      currentValue: 'v0.0.1',
      newValue: 'v1.1.1',
      depType: DATASOURCE_DOCKER,
    };
    const res = updateDependency({ fileContent: dockerImages, upgrade });
    expect(res.includes(upgrade.newValue)).toBe(true);
  });
  it('should support setting multi-depth images', () => {
    const upgrade = {
      depName: 'gitlab.com/org/suborg/image',
      currentValue: 'v0.0.3',
      newValue: 'v1.1.3',
      depType: DATASOURCE_DOCKER,
    };
    const res = updateDependency({ fileContent: dockerImages, upgrade });
    expect(res.includes(upgrade.newValue)).toBe(true);
  });
});
