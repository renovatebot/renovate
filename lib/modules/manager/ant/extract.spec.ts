import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import { extractAllPackageFiles, extractPackageFile } from './extract.ts';

vi.mock('../../../util/fs/index.ts');

describe('modules/manager/ant/extract', () => {
  it('extracts inline version dependencies from build.xml', () => {
    expect(
      extractPackageFile(
        codeBlock`
          <project>
            <artifact:dependencies>
              <dependency groupId="junit" artifactId="junit" version="4.13.2" scope="test" />
            </artifact:dependencies>
          </project>
        `,
        'build.xml',
      ),
    ).toEqual({
      deps: [
        expect.objectContaining({
          datasource: 'maven',
          depName: 'junit:junit',
          currentValue: '4.13.2',
          depType: 'test',
          registryUrls: [],
        }),
      ],
    });
  });

  it('extracts multiple dependencies', () => {
    expect(
      extractPackageFile(
        codeBlock`
          <project>
            <artifact:dependencies>
              <dependency groupId="junit" artifactId="junit" version="4.13.2" scope="test" />
              <dependency groupId="org.slf4j" artifactId="slf4j-api" version="1.7.36" scope="compile" />
              <dependency groupId="org.apache.commons" artifactId="commons-lang3" version="3.12.0" scope="runtime" />
            </artifact:dependencies>
          </project>
        `,
        'build.xml',
      ),
    ).toMatchObject({
      deps: [
        expect.objectContaining({
          depName: 'junit:junit',
          currentValue: '4.13.2',
          depType: 'test',
        }),
        expect.objectContaining({
          depName: 'org.slf4j:slf4j-api',
          currentValue: '1.7.36',
          depType: 'compile',
        }),
        expect.objectContaining({
          depName: 'org.apache.commons:commons-lang3',
          currentValue: '3.12.0',
          depType: 'runtime',
        }),
      ],
    });
  });

  it('defaults depType to compile when no scope is set', () => {
    expect(
      extractPackageFile(
        codeBlock`
          <project>
            <artifact:dependencies>
              <dependency groupId="junit" artifactId="junit" version="4.13.2" />
            </artifact:dependencies>
          </project>
        `,
        'build.xml',
      ),
    ).toEqual({
      deps: [
        expect.objectContaining({
          depName: 'junit:junit',
          depType: 'compile',
        }),
      ],
    });
  });

  it('returns null for invalid XML', () => {
    expect(extractPackageFile('<<< not xml >>>', 'build.xml')).toBeNull();
  });

  it('returns null for build.xml with no dependencies', () => {
    expect(
      extractPackageFile(
        '<project><target name="build" /></project>',
        'build.xml',
      ),
    ).toBeNull();
  });

  it('ignores dependency nodes without version', () => {
    expect(
      extractPackageFile(
        codeBlock`
          <project>
            <artifact:dependencies>
              <dependency groupId="org.example" artifactId="lib" />
            </artifact:dependencies>
          </project>
        `,
        'build.xml',
      ),
    ).toBeNull();
  });

  it('extracts dependencies with single-quoted attributes', () => {
    expect(
      extractPackageFile(
        "<project><artifact:dependencies><dependency groupId='junit' artifactId='junit' version='4.13.2' /></artifact:dependencies></project>",
        'build.xml',
      ),
    ).toEqual({
      deps: [
        expect.objectContaining({
          depName: 'junit:junit',
          currentValue: '4.13.2',
        }),
      ],
    });
  });

  it('returns null for unreadable build.xml', async () => {
    fs.readLocalFile.mockResolvedValue(null);

    await expect(extractAllPackageFiles({}, ['build.xml'])).resolves.toBeNull();
  });

  it('does not revisit the same file', async () => {
    let readCount = 0;
    fs.readLocalFile.mockImplementation(() => {
      readCount++;
      return Promise.resolve(codeBlock`
        <project>
          <artifact:dependencies>
            <dependency groupId="junit" artifactId="junit" version="4.13.2" />
          </artifact:dependencies>
        </project>
      `);
    });

    const result = await extractAllPackageFiles({}, ['build.xml', 'build.xml']);

    expect(result).toHaveLength(1);
    expect(readCount).toBe(1);
  });
});
