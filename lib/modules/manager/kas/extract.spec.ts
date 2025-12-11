import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import {
  extractRepoStrings,
  getLockFilePath,
  getLockParser,
  getProjectParser,
  isLockFilePath,
  isYamlFilePath,
} from './extract.ts';
import {
  KasLockFileJson,
  KasLockFileYaml,
  KasProjectJson,
  KasProjectYaml,
} from './schema.ts';

describe('modules/manager/kas/extract', () => {
  describe('isLockFilePath()', () => {
    it.each`
      filePath                       | expected
      ${'project.lock.yml'}          | ${true}
      ${'project.lock.yaml'}         | ${true}
      ${'project.override.lock.yml'} | ${true}
      ${'path/to/project.lock.yml'}  | ${true}
      ${'path/to/project.lock.yaml'} | ${true}
      ${'project.lock.YML'}          | ${true}
      ${'project.lock.YAML'}         | ${true}
      ${'project.lock.Yml'}          | ${true}
      ${'project.lock.json'}         | ${true}
      ${'project.yml'}               | ${false}
      ${'project.yaml'}              | ${false}
      ${'path/to/project.yml'}       | ${false}
      ${'path/to/project.yaml'}      | ${false}
      ${'project.lock'}              | ${false}
      ${''}                          | ${false}
      ${'lock.yml.bak'}              | ${false}
      ${'project.lock.bak'}          | ${false}
      ${'project.lock.yaml.bak'}     | ${false}
    `('returns $expected for "$filePath"', ({ filePath, expected }) => {
      expect(isLockFilePath(filePath)).toBe(expected);
    });
  });

  describe('getLockFilePath()', () => {
    it.each`
      filePath                  | expected
      ${'project.yml'}          | ${'project.lock.yml'}
      ${'project.yaml'}         | ${'project.lock.yaml'}
      ${'project.override.yml'} | ${'project.override.lock.yml'}
      ${'path/to/project.yml'}  | ${'path/to/project.lock.yml'}
      ${'path/to/project.yaml'} | ${'path/to/project.lock.yaml'}
      ${'project.YML'}          | ${'project.lock.YML'}
      ${'project.YAML'}         | ${'project.lock.YAML'}
      ${'project.txt'}          | ${null}
      ${'project'}              | ${null}
    `('converts "$filePath" to "$expected"', ({ filePath, expected }) => {
      expect(getLockFilePath(filePath)).toBe(expected);
    });
  });

  describe('isYamlFilePath()', () => {
    it.each`
      filePath                  | expected
      ${'project.yml'}          | ${true}
      ${'project.yaml'}         | ${true}
      ${'project.override.yml'} | ${true}
      ${'path/to/project.yml'}  | ${true}
      ${'path/to/project.yaml'} | ${true}
      ${'project.YML'}          | ${true}
      ${'project.YAML'}         | ${true}
      ${'project.txt'}          | ${false}
      ${'project'}              | ${false}
    `('returns $expected for "$filePath"', ({ filePath, expected }) => {
      expect(isYamlFilePath(filePath)).toBe(expected);
    });
  });

  describe('getProjectParser()', () => {
    it('returns yaml parser for .yml files', () => {
      const parser = getProjectParser('project.yml');
      expect(parser).toBe(KasProjectYaml);
    });
    it('returns yaml parser for .yaml files', () => {
      const parser = getProjectParser('project.yaml');
      expect(parser).toBe(KasProjectYaml);
    });
    it('returns json parser for .json files', () => {
      const parser = getProjectParser('project.json');
      expect(parser).toBe(KasProjectJson);
    });
  });

  describe('getLockParser()', () => {
    it('returns yaml parser for .yml files', () => {
      const parser = getLockParser('project.lock.yml');
      expect(parser).toBe(KasLockFileYaml);
    });
    it('returns yaml parser for .yaml files', () => {
      const parser = getLockParser('project.lock.yaml');
      expect(parser).toBe(KasLockFileYaml);
    });
    it('returns json parser for .json files', () => {
      const parser = getLockParser('project.lock.json');
      expect(parser).toBe(KasLockFileJson);
    });
  });

  describe('extractRepoStrings()', () => {
    it('extracts repo strings from yaml kas file', () => {
      const kasFile = Fixtures.get('kas-branch-commit.yml');
      const expected = new Map<string, string>([
        ['isar', Fixtures.get('replace-string-isar.yml')],
        ['meta-test', Fixtures.get('replace-string-meta-test.yml')],
      ]);
      expect(extractRepoStrings(kasFile, 'project.yml')).toEqual(expected);
    });

    it('returns empty map if no repos found in yaml file', () => {
      const kasFile = codeBlock`
        header:
          version: 1
        repos: {}
      `;
      expect(extractRepoStrings(kasFile, 'project.yml')).toEqual(new Map());
    });

    it('returns empty map for JSON files', () => {
      const kasFile = Fixtures.get('kas-branch-commit.json');
      expect(extractRepoStrings(kasFile, 'project.json')).toEqual(new Map());
    });
  });
});
