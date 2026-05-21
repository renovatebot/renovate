import { codeBlock } from 'common-tags';
import { vi } from 'vitest';
import { updateDependency } from './update.ts';

vi.mock('../../../util/fs/index.ts');

const kasFileYamlBranch = codeBlock`
  header:
    version: 22

  build_system: isar

  repos:
    meta-test:
      path: meta-test/
      layers:
        .:
    isar:
      url: https://github.com/ilbers/isar.git
      branch: next
      commit: fe4f6297ea80b2d79fad423f5652a2ec12c541a7
      layers:
        meta:
        meta-isar:
`;

const kasFileYamlTag = codeBlock`
  header:
    version: 22

  build_system: isar

  repos:
    meta-test:
      path: meta-test/
      layers:
        .:
    isar:
      url: https://github.com/ilbers/isar.git
      tag: v1.0
      commit: fe4f6297ea80b2d79fad423f5652a2ec12c541a7
      layers:
        meta:
        meta-isar:
`;

const replaceStringIsarYaml = codeBlock`
  isar:
      url: https://github.com/ilbers/isar.git
      branch: next
      commit: fe4f6297ea80b2d79fad423f5652a2ec12c541a7
      layers:
        meta:
        meta-isar:
`;

const replaceStringIsarYamlTag = codeBlock`
  isar:
      url: https://github.com/ilbers/isar.git
      tag: v1.0
      commit: fe4f6297ea80b2d79fad423f5652a2ec12c541a7
      layers:
        meta:
        meta-isar:
`;

const kasFileJsonBranch = JSON.stringify(
  {
    header: { version: 22 },
    build_system: 'isar',
    repos: {
      'meta-test': { path: 'meta-test/', layers: { '.': {} } },
      isar: {
        name: 'isar',
        url: 'https://github.com/ilbers/isar.git',
        branch: 'next',
        commit: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        layers: { meta: {}, 'meta-isar': {} },
      },
    },
  },
  null,
  4,
);

const kasFileJsonTag = JSON.stringify(
  {
    header: { version: 22 },
    build_system: 'isar',
    repos: {
      'meta-test': { path: 'meta-test/', layers: { '.': {} } },
      isar: {
        url: 'https://github.com/ilbers/isar.git',
        tag: 'v1.0',
        commit: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        layers: { meta: {}, 'meta-isar': {} },
      },
    },
  },
  null,
  4,
);

const kasLockFileJson = JSON.stringify(
  {
    header: { version: 22 },
    overrides: {
      repos: {
        isar: {
          commit: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        },
      },
    },
  },
  null,
  4,
);

describe('modules/manager/kas/update', () => {
  describe('updateDependency()', () => {
    it('replacing yaml file content with new digest', async () => {
      const upgrade = {
        depName: 'isar',
        packageFile: 'kas-branch-commit.yml',
        datasource: 'git-refs',
        currentValue: 'next',
        currentDigest: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        newDigest: 'c0bacbd54d682c6c2d71cdadcc2050a0173ada0a',
        replaceString: replaceStringIsarYaml,
      };
      const result = await updateDependency({
        fileContent: kasFileYamlBranch,
        packageFile: 'kas-branch-commit.yml',
        upgrade,
      });
      expect(result).toContain('next');
      expect(result).toContain('c0bacbd54d682c6c2d71cdadcc2050a0173ada0a');
    });

    it('replacing yaml file content with new digest and new value', async () => {
      const upgrade = {
        depName: 'isar',
        datasource: 'git-tags',
        currentValue: 'v1.0',
        newValue: 'v1.1',
        currentDigest: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        newDigest: 'c0bacbd54d682c6c2d71cdadcc2050a0173ada0a',
        replaceString: replaceStringIsarYamlTag,
      };
      const result = await updateDependency({
        fileContent: kasFileYamlTag,
        packageFile: 'kas-tag-commit.yml',
        upgrade,
      });
      expect(result).toContain('v1.1');
      expect(result).toContain('c0bacbd54d682c6c2d71cdadcc2050a0173ada0a');
    });

    it('returning original content if replace string is not found', async () => {
      const upgrade = {
        depName: 'isar',
        datasource: 'git-refs',
        currentValue: 'next',
        currentDigest: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        newDigest: 'c0bacbd54d682c6c2d71cdadcc2050a0173ada0a',
        replaceString: 'string-not-in-file',
      };
      const result = await updateDependency({
        fileContent: kasFileYamlBranch,
        packageFile: 'kas-branch-commit.yml',
        upgrade,
      });
      expect(result).toBe(kasFileYamlBranch);
    });

    it('replacing json file content with new digest', async () => {
      const upgrade = {
        depName: 'isar',
        datasource: 'git-refs',
        currentValue: 'next',
        currentDigest: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        newDigest: 'c0bacbd54d682c6c2d71cdadcc2050a0173ada0a',
      };
      const result = await updateDependency({
        fileContent: kasFileJsonBranch,
        packageFile: 'kas-branch-commit.json',
        upgrade,
      });
      expect(result).toContain('next');
      expect(result).toContain('c0bacbd54d682c6c2d71cdadcc2050a0173ada0a');
    });

    it('replacing json file content with new digest and new value', async () => {
      const upgrade = {
        depName: 'isar',
        datasource: 'git-tags',
        currentValue: 'v1.0',
        newValue: 'v1.1',
        currentDigest: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        newDigest: 'c0bacbd54d682c6c2d71cdadcc2050a0173ada0a',
      };
      const result = await updateDependency({
        fileContent: kasFileJsonTag,
        packageFile: 'kas-tag-commit.json',
        upgrade,
      });
      expect(result).toContain('v1.1');
      expect(result).toContain('c0bacbd54d682c6c2d71cdadcc2050a0173ada0a');
    });

    it('skip updating digest if datasource is git-tags and version did not change', async () => {
      const upgrade = {
        depName: 'isar',
        datasource: 'git-tags',
        currentValue: 'v1.1',
        newValue: 'v1.1',
        currentDigest: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        newDigest: '6504321e85b5fdc3bb5a83f042b77cb39cd11a6f',
        replaceString: replaceStringIsarYamlTag,
      };
      const result = await updateDependency({
        fileContent: kasFileYamlTag,
        packageFile: 'kas-tag-commit.yml',
        upgrade,
      });
      expect(result).toBe(kasFileYamlTag);
    });

    it('skip updates when currentValue and currentDigest is not included in the file', async () => {
      const upgrade = {
        depName: 'isar',
        datasource: 'git-refs',
        currentValue: 'v.not.in.file',
        newValue: 'v1.1',
        currentDigest: '6504321e85b5fdc3bb5a83f042b77cb39cd11a6f',
        newDigest: 'c0bacbd54d682c6c2d71cdadcc2050a0173ada0a',
        replaceString: replaceStringIsarYamlTag,
      };
      const result = await updateDependency({
        fileContent: kasFileYamlTag,
        packageFile: 'kas-tag-commit.yml',
        upgrade,
      });
      expect(result).toBe(kasFileYamlTag);
    });

    it('skip updates when depName is not provided', async () => {
      const upgrade = {
        depName: '',
        datasource: 'git-refs',
        currentValue: 'next',
        currentDigest: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        newDigest: 'c0bacbd54d682c6c2d71cdadcc2050a0173ada0a',
      };
      const result = await updateDependency({
        fileContent: kasFileJsonBranch,
        packageFile: 'kas-branch-commit.json',
        upgrade,
      });
      expect(result).toBe(kasFileJsonBranch);
    });

    it('skip updates when currentDigest equals newDigest', async () => {
      const upgrade = {
        depName: 'isar',
        datasource: 'git-refs',
        currentValue: 'next',
        currentDigest: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        newDigest: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        replaceString: replaceStringIsarYaml,
      };
      const result = await updateDependency({
        fileContent: kasFileYamlBranch,
        packageFile: 'kas-branch-commit.yml',
        upgrade,
      });
      expect(result).toBe(kasFileYamlBranch);
    });

    it('update json lock file content with new digest', async () => {
      const upgrade = {
        depName: 'isar',
        datasource: 'git-refs',
        currentDigest: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        newDigest: 'c0bacbd54d682c6c2d71cdadcc2050a0173ada0a',
      };
      const result = await updateDependency({
        fileContent: kasLockFileJson,
        packageFile: 'kas-branch-commit.lock.json',
        upgrade,
      });
      expect(result).toContain('c0bacbd54d682c6c2d71cdadcc2050a0173ada0a');
    });

    it('skip updating json lock file content when no repos are found', async () => {
      const upgrade = {
        depName: 'isar',
        datasource: 'git-refs',
        currentDigest: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        newDigest: 'c0bacbd54d682c6c2d71cdadcc2050a0173ada0a',
      };
      const lockFileWithoutRepos = kasLockFileJson.replace('repos', 'noRepos');
      const result = await updateDependency({
        fileContent: lockFileWithoutRepos,
        packageFile: 'kas-branch-commit.lock.json',
        upgrade,
      });
      expect(result).toBe(lockFileWithoutRepos);
    });

    it('skip updating json lock file content when repo is not found', async () => {
      const upgrade = {
        depName: 'noIsar',
        datasource: 'git-refs',
        currentDigest: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        newDigest: 'c0bacbd54d682c6c2d71cdadcc2050a0173ada0a',
      };
      const result = await updateDependency({
        fileContent: kasLockFileJson,
        packageFile: 'kas-branch-commit.lock.json',
        upgrade,
      });
      expect(result).toBe(kasLockFileJson);
    });

    it('skip updating json file content when no repos are found', async () => {
      const upgrade = {
        depName: 'isar',
        datasource: 'git-refs',
        currentValue: 'next',
        currentDigest: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        newDigest: 'c0bacbd54d682c6c2d71cdadcc2050a0173ada0a',
      };
      const kasFileWithoutRepos = kasFileJsonBranch.replace('repos', 'noRepos');
      const result = await updateDependency({
        fileContent: kasFileWithoutRepos,
        packageFile: 'kas-branch-commit.json',
        upgrade,
      });
      expect(result).toBe(kasFileWithoutRepos);
    });

    it('skip updating json file content repo is not found', async () => {
      const upgrade = {
        depName: 'noIsar',
        datasource: 'git-refs',
        currentValue: 'next',
        currentDigest: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        newDigest: 'c0bacbd54d682c6c2d71cdadcc2050a0173ada0a',
      };
      const result = await updateDependency({
        fileContent: kasFileJsonBranch,
        packageFile: 'kas-branch-commit.json',
        upgrade,
      });
      expect(result).toBe(kasFileJsonBranch);
    });

    it('skip updating json lock file when commit did not change', async () => {
      const upgrade = {
        depName: 'isar',
        datasource: 'git-refs',
        currentDigest: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        newDigest: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
      };
      const result = await updateDependency({
        fileContent: kasLockFileJson,
        packageFile: 'kas-branch-commit.lock.json',
        upgrade,
      });
      expect(result).toBe(kasLockFileJson);
    });

    it('skip updating json file when commit did not change', async () => {
      const upgrade = {
        depName: 'isar',
        datasource: 'git-refs',
        currentDigest: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        newDigest: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
      };
      const result = await updateDependency({
        fileContent: kasFileJsonBranch,
        packageFile: 'kas-branch-commit.json',
        upgrade,
      });
      expect(result).toBe(kasFileJsonBranch);
    });

    it('update json file when repo.name is different than repo key', async () => {
      const upgrade = {
        depName: 'isar',
        datasource: 'git-refs',
        currentValue: 'next',
        currentDigest: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        newDigest: 'c0bacbd54d682c6c2d71cdadcc2050a0173ada0a',
      };
      const kasFileWithDifferentRepoName = JSON.stringify(
        {
          header: { version: 22 },
          build_system: 'isar',
          repos: {
            'meta-test': { path: 'meta-test/', layers: { '.': {} } },
            1: {
              name: 'isar',
              url: 'https://github.com/ilbers/isar.git',
              branch: 'next',
              commit: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
              layers: { meta: {}, 'meta-isar': {} },
            },
          },
        },
        null,
        4,
      );
      const result = await updateDependency({
        fileContent: kasFileWithDifferentRepoName,
        packageFile: 'kas-branch-commit.json',
        upgrade,
      });
      expect(result).toContain('next');
      expect(result).toContain('c0bacbd54d682c6c2d71cdadcc2050a0173ada0a');
    });
  });
});
