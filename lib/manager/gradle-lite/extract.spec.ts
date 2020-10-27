import { fs } from '../../../test/util';
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

describe('manager/gradle-lite/extract', () => {
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
            registryUrls: ['https://example.com'],
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
});
