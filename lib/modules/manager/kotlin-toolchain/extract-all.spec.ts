import { codeBlock } from 'common-tags';
import { fs, logger } from '~test/util.ts';
import { processSupersedesManagers } from '../../../workers/repository/extract/supersedes.ts';
import type { ExtractResults } from '../../../workers/repository/extract/types.ts';
import { extractAllPackageFiles } from './extract-all.ts';

vi.mock('../../../util/fs/index.ts');

const catalog = codeBlock`
  [libraries]
  my-library = "org.example:lib:1.0.0"
  unused = "org.example:unused:1.0.0"
`;
const moduleYaml = codeBlock`
  product: jvm/app
  dependencies:
    - $libs.my.library
  repositories:
    - https://maven.example.com/private
`;
const defaults = [
  'https://repo.maven.apache.org/maven2',
  'https://maven.google.com',
];

function mockFiles(files: Record<string, string>): void {
  fs.readLocalFile.mockImplementation((file) =>
    Promise.resolve(files[file] ?? null),
  );
}

describe('modules/manager/kotlin-toolchain/extract-all', () => {
  it.each(['libs.versions.toml', 'gradle/libs.versions.toml'])(
    'owns %s in a standalone Kotlin Toolchain project',
    async (packageFile) => {
      mockFiles({ 'module.yaml': moduleYaml, [packageFile]: catalog });

      const res = await extractAllPackageFiles({}, [
        packageFile,
        'module.yaml',
      ]);

      expect(res).toMatchObject([
        { packageFile: 'module.yaml' },
        {
          packageFile,
          deps: [
            {
              depName: 'org.example:lib',
              registryUrls: [...defaults, 'https://maven.example.com/private'],
            },
            { depName: 'org.example:unused', registryUrls: defaults },
          ],
        },
      ]);
    },
  );

  it('scopes catalogs to the nearest project and combines repositories of users', async () => {
    mockFiles({
      'project.yaml': 'modules: [app, other]',
      'app/module.yaml': moduleYaml,
      'other/module.yaml': moduleYaml.replace('private', 'second'),
      'unused/module.yaml':
        'product: jvm/lib\nrepositories: [https://maven.example.com/unused]',
      'common.module-template.yaml': moduleYaml.replace('private', 'template'),
      'libs.versions.toml': catalog,
      'nested/project.yaml': 'modules: [app]',
      'nested/app/module.yaml': moduleYaml.replace('private', 'nested'),
      'nested/libs.versions.toml': catalog,
      'app/libs.versions.toml': catalog,
    });
    const packageFiles = [
      'project.yaml',
      'app/module.yaml',
      'other/module.yaml',
      'unused/module.yaml',
      'common.module-template.yaml',
      'libs.versions.toml',
      'nested/project.yaml',
      'nested/app/module.yaml',
      'nested/libs.versions.toml',
      'app/libs.versions.toml',
    ];

    const res = await extractAllPackageFiles({}, packageFiles);

    const rootCatalog = res?.find(
      ({ packageFile }) => packageFile === 'libs.versions.toml',
    );
    const nestedCatalog = res?.find(
      ({ packageFile }) => packageFile === 'nested/libs.versions.toml',
    );
    expect(rootCatalog?.deps[0].registryUrls).toEqual([
      ...defaults,
      'https://maven.example.com/private',
      'https://maven.example.com/second',
      'https://maven.example.com/template',
    ]);
    expect(nestedCatalog?.deps[0].registryUrls).toEqual([
      ...defaults,
      'https://maven.example.com/nested',
    ]);
    expect(
      res?.some(({ packageFile }) => packageFile === 'app/libs.versions.toml'),
    ).toBeFalse();
  });

  it('keeps unrelated projects and standalone module roots separate', async () => {
    mockFiles({
      'a/module.yaml': `${moduleYaml}\ntest-dependencies:\n  - org.example:test:1.0.0`,
      'a/libs.versions.toml': catalog,
      'b/module.yaml': 'product: jvm/lib',
      'b/libs.versions.toml': catalog,
      'elsewhere.module-template.yaml': moduleYaml,
    });

    const res = await extractAllPackageFiles({}, [
      'a/module.yaml',
      'a/libs.versions.toml',
      'b/module.yaml',
      'b/libs.versions.toml',
      'elsewhere.module-template.yaml',
    ]);

    expect(
      res?.find(({ packageFile }) => packageFile === 'b/libs.versions.toml')
        ?.deps[0].registryUrls,
    ).toEqual(defaults);
  });

  it.each([
    'settings.gradle',
    'settings.gradle.kts',
    'build.gradle',
    'build.gradle.kts',
  ])('leaves catalogs to Gradle when %s is present', async (gradleFile) => {
    mockFiles({
      'module.yaml': moduleYaml,
      'libs.versions.toml': catalog,
      [gradleFile]: '',
    });

    const res = await extractAllPackageFiles({}, [
      'module.yaml',
      'libs.versions.toml',
    ]);

    expect(res?.map(({ packageFile }) => packageFile)).toEqual(['module.yaml']);
  });

  it('does not treat a template or a catalog alone as a project root', async () => {
    mockFiles({
      'common.module-template.yaml': moduleYaml,
      'libs.versions.toml': catalog,
    });

    const res = await extractAllPackageFiles({}, [
      'common.module-template.yaml',
      'libs.versions.toml',
    ]);

    expect(res?.map(({ packageFile }) => packageFile)).toEqual([
      'common.module-template.yaml',
    ]);
    await expect(
      extractAllPackageFiles({}, ['libs.versions.toml']),
    ).resolves.toBeNull();
  });

  it('skips conflicting catalog locations', async () => {
    mockFiles({
      'module.yaml': moduleYaml,
      'libs.versions.toml': catalog,
      'gradle/libs.versions.toml': catalog,
    });

    const res = await extractAllPackageFiles({}, [
      'module.yaml',
      'libs.versions.toml',
      'gradle/libs.versions.toml',
    ]);

    expect(res?.map(({ packageFile }) => packageFile)).toEqual(['module.yaml']);
    expect(logger.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('both catalog locations are present'),
    );
  });

  it.each([null, '[libraries', ''])(
    'handles missing, invalid or empty catalogs: %s',
    async (content) => {
      mockFiles(
        content === null
          ? { 'module.yaml': moduleYaml }
          : { 'module.yaml': moduleYaml, 'libs.versions.toml': content },
      );

      const res = await extractAllPackageFiles({}, [
        'module.yaml',
        'libs.versions.toml',
      ]);

      expect(res).toHaveLength(content === '' ? 2 : 1);
    },
  );

  it('skips missing or unrelated YAML files', async () => {
    mockFiles({
      'project.yaml': 'name: unrelated',
      'bad/module.yaml': '[bad',
      'empty/module.yaml': '',
    });

    const res = await extractAllPackageFiles({}, [
      'missing/module.yaml',
      'project.yaml',
      'bad/module.yaml',
      'empty/module.yaml',
    ]);

    expect(res).toBeNull();
    await expect(extractAllPackageFiles({}, [])).resolves.toBeNull();
  });

  it('removes duplicate Gradle catalog extraction while keeping other Gradle files', async () => {
    mockFiles({ 'module.yaml': moduleYaml, 'libs.versions.toml': catalog });
    const packageFiles = await extractAllPackageFiles({}, [
      'module.yaml',
      'libs.versions.toml',
    ]);
    const extracts: ExtractResults[] = [
      { manager: 'kotlin-toolchain', packageFiles: packageFiles! },
      {
        manager: 'gradle',
        packageFiles: [
          { packageFile: 'libs.versions.toml', deps: [] },
          { packageFile: 'other/build.gradle.kts', deps: [] },
        ],
      },
    ];

    processSupersedesManagers(extracts);

    expect(extracts[1].packageFiles).toEqual([
      { packageFile: 'other/build.gradle.kts', deps: [] },
    ]);
    expect(extracts[0].packageFiles).toHaveLength(2);
  });

  it('keeps lock-aware Gradle extraction of a shared catalog', async () => {
    mockFiles({ 'module.yaml': moduleYaml, 'libs.versions.toml': catalog });
    const packageFiles = await extractAllPackageFiles({}, [
      'module.yaml',
      'libs.versions.toml',
    ]);
    const extracts: ExtractResults[] = [
      { manager: 'kotlin-toolchain', packageFiles: packageFiles! },
      {
        manager: 'gradle',
        packageFiles: [
          {
            packageFile: 'libs.versions.toml',
            deps: [],
            lockFiles: ['gradle.lockfile'],
          },
        ],
      },
    ];

    processSupersedesManagers(extracts);

    expect(
      extracts[0].packageFiles?.map(({ packageFile }) => packageFile),
    ).toEqual(['module.yaml']);
    expect(extracts[1].packageFiles?.[0].lockFiles).toEqual([
      'gradle.lockfile',
    ]);
  });
});
