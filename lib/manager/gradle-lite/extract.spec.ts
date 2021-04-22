import { fs, getName } from '../../../test/util';
import { extractAllPackageFiles } from '.';

jest.mock('../../util/fs');

function mockFs(files: Record<string, string>): void {
  fs.readLocalFile.mockImplementation(
    (fileName: string): Promise<string> => {
      const content = files?.[fileName];
      return typeof content === 'string'
        ? Promise.resolve(content)
        : Promise.reject(`File not found: ${fileName}`);
    }
  );
}

describe(getName(__filename), () => {
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
});
