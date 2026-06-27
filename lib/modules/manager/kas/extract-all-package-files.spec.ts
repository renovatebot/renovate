import { codeBlock } from 'common-tags';
import { mockExecAll } from '~test/exec-util.ts';
import { fs } from '~test/util.ts';
import { extractAllPackageFiles } from './extract.ts';

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

describe('modules/manager/kas/extract-all-package-files', () => {
  it('extract dependencys for example kas config', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce(kasLockFile)
      .mockResolvedValueOnce(kasFile)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(kasFileInclude);
    mockExecAll({ stdout: dump, stderr: '' });
    const result = await extractAllPackageFiles({}, ['kas.yml']);
    expect(result).toEqual([
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
            versioning: undefined,
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
    ]);
  });

  it('skip when no dump available', async () => {
    mockExecAll(new Error('command not found: kas'));
    const result = await extractAllPackageFiles({}, ['kas.yml']);
    expect(result).toEqual([]);
  });

  it('skip edge cases', async () => {
    fs.readLocalFile.mockResolvedValue(null);
    mockExecAll({
      stdout: JSON.stringify({ header: { version: 22 } }),
      stderr: '',
    });
    const result = await extractAllPackageFiles({}, ['kas.yml', 'kas.yml', '']);
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
});
