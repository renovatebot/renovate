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

  it('resolves same-file property references', async () => {
    fs.readLocalFile.mockImplementation((fileName: string) => {
      const files: Record<string, string> = {
        'build.xml': codeBlock`
          <project>
            <property name="slf4j.version" value="1.7.36" />
            <artifact:dependencies>
              <dependency groupId="org.slf4j" artifactId="slf4j-api" version="\${slf4j.version}" scope="compile" />
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
            depName: 'org.slf4j:slf4j-api',
            currentValue: '1.7.36',
            depType: 'compile',
            sharedVariableName: 'slf4j.version',
          }),
        ],
      },
    ]);
  });

  it('resolves chained property references', async () => {
    fs.readLocalFile.mockImplementation((fileName: string) => {
      const files: Record<string, string> = {
        'build.xml': codeBlock`
          <project>
            <property name="base.version" value="1.7.36" />
            <property name="slf4j.version" value="\${base.version}" />
            <artifact:dependencies>
              <dependency groupId="org.slf4j" artifactId="slf4j-api" version="\${slf4j.version}" scope="compile" />
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
            depName: 'org.slf4j:slf4j-api',
            currentValue: '1.7.36',
            sharedVariableName: 'slf4j.version',
          }),
        ],
      },
    ]);
  });

  it('marks as contains-variable when chained property partially resolves', async () => {
    fs.readLocalFile.mockImplementation((fileName: string) => {
      const files: Record<string, string> = {
        'build.xml': codeBlock`
          <project>
            <property name="a" value="\${known}-\${unknown}" />
            <property name="known" value="1.0" />
            <artifact:dependencies>
              <dependency groupId="org.example" artifactId="lib" version="\${a}" />
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
            depName: 'org.example:lib',
            skipReason: 'contains-variable',
          }),
        ],
      },
    ]);
  });

  it('resolves properties from external .properties files', async () => {
    fs.readLocalFile.mockImplementation((fileName: string) => {
      const files: Record<string, string> = {
        'build.xml': codeBlock`
          <project>
            <property file="versions.properties" />
            <artifact:dependencies>
              <dependency groupId="junit" artifactId="junit" version="\${junit.version}" />
            </artifact:dependencies>
          </project>
        `,
        'versions.properties': 'junit.version=4.13.2\n',
      };
      return Promise.resolve(files[fileName] ?? null);
    });

    await expect(extractAllPackageFiles({}, ['build.xml'])).resolves.toEqual([
      {
        packageFile: 'versions.properties',
        deps: [
          expect.objectContaining({
            depName: 'junit:junit',
            currentValue: '4.13.2',
            sharedVariableName: 'junit.version',
          }),
        ],
      },
    ]);
  });

  it('keeps the first property definition and ignores later overrides', async () => {
    fs.readLocalFile.mockImplementation((fileName: string) => {
      const files: Record<string, string> = {
        'build.xml': codeBlock`
          <project>
            <property file="versions-a.properties" />
            <property file="versions-b.properties" />
            <artifact:dependencies>
              <dependency groupId="junit" artifactId="junit" version="\${junit.version}" />
            </artifact:dependencies>
          </project>
        `,
        'versions-a.properties': 'junit.version=4.13.2\n',
        'versions-b.properties': 'junit.version=4.13.3\n',
      };
      return Promise.resolve(files[fileName] ?? null);
    });

    await expect(extractAllPackageFiles({}, ['build.xml'])).resolves.toEqual([
      {
        packageFile: 'versions-a.properties',
        deps: [
          expect.objectContaining({
            depName: 'junit:junit',
            currentValue: '4.13.2',
            sharedVariableName: 'junit.version',
          }),
        ],
      },
    ]);
  });

  it('skips dependencies with unresolvable property references', async () => {
    fs.readLocalFile.mockImplementation((fileName: string) => {
      const files: Record<string, string> = {
        'build.xml': codeBlock`
          <project>
            <artifact:dependencies>
              <dependency groupId="org.example" artifactId="lib" version="\${undefined.prop}" />
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
            depName: 'org.example:lib',
            skipReason: 'contains-variable',
          }),
        ],
      },
    ]);
  });

  it('marks dependency as contains-variable for circular property references', async () => {
    fs.readLocalFile.mockImplementation((fileName: string) => {
      const files: Record<string, string> = {
        'build.xml': codeBlock`
          <project>
            <property name="a" value="\${b}" />
            <property name="b" value="\${a}" />
            <artifact:dependencies>
              <dependency groupId="org.example" artifactId="lib" version="\${a}" />
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
            depName: 'org.example:lib',
            skipReason: 'contains-variable',
          }),
        ],
      },
    ]);
  });

  it('marks dependency as contains-variable when nested property is unresolvable', async () => {
    fs.readLocalFile.mockImplementation((fileName: string) => {
      const files: Record<string, string> = {
        'build.xml': codeBlock`
          <project>
            <property name="a" value="\${missing}" />
            <artifact:dependencies>
              <dependency groupId="org.example" artifactId="lib" version="\${a}" />
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
            depName: 'org.example:lib',
            skipReason: 'contains-variable',
          }),
        ],
      },
    ]);
  });

  it('marks inline version as contains-variable when value has partial unresolvable reference', async () => {
    fs.readLocalFile.mockImplementation((fileName: string) => {
      const files: Record<string, string> = {
        'build.xml': codeBlock`
          <project>
            <artifact:dependencies>
              <dependency groupId="org.example" artifactId="lib" version="prefix-\${unknown}" />
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
            depName: 'org.example:lib',
            skipReason: 'contains-variable',
          }),
        ],
      },
    ]);
  });

  it('skips unreadable properties files', async () => {
    fs.readLocalFile.mockImplementation((fileName: string) => {
      const files: Record<string, string> = {
        'build.xml': codeBlock`
          <project>
            <property file="missing.properties" />
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
            currentValue: '4.13.2',
          }),
        ],
      },
    ]);
  });

  it('skips properties lines without separator or with empty values', async () => {
    fs.readLocalFile.mockImplementation((fileName: string) => {
      const files: Record<string, string> = {
        'build.xml': codeBlock`
          <project>
            <property file="versions.properties" />
            <artifact:dependencies>
              <dependency groupId="junit" artifactId="junit" version="\${junit.version}" />
            </artifact:dependencies>
          </project>
        `,
        'versions.properties':
          '# comment line\njust-a-key-no-separator\nempty.value=\njunit.version=4.13.2\n',
      };
      return Promise.resolve(files[fileName] ?? null);
    });

    const result = await extractAllPackageFiles({}, ['build.xml']);

    expect(result).toEqual([
      {
        packageFile: 'versions.properties',
        deps: [
          expect.objectContaining({
            depName: 'junit:junit',
            currentValue: '4.13.2',
            sharedVariableName: 'junit.version',
          }),
        ],
      },
    ]);
  });

  it('does not revisit the same properties file twice', async () => {
    fs.readLocalFile.mockImplementation((fileName: string) => {
      const files: Record<string, string> = {
        'build.xml': codeBlock`
          <project>
            <property file="v.properties" />
            <property file="v.properties" />
            <artifact:dependencies>
              <dependency groupId="junit" artifactId="junit" version="\${v}" />
            </artifact:dependencies>
          </project>
        `,
        'v.properties': 'v=1.0\n',
      };
      return Promise.resolve(files[fileName] ?? null);
    });

    const result = await extractAllPackageFiles({}, ['build.xml']);

    expect(result).toEqual([
      {
        packageFile: 'v.properties',
        deps: [
          expect.objectContaining({
            depName: 'junit:junit',
            currentValue: '1.0',
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
