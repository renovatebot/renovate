import { vi } from 'vitest';

vi.mock('../../../util/fs/index.ts', () => ({
  writeLocalFile: vi.fn(),
}));

import { Fixtures } from '~test/fixtures.ts';
import { updateDependency } from './update.ts';

const kasFileYamlBranch = Fixtures.get('kas-branch-commit.yml');
const kasFileYamlTag = Fixtures.get('kas-tag-commit.yml');
const replaceStringIsarYaml = Fixtures.get('replace-string-isar.yml');
const replaceStringIsarYamlTag = Fixtures.get('replace-string-isar-tag.yml');
const kasFileJsonBranch = Fixtures.get('kas-branch-commit.json');
const kasFileJsonTag = Fixtures.get('kas-tag-commit.json');

describe('modules/manager/kas/update', () => {
  describe('updateDependency()', () => {
    it('replacing yaml file content with new digest', async () => {
      const upgrade = {
        depName: 'isar',
        packageFile: 'kas-branch-commit.yml',
        datasource: 'git-refs',
        currentValue: 'next',
        currentDigest: 'd63a1cbae6f737aa843d00d8812547fe7b87104a',
        newDigest: '9b0816337c71c5e45998619bae351fc67fcadc45',
        replaceString: replaceStringIsarYaml,
      };
      const result = await updateDependency({
        fileContent: kasFileYamlBranch,
        packageFile: 'kas-branch-commit.yml',
        upgrade,
      });
      expect(result).toContain('next');
      expect(result).toContain('9b0816337c71c5e45998619bae351fc67fcadc45');
    });

    it('replacing yaml file content with new digest and new value', async () => {
      const upgrade = {
        depName: 'isar',
        datasource: 'git-refs',
        currentValue: 'v0.0.1',
        newValue: 'v1.0',
        currentDigest: 'd63a1cbae6f737aa843d00d8812547fe7b87104a',
        newDigest: '6504321e85b5fdc3bb5a83f042b77cb39cd11a6f',
        replaceString: replaceStringIsarYamlTag,
      };
      const result = await updateDependency({
        fileContent: kasFileYamlTag,
        packageFile: 'kas-tag-commit.yml',
        upgrade,
      });
      expect(result).toContain('v1.0');
      expect(result).toContain('6504321e85b5fdc3bb5a83f042b77cb39cd11a6f');
    });

    it('returning original content if replace string is not found', async () => {
      const upgrade = {
        depName: 'isar',
        datasource: 'git-refs',
        currentValue: 'next',
        currentDigest: 'd63a1cbae6f737aa843d00d8812547fe7b87104a',
        newDigest: '9b0816337c71c5e45998619bae351fc67fcadc45',
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
        currentDigest: 'd63a1cbae6f737aa843d00d8812547fe7b87104a',
        newDigest: '9b0816337c71c5e45998619bae351fc67fcadc45',
      };
      const result = await updateDependency({
        fileContent: kasFileJsonBranch,
        packageFile: 'kas-branch-commit.json',
        upgrade,
      });
      expect(result).toContain('next');
      expect(result).toContain('9b0816337c71c5e45998619bae351fc67fcadc45');
    });

    it('replacing json file content with new digest and new value', async () => {
      const upgrade = {
        depName: 'isar',
        datasource: 'git-refs',
        currentValue: 'v0.0.1',
        newValue: 'v1.0',
        currentDigest: 'd63a1cbae6f737aa843d00d8812547fe7b87104a',
        newDigest: '6504321e85b5fdc3bb5a83f042b77cb39cd11a6f',
      };
      const result = await updateDependency({
        fileContent: kasFileJsonTag,
        packageFile: 'kas-tag-commit.json',
        upgrade,
      });
      expect(result).toContain('v1.0');
      expect(result).toContain('6504321e85b5fdc3bb5a83f042b77cb39cd11a6f');
    });
  });
});
