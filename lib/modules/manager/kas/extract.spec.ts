import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import { extractAllPackageFiles } from './extract.ts';

vi.mock('../../../util/fs/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../util/fs/index.ts')>()),
  readLocalFile: vi.fn(),
  localPathExists: vi.fn(),
}));

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
    lockFiles: ['kas.lock.yml'],
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
  ...(depGroup.lockFiles && { lockFiles: ['kas.lock.json'] }),
  deps: depGroup.deps.map((dep) => ({
    ...dep,
    replaceString: undefined,
  })),
}));

let files: Record<string, string>;

/** kas file with `repos` block (2-space indented body) and optional string includes */
function kasRoot(repos: string, includes: string[] = []): string {
  return [
    'header:',
    '  version: 22',
    ...(includes.length
      ? ['  includes:', ...includes.map((i) => `    - ${i}`)]
      : []),
    'repos:',
    ...repos.split('\n').map((l) => (l ? `  ${l}` : l)),
  ].join('\n');
}

/** entry file is always reported (lockFileMaintenance hook), deps may be empty */
const emptyRoot = {
  packageFile: 'kas.yml',
  deps: [],
  lockFiles: ['kas.lock.yml'],
};

describe('modules/manager/kas/extract', () => {
  beforeEach(() => {
    files = {};
    fs.readLocalFile.mockImplementation((p) =>
      Promise.resolve(files[p] ?? null),
    );
    fs.localPathExists.mockImplementation((p) => Promise.resolve(p in files));
  });

  describe('extractAllPackageFiles()', () => {
    it('extracts dependencies for example kas config', async () => {
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
      files = {
        'kas.yml': kasFile,
        'kas.lock.yml': kasLockFile,
        'kasInclude.yml': kasFileInclude,
      };
      const result = await extractAllPackageFiles({}, ['kas.yml']);
      expect(result).toEqual(expectedDependencies);
    });

    it('extracts dependencies for example kas json config', async () => {
      files = {
        'kas.json': kasFileJson,
        'kas.lock.json': kasLockFileJson,
        'kasInclude.json': kasFileIncludeJson,
      };
      const result = await extractAllPackageFiles({}, ['kas.json']);
      expect(result).toEqual(exptectedDependenciesJson);
    });

    it('extracts pinned commit from project file without lockfile', async () => {
      files['kas.yml'] = kasRoot(codeBlock`
        isar:
          url: https://github.com/ilbers/isar.git
          branch: next
          commit: fe4f6297ea80b2d79fad423f5652a2ec12c541a7
      `);
      const result = await extractAllPackageFiles({}, ['kas.yml']);
      expect(result).toEqual([
        {
          packageFile: 'kas.yml',
          lockFiles: ['kas.lock.yml'],
          deps: [
            {
              currentDigest: 'fe4f6297ea80b2d79fad423f5652a2ec12c541a7',
              currentValue: 'next',
              datasource: 'git-refs',
              depName: 'isar',
              packageName: 'https://github.com/ilbers/isar.git',
              replaceString: expect.stringContaining('commit: fe4f'),
              versioning: 'loose',
            },
          ],
        },
      ]);
    });

    it('lockfile commit wins over project file commit', async () => {
      files['kas.yml'] = kasRoot(codeBlock`
        isar:
          url: https://github.com/ilbers/isar.git
          branch: next
          commit: aaaa
      `);
      files['kas.lock.yml'] = codeBlock`
        header:
          version: 14
        overrides:
          repos:
            isar:
              commit: bbbb
      `;
      const result = await extractAllPackageFiles({}, ['kas.yml']);
      expect(result).toMatchObject([
        {
          packageFile: 'kas.lock.yml',
          deps: [{ depName: 'isar', currentDigest: 'bbbb' }],
        },
        emptyRoot,
      ]);
    });

    it('extracts from include files with their own lockfiles', async () => {
      files['kas.yml'] = kasRoot('{}', ['inc/layer.yml']);
      files['inc/layer.yml'] = kasRoot(codeBlock`
        layer:
          url: https://example.com/layer.git
          branch: main
      `);
      files['inc/layer.lock.yml'] = codeBlock`
        header:
          version: 14
        overrides:
          repos:
            layer:
              commit: abcd
      `;
      const result = await extractAllPackageFiles({}, ['kas.yml']);
      expect(result).toMatchObject([
        {
          packageFile: 'inc/layer.lock.yml',
          deps: [
            {
              depName: 'layer',
              packageName: 'https://example.com/layer.git',
              currentValue: 'main',
              currentDigest: 'abcd',
              datasource: 'git-refs',
            },
          ],
        },
        emptyRoot,
      ]);
    });

    it('skips when root file is missing or invalid', async () => {
      files['bad.yml'] = 'header: [';
      await expect(
        extractAllPackageFiles({}, ['kas.yml', 'bad.yml']),
      ).resolves.toEqual([]);
    });

    it('skips duplicate root files and files already visited as include', async () => {
      files['kas.yml'] = kasRoot('{}', ['kas2.yml']);
      files['kas2.yml'] = kasRoot(codeBlock`
        isar:
          url: https://github.com/ilbers/isar.git
          tag: v1
      `);
      const result = await extractAllPackageFiles({}, [
        'kas.yml',
        'kas.yml',
        'kas2.yml',
      ]);
      expect(result.map((r) => r.packageFile)).toEqual(['kas2.yml', 'kas.yml']);
    });

    it('reports a shared include only once', async () => {
      files['a.yml'] = kasRoot('{}', ['common.yml']);
      files['b.yml'] = kasRoot('{}', ['common.yml']);
      files['common.yml'] = kasRoot(codeBlock`
        isar:
          url: https://github.com/ilbers/isar.git
          tag: v1
      `);
      const result = await extractAllPackageFiles({}, ['a.yml', 'b.yml']);
      expect(result.map((r) => r.packageFile)).toEqual([
        'common.yml',
        'a.yml',
        'b.yml',
      ]);
    });

    it('skips root with missing include', async () => {
      files['kas.yml'] = kasRoot('{}', ['nope.yml']);
      await expect(extractAllPackageFiles({}, ['kas.yml'])).resolves.toEqual(
        [],
      );
    });

    it('skips root with unsupported extension', async () => {
      files['kas.conf'] = kasRoot('{}');
      await expect(extractAllPackageFiles({}, ['kas.conf'])).resolves.toEqual(
        [],
      );
    });

    it('skips cross-repo includes', async () => {
      files['kas.yml'] = kasRoot('{}', ['{ repo: isar, file: kas.yml }']);
      await expect(extractAllPackageFiles({}, ['kas.yml'])).resolves.toEqual([
        emptyRoot,
      ]);
    });

    it('skips invalid schema', async () => {
      files['kas.yml'] = codeBlock`
        header:
          version: "twenty-two"
      `;
      await expect(extractAllPackageFiles({}, ['kas.yml'])).resolves.toEqual(
        [],
      );
    });

    it('skips files without repos', async () => {
      files['kas.yml'] = codeBlock`
        header:
          version: 22
        build_system: isar
      `;
      await expect(extractAllPackageFiles({}, ['kas.yml'])).resolves.toEqual([
        emptyRoot,
      ]);
    });

    it('skips empty repo entries', async () => {
      files['kas.yml'] = kasRoot('isar:');
      await expect(extractAllPackageFiles({}, ['kas.yml'])).resolves.toEqual([
        emptyRoot,
      ]);
    });

    it('skips repo nulled by later file', async () => {
      files['kas.yml'] = kasRoot('isar:', ['inc.yml']);
      files['inc.yml'] = kasRoot(codeBlock`
        isar:
          url: https://github.com/ilbers/isar.git
          tag: v1
      `);
      await expect(extractAllPackageFiles({}, ['kas.yml'])).resolves.toEqual([
        emptyRoot,
      ]);
    });

    it('skips hg repo', async () => {
      files['kas.yml'] = kasRoot(codeBlock`
        isar:
          type: hg
          url: https://github.com/ilbers/isar.git
          tag: v1
      `);
      await expect(extractAllPackageFiles({}, ['kas.yml'])).resolves.toEqual([
        emptyRoot,
      ]);
    });

    it('skips include repo whose url differs from merged url', async () => {
      files['kas.yml'] = kasRoot(
        codeBlock`
          isar:
            url: https://github.com/ilbers/isar.git
            tag: v1
        `,
        ['inc.yml'],
      );
      files['inc.yml'] = kasRoot(codeBlock`
        isar:
          url: https://example.com/other.git
          tag: v1
      `);
      const result = await extractAllPackageFiles({}, ['kas.yml']);
      expect(result).toMatchObject([
        {
          packageFile: 'kas.yml',
          deps: [{ packageName: 'https://github.com/ilbers/isar.git' }],
        },
      ]);
      expect(result).toHaveLength(1);
    });

    it('skips repo without url', async () => {
      files['kas.yml'] = kasRoot(codeBlock`
        isar:
          branch: next
      `);
      await expect(extractAllPackageFiles({}, ['kas.yml'])).resolves.toEqual([
        emptyRoot,
      ]);
    });

    it('skips repo with floating branch only', async () => {
      files['kas.yml'] = kasRoot(codeBlock`
        isar:
          url: https://github.com/ilbers/isar.git
          branch: next
      `);
      await expect(extractAllPackageFiles({}, ['kas.yml'])).resolves.toEqual([
        emptyRoot,
      ]);
    });

    it('skips repo with branch and tag', async () => {
      files['kas.yml'] = kasRoot(codeBlock`
        isar:
          url: https://github.com/ilbers/isar.git
          branch: next
          tag: v1.1
      `);
      await expect(extractAllPackageFiles({}, ['kas.yml'])).resolves.toEqual([
        emptyRoot,
      ]);
    });

    it('skips lock file given as root', async () => {
      files['kas.lock.yml'] = kasLockFile;
      await expect(
        extractAllPackageFiles({}, ['kas.lock.yml']),
      ).resolves.toEqual([]);
    });
  });
});
