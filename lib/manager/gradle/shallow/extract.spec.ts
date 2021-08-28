import { extractAllPackageFiles } from '..';
import { fs } from '../../../../test/util';
import dedent from 'dedent';

jest.mock('../../../util/fs');

function mockFs(files: Record<string, string>): void {
  fs.readLocalFile.mockImplementation((fileName: string): Promise<string> => {
    const content = files?.[fileName];
    return typeof content === 'string'
      ? Promise.resolve(content)
      : Promise.reject(`File not found: ${fileName}`);
  });
}

describe('manager/gradle/shallow/extract', () => {
  beforeAll(() => {});
  afterAll(() => {
    jest.resetAllMocks();
  });

  it('returns null', async () => {
    mockFs({
      'gradle.properties': '',
      'build.gradle': '',
    });

    const res = await extractAllPackageFiles({} as never, [
      'build.gradle',
      'gradle.properties',
    ]);

    expect(res).toBeNull();
  });

  it('works', async () => {
    mockFs({
      'gradle.properties': 'baz=1.2.3',
      'build.gradle': 'url "https://example.com"; "foo:bar:$baz"',
      'settings.gradle': null,
    });

    const res = await extractAllPackageFiles({} as never, [
      'build.gradle',
      'gradle.properties',
      'settings.gradle',
    ]);

    expect(res).toMatchObject([
      {
        packageFile: 'gradle.properties',
        deps: [
          {
            depName: 'foo:bar',
            currentValue: '1.2.3',
            registryUrls: [
              'https://repo.maven.apache.org/maven2',
              'https://example.com',
            ],
          },
        ],
      },
      { packageFile: 'build.gradle', deps: [] },
      {
        datasource: 'maven',
        deps: [],
        packageFile: 'settings.gradle',
      },
    ]);
  });

  it('inherits gradle variables', async () => {
    const fsMock = {
      'gradle.properties': 'foo=1.0.0',
      'build.gradle': 'foo = "1.0.1"',
      'aaa/gradle.properties': 'bar = "2.0.0"',
      'aaa/build.gradle': 'bar = "2.0.1"',
      'aaa/bbb/build.gradle': ['foo:foo:$foo', 'bar:bar:$bar']
        .map((x) => `"${x}"`)
        .join('\n'),
    };

    mockFs(fsMock);

    const res = await extractAllPackageFiles({} as never, Object.keys(fsMock));

    expect(res).toMatchObject([
      { packageFile: 'gradle.properties', deps: [] },
      {
        packageFile: 'build.gradle',
        deps: [{ depName: 'foo:foo', currentValue: '1.0.1' }],
      },
      { packageFile: 'aaa/gradle.properties', deps: [] },
      {
        packageFile: 'aaa/build.gradle',
        deps: [{ depName: 'bar:bar', currentValue: '2.0.1' }],
      },
      { packageFile: 'aaa/bbb/build.gradle', deps: [] },
    ]);
  });

  it('deduplicates registry urls', async () => {
    const fsMock = {
      'build.gradle': [
        'url "https://repo.maven.apache.org/maven2"',
        'url "https://repo.maven.apache.org/maven2"',
        'url "https://example.com"',
        'url "https://example.com"',
        'id "foo.bar" version "1.2.3"',
        '"foo:bar:1.2.3"',
      ].join(';\n'),
    };

    mockFs(fsMock);

    const res = await extractAllPackageFiles({} as never, Object.keys(fsMock));

    expect(res).toMatchObject([
      {
        packageFile: 'build.gradle',
        deps: [
          {
            depType: 'plugin',
            registryUrls: [
              'https://repo.maven.apache.org/maven2',
              'https://plugins.gradle.org/m2/',
              'https://example.com',
            ],
          },
          {
            registryUrls: [
              'https://repo.maven.apache.org/maven2',
              'https://example.com',
            ],
          },
        ],
      },
    ]);
  });

  it('works with dependency catalogs', async () => {
    const fsMock = {
      'gradle/libs.versions.toml': dedent`
        [versions]
        detekt = "1.17.0"
        kotest = "4.6.0"
        publish-on-central = "0.5.0"

        [libraries]
        detekt-formatting = { module = "io.gitlab.arturbosch.detekt:detekt-formatting", version.ref = "detekt" }
        kotest-assertions-core-jvm = { module = "io.kotest:kotest-assertions-core-jvm", version.ref = "kotest" }
        kotest-runner-junit5 = { module = "io.kotest:kotest-runner-junit5", version.ref = "kotest" }
        mockito = { group = "org.mockito", name = "mockito-core", version = "3.10.0" }

        [bundles]
        kotest = [ "kotest-runner-junit5", "kotest-assertions-core-jvm" ]

        [plugins]
        detekt = { id = "io.gitlab.arturbosch.detekt", version.ref = "detekt" }
        publish-on-central = { id = "org.danilopianini.publish-on-central", version.ref = "publish-on-central" }
      `,
    };
    mockFs(fsMock);
    const res = await extractAllPackageFiles({} as never, Object.keys(fsMock));
    expect(res).toMatchObject([
      {
        packageFile: 'gradle/libs.versions.toml',
        deps: [
          {
            depName: 'io.gitlab.arturbosch.detekt:detekt-formatting',
            groupName: 'io.gitlab.arturbosch.detekt',
            currentValue: '1.17.0',
            managerData: {
              fileReplacePosition: 21,
              packageFile: 'gradle/libs.versions.toml',
            },
          },
          {
            depName: 'io.kotest:kotest-assertions-core-jvm',
            groupName: 'io.kotest',
            currentValue: '4.6.0',
            managerData: {
              fileReplacePosition: 39,
              packageFile: 'gradle/libs.versions.toml',
            },
          },
          {
            depName: 'io.kotest:kotest-runner-junit5',
            groupName: 'io.kotest',
            currentValue: '4.6.0',
            managerData: {
              fileReplacePosition: 39,
              packageFile: 'gradle/libs.versions.toml',
            },
          },
          {
            depName: 'org.mockito:mockito-core',
            groupName: 'org.mockito',
            currentValue: '3.10.0',
            managerData: {
              fileReplacePosition: 460,
              packageFile: 'gradle/libs.versions.toml',
            },
          },
        ],
      },
    ]);
    console.log(res[0].deps);
    console.log(res);
  });
});
