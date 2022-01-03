import { extractAllPackageFiles } from '..';
import { fs, loadFixture } from '../../../../test/util';
import { SkipReason } from '../../../types';
import type { ExtractConfig } from '../../types';

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
  afterAll(() => {
    jest.resetAllMocks();
  });

  it('returns null', async () => {
    mockFs({
      'gradle.properties': '',
      'build.gradle': '',
    });

    const res = await extractAllPackageFiles({} as ExtractConfig, [
      'build.gradle',
      'gradle.properties',
    ]);

    expect(res).toBeNull();
  });

  it('extracts from cross-referenced files', async () => {
    mockFs({
      'gradle.properties': 'baz=1.2.3',
      'build.gradle': 'url "https://example.com"; "foo:bar:$baz"',
    });

    const res = await extractAllPackageFiles({} as ExtractConfig, [
      'build.gradle',
      'gradle.properties',
    ]);

    expect(res).toMatchSnapshot([
      {
        packageFile: 'gradle.properties',
        deps: [{ depName: 'foo:bar', currentValue: '1.2.3' }],
      },
      { packageFile: 'build.gradle', deps: [] },
    ]);
  });

  it('skips versions composed from multiple variables', async () => {
    mockFs({
      'build.gradle':
        'foo = "1"; bar = "2"; baz = "3"; "foo:bar:$foo.$bar.$baz"',
    });

    const res = await extractAllPackageFiles({} as ExtractConfig, [
      'build.gradle',
    ]);

    expect(res).toMatchObject([
      {
        packageFile: 'build.gradle',
        deps: [
          {
            depName: 'foo:bar',
            currentValue: '1.2.3',
            registryUrls: ['https://repo.maven.apache.org/maven2'],
            skipReason: SkipReason.ContainsVariable,
            managerData: {
              packageFile: 'build.gradle',
            },
          },
        ],
      },
    ]);
  });

  it('works with file-ext-var', async () => {
    mockFs({
      'gradle.properties': 'baz=1.2.3',
      'build.gradle': 'url "https://example.com"; "foo:bar:$baz@zip"',
      'settings.gradle': null,
    });

    const res = await extractAllPackageFiles({} as ExtractConfig, [
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
      {
        datasource: 'maven',
        deps: [],
        packageFile: 'settings.gradle',
      },
      { packageFile: 'build.gradle', deps: [] },
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

    const res = await extractAllPackageFiles(
      {} as ExtractConfig,
      Object.keys(fsMock)
    );

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

    const res = await extractAllPackageFiles(
      {} as ExtractConfig,
      Object.keys(fsMock)
    );

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
    const tomlFile = loadFixture('1/libs.versions.toml');
    const fsMock = {
      'gradle/libs.versions.toml': tomlFile,
    };
    mockFs(fsMock);
    const res = await extractAllPackageFiles(
      {} as ExtractConfig,
      Object.keys(fsMock)
    );
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
          {
            depName: 'io.gitlab.arturbosch.detekt',
            depType: 'plugin',
            currentValue: '1.17.0',
            commitMessageTopic: 'plugin detekt',
            lookupName:
              'io.gitlab.arturbosch.detekt:io.gitlab.arturbosch.detekt.gradle.plugin',
            managerData: {
              fileReplacePosition: 21,
              packageFile: 'gradle/libs.versions.toml',
            },
            registryUrls: [
              'https://repo.maven.apache.org/maven2',
              'https://plugins.gradle.org/m2/',
            ],
          },
          {
            depName: 'org.danilopianini.publish-on-central',
            depType: 'plugin',
            currentValue: '0.5.0',
            commitMessageTopic: 'plugin publish-on-central',
            lookupName:
              'org.danilopianini.publish-on-central:org.danilopianini.publish-on-central.gradle.plugin',
            managerData: {
              fileReplacePosition: 68,
              packageFile: 'gradle/libs.versions.toml',
            },
            registryUrls: [
              'https://repo.maven.apache.org/maven2',
              'https://plugins.gradle.org/m2/',
            ],
          },
        ],
      },
    ]);
  });

  it("can run Javier's example", async () => {
    const tomlFile = loadFixture('2/libs.versions.toml');
    const fsMock = {
      'gradle/libs.versions.toml': tomlFile,
    };
    mockFs(fsMock);
    const res = await extractAllPackageFiles(
      {} as ExtractConfig,
      Object.keys(fsMock)
    );
    expect(res).toMatchObject([
      {
        packageFile: 'gradle/libs.versions.toml',
        deps: [
          {
            depName: 'com.squareup.okhttp3:okhttp',
            groupName: 'com.squareup.okhttp3',
            currentValue: '4.9.0',
            managerData: {
              fileReplacePosition: 99,
              packageFile: 'gradle/libs.versions.toml',
            },
          },
          {
            depName: 'com.squareup.okio:okio',
            groupName: 'com.squareup.okio',
            currentValue: '2.8.0',
            managerData: {
              fileReplacePosition: 161,
              packageFile: 'gradle/libs.versions.toml',
            },
          },
          {
            depName: 'com.squareup.picasso:picasso',
            groupName: 'com.squareup.picasso',
            currentValue: '2.5.1',
            managerData: {
              fileReplacePosition: 243,
              packageFile: 'gradle/libs.versions.toml',
            },
          },
          {
            depName: 'com.squareup.retrofit2:retrofit',
            groupName: 'com.squareup.retrofit2',
            currentValue: '2.8.2',
            managerData: {
              fileReplacePosition: 41,
              packageFile: 'gradle/libs.versions.toml',
            },
          },
          {
            depName: 'google-firebase-analytics',
            managerData: {
              packageFile: 'gradle/libs.versions.toml',
            },
            skipReason: 'no-version',
          },
          {
            depName: 'google-firebase-crashlytics',
            managerData: {
              packageFile: 'gradle/libs.versions.toml',
            },
            skipReason: 'no-version',
          },
          {
            depName: 'google-firebase-messaging',
            managerData: {
              packageFile: 'gradle/libs.versions.toml',
            },
            skipReason: 'no-version',
          },
          {
            depName: 'org.jetbrains.kotlin.jvm',
            depType: 'plugin',
            currentValue: '1.5.21',
            commitMessageTopic: 'plugin kotlinJvm',
            lookupName:
              'org.jetbrains.kotlin.jvm:org.jetbrains.kotlin.jvm.gradle.plugin',
            managerData: {
              fileReplacePosition: 661,
              packageFile: 'gradle/libs.versions.toml',
            },
            registryUrls: [
              'https://repo.maven.apache.org/maven2',
              'https://plugins.gradle.org/m2/',
            ],
          },
          {
            depName: 'org.jetbrains.kotlin.plugin.serialization',
            depType: 'plugin',
            currentValue: '1.5.21',
            commitMessageTopic: 'plugin kotlinSerialization',
            lookupName:
              'org.jetbrains.kotlin.plugin.serialization:org.jetbrains.kotlin.plugin.serialization.gradle.plugin',
            managerData: {
              fileReplacePosition: 21,
              packageFile: 'gradle/libs.versions.toml',
            },
            registryUrls: [
              'https://repo.maven.apache.org/maven2',
              'https://plugins.gradle.org/m2/',
            ],
          },
          {
            depName: 'org.danilopianini.multi-jvm-test-plugin',
            depType: 'plugin',
            currentValue: '0.3.0',
            commitMessageTopic: 'plugin multiJvm',
            lookupName:
              'org.danilopianini.multi-jvm-test-plugin:org.danilopianini.multi-jvm-test-plugin.gradle.plugin',
            managerData: {
              fileReplacePosition: 822,
              packageFile: 'gradle/libs.versions.toml',
            },
            registryUrls: [
              'https://repo.maven.apache.org/maven2',
              'https://plugins.gradle.org/m2/',
            ],
          },
        ],
      },
    ]);
  });

  it('ignores an empty TOML', async () => {
    const tomlFile = '';
    const fsMock = {
      'gradle/libs.versions.toml': tomlFile,
    };
    mockFs(fsMock);
    const res = await extractAllPackageFiles(
      {} as ExtractConfig,
      Object.keys(fsMock)
    );
    expect(res).toBeNull();
  });
});
