import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import { extractAllPackageFiles } from './extract.ts';

vi.mock('../../../util/fs/index.ts');

describe('modules/manager/ant/extract', () => {
  it('extracts inline version dependencies from build.xml', async () => {
    fs.readLocalFile.mockImplementation((fileName: string) => {
      const files: Record<string, string> = {
        'build.xml': codeBlock`
          <project>
            <artifact:dependencies>
              <dependency groupId="junit" artifactId="junit" version="4.13.2" scope="test" />
            </artifact:dependencies>
          </project>
        `,
      };
      return Promise.resolve(files[fileName] ?? null);
    });

    await expect(extractAllPackageFiles({}, ['build.xml'])).resolves.toEqual([
      {
        packageFile: 'build.xml',
        deps: [
          expect.objectContaining({
            datasource: 'maven',
            depName: 'junit:junit',
            currentValue: '4.13.2',
            depType: 'test',
            registryUrls: [],
          }),
        ],
      },
    ]);
  });

  it('extracts multiple dependencies', async () => {
    fs.readLocalFile.mockImplementation((fileName: string) => {
      const files: Record<string, string> = {
        'build.xml': codeBlock`
          <project>
            <artifact:dependencies>
              <dependency groupId="junit" artifactId="junit" version="4.13.2" scope="test" />
              <dependency groupId="org.slf4j" artifactId="slf4j-api" version="1.7.36" scope="compile" />
              <dependency groupId="org.apache.commons" artifactId="commons-lang3" version="3.12.0" scope="runtime" />
            </artifact:dependencies>
          </project>
        `,
      };
      return Promise.resolve(files[fileName] ?? null);
    });

    const result = await extractAllPackageFiles({}, ['build.xml']);

    expect(result).toHaveLength(1);
    expect(result![0].deps).toHaveLength(3);
    expect(result![0].deps).toContainEqual(
      expect.objectContaining({
        depName: 'junit:junit',
        currentValue: '4.13.2',
        depType: 'test',
      }),
    );
    expect(result![0].deps).toContainEqual(
      expect.objectContaining({
        depName: 'org.slf4j:slf4j-api',
        currentValue: '1.7.36',
        depType: 'compile',
      }),
    );
    expect(result![0].deps).toContainEqual(
      expect.objectContaining({
        depName: 'org.apache.commons:commons-lang3',
        currentValue: '3.12.0',
        depType: 'runtime',
      }),
    );
  });

  it('defaults depType to compile when no scope is set', async () => {
    fs.readLocalFile.mockImplementation((fileName: string) => {
      const files: Record<string, string> = {
        'build.xml': codeBlock`
          <project>
            <artifact:dependencies>
              <dependency groupId="junit" artifactId="junit" version="4.13.2" />
            </artifact:dependencies>
          </project>
        `,
      };
      return Promise.resolve(files[fileName] ?? null);
    });

    const result = await extractAllPackageFiles({}, ['build.xml']);

    expect(result).toEqual([
      {
        packageFile: 'build.xml',
        deps: [
          expect.objectContaining({
            depName: 'junit:junit',
            depType: 'compile',
          }),
        ],
      },
    ]);
  });

  it('returns null for unreadable build.xml', async () => {
    fs.readLocalFile.mockResolvedValue(null);

    await expect(extractAllPackageFiles({}, ['build.xml'])).resolves.toBeNull();
  });

  it('returns null for invalid XML', async () => {
    fs.readLocalFile.mockResolvedValue('<<< not xml >>>');

    await expect(extractAllPackageFiles({}, ['build.xml'])).resolves.toBeNull();
  });

  it('returns null for build.xml with no dependencies', async () => {
    fs.readLocalFile.mockImplementation((fileName: string) => {
      const files: Record<string, string> = {
        'build.xml': '<project><target name="build" /></project>',
      };
      return Promise.resolve(files[fileName] ?? null);
    });

    await expect(extractAllPackageFiles({}, ['build.xml'])).resolves.toBeNull();
  });

  it('ignores dependency nodes without version', async () => {
    fs.readLocalFile.mockImplementation((fileName: string) => {
      const files: Record<string, string> = {
        'build.xml': codeBlock`
          <project>
            <artifact:dependencies>
              <dependency groupId="org.example" artifactId="lib" />
            </artifact:dependencies>
          </project>
        `,
      };
      return Promise.resolve(files[fileName] ?? null);
    });

    await expect(extractAllPackageFiles({}, ['build.xml'])).resolves.toBeNull();
  });

  it('extracts dependencies with single-quoted attributes', async () => {
    fs.readLocalFile.mockImplementation((fileName: string) => {
      const files: Record<string, string> = {
        'build.xml':
          "<project><artifact:dependencies><dependency groupId='junit' artifactId='junit' version='4.13.2' /></artifact:dependencies></project>",
      };
      return Promise.resolve(files[fileName] ?? null);
    });

    const result = await extractAllPackageFiles({}, ['build.xml']);

    expect(result).toEqual([
      {
        packageFile: 'build.xml',
        deps: [
          expect.objectContaining({
            depName: 'junit:junit',
            currentValue: '4.13.2',
          }),
        ],
      },
    ]);
  });

  it('does not revisit the same file', async () => {
    let readCount = 0;
    fs.readLocalFile.mockImplementation((fileName: string) => {
      if (fileName === 'build.xml') {
        readCount++;
      }
      const files: Record<string, string> = {
        'build.xml': codeBlock`
          <project>
            <artifact:dependencies>
              <dependency groupId="junit" artifactId="junit" version="4.13.2" />
            </artifact:dependencies>
          </project>
        `,
      };
      return Promise.resolve(files[fileName] ?? null);
    });

    const result = await extractAllPackageFiles({}, ['build.xml', 'build.xml']);

    expect(result).toHaveLength(1);
    expect(readCount).toBe(1);
  });
});
