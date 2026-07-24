import { codeBlock } from 'common-tags';
import { mockExecAll } from '~test/exec-util.ts';
import { fs } from '~test/util.ts';
import {
  extractAllPackageFiles,
  isLockFilePath,
  isYamlFilePath,
} from './extract.ts';

vi.mock('../../../util/fs/index.ts');

const kasFile = codeBlock`
  header:
    version: 22
    includes:
      - kasInclude.yml

  build_system: isar

  repos:
    isar:
      url: https://github.com/ilbers/isar.git
      branch: next
    isar2:
      url: https://github.com/ilbers/isar.git
      tag: v1.1
`;

const kasFileInclude = codeBlock`
  header:
    version: 22

  repos:
    isar2:
      tag: v1.0
`;

const kasLockFile = codeBlock`
  header:
    version: 22
  overrides:
    repos:
      isar:
        commit: fe4f6297ea80b2d79fad423f5652a2ec12c541a7
      isar2:
        commit: c0bacbd54d682c6c2d71cdadcc2050a0173ada0a
`;

const kasFileJson = JSON.stringify(
  {
    header: {
      version: 22,
      includes: ['kasInclude.json'],
    },
    build_system: 'isar',
    repos: {
      isar: {
        url: 'https://github.com/ilbers/isar.git',
        branch: 'next',
      },
      isar2: {
        url: 'https://github.com/ilbers/isar.git',
        tag: 'v1.1',
      },
    },
  },
  null,
  4,
);

const kasFileIncludeJson = JSON.stringify(
  {
    header: {
      version: 22,
    },
    repos: {
      isar2: {
        tag: 'v1.0',
      },
    },
  },
  null,
  4,
);

const kasLockFileJson = JSON.stringify(
  {
    header: {
      version: 22,
    },
    overrides: {
      repos: {
        isar: {
          commit: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        },
        isar2: {
          commit: 'c0bacbd54d682c6c2d71cdadcc2050a0173ada0a',
        },
      },
    },
  },
  null,
  4,
);

const dump = JSON.stringify({
  header: {
    version: 22,
  },
  overrides: {
    repos: {
      isar: {
        commit: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
      },
      isar2: {
        commit: 'c0bacbd54d682c6c2d71cdadcc2050a0173ada0a',
      },
    },
  },
  repos: {
    isar2: {
      tag: 'v1.1',
      url: 'https://github.com/ilbers/isar.git',
    },
    isar: {
      url: 'https://github.com/ilbers/isar.git',
      branch: 'next',
    },
  },
  build_system: 'isar',
});

const expectedDependencies = [
  {
    packageFile: 'kas.lock.yml',
    deps: [
      {
        currentDigest: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
        currentValue: 'next',
        datasource: 'git-refs',
        depName: 'isar',
        packageName: 'https://github.com/ilbers/isar.git',
        replaceString:
          'isar:\n      commit: fe4f6297ea80b2d79fad423f5652a2ec12c541a7\n',
        versioning: 'loose',
      },
      {
        currentDigest: 'c0bacbd54d682c6c2d71cdadcc2050a0173ada0a',
        currentValue: 'v1.1',
        datasource: 'git-tags',
        depName: 'isar2',
        packageName: 'https://github.com/ilbers/isar.git',
        replaceString:
          'isar2:\n      commit: c0bacbd54d682c6c2d71cdadcc2050a0173ada0a',
        versioning: undefined,
      },
    ],
  },
  {
    packageFile: 'kas.yml',
    deps: [
      {
        currentDigest: undefined,
        currentValue: 'v1.1',
        datasource: 'git-tags',
        depName: 'isar2',
        packageName: 'https://github.com/ilbers/isar.git',
        replaceString:
          'isar2:\n    url: https://github.com/ilbers/isar.git\n    tag: v1.1',
        versioning: undefined,
      },
    ],
  },
];

const exptectedDependenciesJson = expectedDependencies.map((depGroup) => ({
  ...depGroup,
  packageFile: depGroup.packageFile.replace('yml', 'json'),
  deps: depGroup.deps.map((dep) => ({
    ...dep,
    replaceString: undefined,
  })),
}));

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

  describe('modules/manager/kas/extract-all-package-files', () => {
    it('extract dependencies for example kas config', async () => {
      fs.readLocalFile
        .mockResolvedValueOnce(kasLockFile)
        .mockResolvedValueOnce(kasFile)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(kasFileInclude);
      mockExecAll({ stdout: dump, stderr: '' });
      const result = await extractAllPackageFiles({}, ['kas.yml']);
      expect(result).toEqual(expectedDependencies);
    });

    it('extract dependencies for example kas json config', async () => {
      fs.readLocalFile
        .mockResolvedValueOnce(kasLockFileJson)
        .mockResolvedValueOnce(kasFileJson)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(kasFileIncludeJson);
      mockExecAll({ stdout: dump, stderr: '' });
      const result = await extractAllPackageFiles({}, ['kas.json']);
      expect(result).toEqual(exptectedDependenciesJson);
    });

    it('skip when no dump available', async () => {
      mockExecAll(new Error('command not found: kas'));
      const result = await extractAllPackageFiles({}, ['kas.yml']);
      expect(result).toEqual([]);
    });

    it('skip no repos in dump', async () => {
      fs.readLocalFile.mockResolvedValue(null);
      mockExecAll({
        stdout: JSON.stringify({ header: { version: 22 } }),
        stderr: '',
      });
      const result = await extractAllPackageFiles({}, [
        'kas.yml',
        'kas.yml',
        '',
      ]);
      expect(result).toEqual([]);
    });

    it('skip special include', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null)
        .mockResolvedValueOnce(codeBlock`
          header:
            version: 22
            includes:
              - repo: isar
                file: kas.yml
              - kas.yml
        `);
      mockExecAll({
        stdout: JSON.stringify({ header: { version: 22 } }),
        stderr: '',
      });
      const result = await extractAllPackageFiles({}, ['kas.yml']);
      expect(result).toEqual([]);
    });

    it('skip including file twice', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null).mockResolvedValueOnce(
        JSON.stringify({
          header: { version: 22, includes: ['kas2.yml', 'kas2.yml'] },
        }),
      );
      mockExecAll({
        stdout: JSON.stringify({ header: { version: 22 } }),
        stderr: '',
      });
      const result = await extractAllPackageFiles({}, ['kas.yml']);
      expect(result).toEqual([]);
    });

    it('skip invalid kas files', async () => {
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
          overrides: "no-repos"
        `).mockResolvedValueOnce(codeBlock`
          header:
            version: "twenty-two"
        `);
      mockExecAll({ stdout: dump, stderr: '' });
      const result = await extractAllPackageFiles({}, ['kas.yml']);
      expect(result).toEqual([]);
    });

    it('skip empty kas repo', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null)
        .mockResolvedValueOnce(codeBlock`
          header:
            version: 22
          repos:
            isar:
        `);
      mockExecAll({ stdout: dump, stderr: '' });
      const result = await extractAllPackageFiles({}, ['kas.yml']);
      expect(result).toEqual([]);
    });

    it('skip repo with no dump', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null)
        .mockResolvedValueOnce(codeBlock`
          header:
            version: 22
          repos:
            isarNotInDump:
              url: https://github.com/ilbers/isar.git
              branch: next
        `);
      mockExecAll({ stdout: dump, stderr: '' });
      const result = await extractAllPackageFiles({}, ['kas.yml']);
      expect(result).toEqual([]);
    });

    it('skip hg repo with no dump', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null)
        .mockResolvedValueOnce(codeBlock`
          header:
            version: 22
          repos:
            isar:
              type: hg
              url: https://github.com/ilbers/isar.git
              branch: next
        `);
      mockExecAll({ stdout: dump, stderr: '' });
      const result = await extractAllPackageFiles({}, ['kas.yml']);
      expect(result).toEqual([]);
    });

    it('skip repo with non matching url', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null)
        .mockResolvedValueOnce(codeBlock`
          header:
            version: 22
          repos:
            isar:
              url: not-the-same-url
              branch: next
        `);
      mockExecAll({ stdout: dump, stderr: '' });
      const result = await extractAllPackageFiles({}, ['kas.yml']);
      expect(result).toEqual([]);
    });

    it('skip repo without an url', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null)
        .mockResolvedValueOnce(codeBlock`
          header:
            version: 22
          repos:
            isar:
              branch: next
        `);
      mockExecAll({
        stdout: JSON.stringify({
          header: { version: 22 },
          repos: {
            isar: {
              branch: 'next',
            },
          },
        }),
        stderr: '',
      });
      const result = await extractAllPackageFiles({}, ['kas.yml']);
      expect(result).toEqual([]);
    });

    it('skip repo with branch and tag', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null)
        .mockResolvedValueOnce(codeBlock`
          header:
            version: 22
          repos:
            isar:
              url: https://github.com/ilbers/isar.git
              branch: next
              tag: v1.1
        `);
      mockExecAll({
        stdout: JSON.stringify({
          header: { version: 22 },
          repos: {
            isar: {
              url: 'https://github.com/ilbers/isar.git',
              branch: 'next',
              tag: 'v1.1',
            },
          },
        }),
        stderr: '',
      });
      const result = await extractAllPackageFiles({}, ['kas.yml']);
      expect(result).toEqual([]);
    });

    it('getLockFilePath: return null for lock files', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      mockExecAll({ stdout: dump, stderr: '' });
      const result = await extractAllPackageFiles({}, ['kas.lock.yml']);
      expect(result).toEqual([]);
    });
  });
});
