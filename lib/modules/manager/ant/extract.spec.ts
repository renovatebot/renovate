import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import { extractAllPackageFiles, extractPackageFile } from './extract.ts';

vi.mock('../../../util/fs/index.ts');

describe('modules/manager/ant/extract', () => {
  describe('extractPackageFile', () => {
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

    it('returns null for build.xml with no dependencies', async () => {
      fs.readLocalFile.mockResolvedValue(
        '<project><target name="build" /></project>',
      );

      await expect(
        extractAllPackageFiles({}, ['build.xml']),
      ).resolves.toBeNull();
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

      await expect(
        extractAllPackageFiles({}, ['build.xml']),
      ).resolves.toBeNull();
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

      const result = await extractAllPackageFiles({}, [
        'build.xml',
        'build.xml',
      ]);

      expect(result).toHaveLength(1);
      expect(readCount).toBe(1);
    });
  });

  describe('property resolution', () => {
    it('resolves inline property references', async () => {
      fs.readLocalFile.mockResolvedValue(codeBlock`
        <project>
          <property name="slf4j.version" value="1.7.36"/>
          <artifact:dependencies>
            <dependency groupId="org.slf4j" artifactId="slf4j-api" version="\${slf4j.version}" />
          </artifact:dependencies>
        </project>
      `);

      const result = await extractAllPackageFiles({}, ['build.xml']);

      expect(result).toEqual([
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

    it('resolves properties from external .properties files', async () => {
      fs.readLocalFile.mockImplementation((file: string) => {
        if (file === 'build.xml') {
          return Promise.resolve(codeBlock`
            <project>
              <property file="versions.properties"/>
              <artifact:dependencies>
                <dependency groupId="org.slf4j" artifactId="slf4j-api" version="\${slf4j.version}" />
              </artifact:dependencies>
            </project>
          `);
        }
        if (file === 'versions.properties') {
          return Promise.resolve('slf4j.version=1.7.36\n');
        }
        return Promise.resolve(null);
      });

      const result = await extractAllPackageFiles({}, ['build.xml']);

      expect(result).toEqual([
        {
          packageFile: 'versions.properties',
          deps: [
            expect.objectContaining({
              depName: 'org.slf4j:slf4j-api',
              currentValue: '1.7.36',
              sharedVariableName: 'slf4j.version',
              editFile: 'versions.properties',
            }),
          ],
        },
      ]);
    });

    it('implements first-definition-wins for inline properties', async () => {
      fs.readLocalFile.mockResolvedValue(codeBlock`
        <project>
          <property name="junit.version" value="4.13.2"/>
          <property name="junit.version" value="4.12"/>
          <artifact:dependencies>
            <dependency groupId="junit" artifactId="junit" version="\${junit.version}" />
          </artifact:dependencies>
        </project>
      `);

      const result = await extractAllPackageFiles({}, ['build.xml']);

      expect(result).toEqual([
        {
          packageFile: 'build.xml',
          deps: [
            expect.objectContaining({
              currentValue: '4.13.2',
              sharedVariableName: 'junit.version',
            }),
          ],
        },
      ]);
    });

    it('inline properties take precedence over file properties', async () => {
      fs.readLocalFile.mockImplementation((file: string) => {
        if (file === 'build.xml') {
          return Promise.resolve(codeBlock`
            <project>
              <property name="junit.version" value="4.13.2"/>
              <property file="versions.properties"/>
              <artifact:dependencies>
                <dependency groupId="junit" artifactId="junit" version="\${junit.version}" />
              </artifact:dependencies>
            </project>
          `);
        }
        if (file === 'versions.properties') {
          return Promise.resolve('junit.version=4.12\n');
        }
        return Promise.resolve(null);
      });

      const result = await extractAllPackageFiles({}, ['build.xml']);

      expect(result).toEqual([
        {
          packageFile: 'build.xml',
          deps: [
            expect.objectContaining({
              currentValue: '4.13.2',
              sharedVariableName: 'junit.version',
            }),
          ],
        },
      ]);
    });

    it('skips dependencies with unresolvable property references', async () => {
      fs.readLocalFile.mockResolvedValue(codeBlock`
        <project>
          <artifact:dependencies>
            <dependency groupId="junit" artifactId="junit" version="\${missing.version}" />
          </artifact:dependencies>
        </project>
      `);

      const result = await extractAllPackageFiles({}, ['build.xml']);

      expect(result).toEqual([
        {
          packageFile: 'build.xml',
          deps: [
            expect.objectContaining({
              depName: 'junit:junit',
              skipReason: 'version-placeholder',
            }),
          ],
        },
      ]);
    });

    it('detects circular property references', async () => {
      fs.readLocalFile.mockResolvedValue(codeBlock`
        <project>
          <property name="a" value="\${b}"/>
          <property name="b" value="\${a}"/>
          <artifact:dependencies>
            <dependency groupId="junit" artifactId="junit" version="\${a}" />
          </artifact:dependencies>
        </project>
      `);

      const result = await extractAllPackageFiles({}, ['build.xml']);

      expect(result).toEqual([
        {
          packageFile: 'build.xml',
          deps: [
            expect.objectContaining({
              depName: 'junit:junit',
              skipReason: 'recursive-placeholder',
            }),
          ],
        },
      ]);
    });

    it('resolves chained property references', async () => {
      fs.readLocalFile.mockResolvedValue(codeBlock`
        <project>
          <property name="base.version" value="1.7"/>
          <property name="full.version" value="\${base.version}.36"/>
          <property name="slf4j.version" value="\${full.version}"/>
          <artifact:dependencies>
            <dependency groupId="org.slf4j" artifactId="slf4j-api" version="\${slf4j.version}" />
          </artifact:dependencies>
        </project>
      `);

      const result = await extractAllPackageFiles({}, ['build.xml']);

      // chained partial resolution: full.version = "1.7.36" (resolved chain)
      // but slf4j.version = "${full.version}" -> "1.7.36" (single prop ref, so sharedVariableName)
      expect(result).toEqual([
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

    it('groups multiple dependencies sharing the same property', async () => {
      fs.readLocalFile.mockResolvedValue(codeBlock`
        <project>
          <property name="jackson.version" value="2.15.2"/>
          <artifact:dependencies>
            <dependency groupId="com.fasterxml.jackson.core" artifactId="jackson-core" version="\${jackson.version}" />
            <dependency groupId="com.fasterxml.jackson.core" artifactId="jackson-databind" version="\${jackson.version}" />
          </artifact:dependencies>
        </project>
      `);

      const result = await extractAllPackageFiles({}, ['build.xml']);

      expect(result).toEqual([
        {
          packageFile: 'build.xml',
          deps: [
            expect.objectContaining({
              depName: 'com.fasterxml.jackson.core:jackson-core',
              currentValue: '2.15.2',
              sharedVariableName: 'jackson.version',
            }),
            expect.objectContaining({
              depName: 'com.fasterxml.jackson.core:jackson-databind',
              currentValue: '2.15.2',
              sharedVariableName: 'jackson.version',
            }),
          ],
        },
      ]);
    });

    it('handles properties file in subdirectory', async () => {
      fs.readLocalFile.mockImplementation((file: string) => {
        if (file === 'subproject/build.xml') {
          return Promise.resolve(codeBlock`
            <project>
              <property file="config/deps.properties"/>
              <artifact:dependencies>
                <dependency groupId="junit" artifactId="junit" version="\${junit.version}" />
              </artifact:dependencies>
            </project>
          `);
        }
        if (file === 'subproject/config/deps.properties') {
          return Promise.resolve('junit.version=4.13.2\n');
        }
        return Promise.resolve(null);
      });

      const result = await extractAllPackageFiles({}, ['subproject/build.xml']);

      expect(result).toEqual([
        {
          packageFile: 'subproject/config/deps.properties',
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

    it('handles unreadable properties file gracefully', async () => {
      fs.readLocalFile.mockImplementation((file: string) => {
        if (file === 'build.xml') {
          return Promise.resolve(codeBlock`
            <project>
              <property file="missing.properties"/>
              <artifact:dependencies>
                <dependency groupId="junit" artifactId="junit" version="\${junit.version}" />
              </artifact:dependencies>
            </project>
          `);
        }
        return Promise.resolve(null);
      });

      const result = await extractAllPackageFiles({}, ['build.xml']);

      expect(result).toEqual([
        {
          packageFile: 'build.xml',
          deps: [
            expect.objectContaining({
              depName: 'junit:junit',
              skipReason: 'version-placeholder',
            }),
          ],
        },
      ]);
    });

    it('returns deps with mixed inline and property versions', async () => {
      fs.readLocalFile.mockResolvedValue(codeBlock`
        <project>
          <property name="junit.version" value="4.13.2"/>
          <artifact:dependencies>
            <dependency groupId="junit" artifactId="junit" version="\${junit.version}" />
            <dependency groupId="org.slf4j" artifactId="slf4j-api" version="1.7.36" />
          </artifact:dependencies>
        </project>
      `);

      const result = await extractAllPackageFiles({}, ['build.xml']);

      expect(result).toEqual([
        {
          packageFile: 'build.xml',
          deps: [
            expect.objectContaining({
              depName: 'junit:junit',
              currentValue: '4.13.2',
              sharedVariableName: 'junit.version',
            }),
            expect.objectContaining({
              depName: 'org.slf4j:slf4j-api',
              currentValue: '1.7.36',
            }),
          ],
        },
      ]);
    });

    it('ignores dependency without version during property resolution', async () => {
      fs.readLocalFile.mockResolvedValue(codeBlock`
        <project>
          <property name="junit.version" value="4.13.2"/>
          <artifact:dependencies>
            <dependency groupId="org.example" artifactId="lib" />
            <dependency groupId="junit" artifactId="junit" version="\${junit.version}" />
          </artifact:dependencies>
        </project>
      `);

      const result = await extractAllPackageFiles({}, ['build.xml']);

      expect(result).toEqual([
        {
          packageFile: 'build.xml',
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

    it('skips partial placeholder in version string', async () => {
      fs.readLocalFile.mockResolvedValue(codeBlock`
        <project>
          <property name="base.version" value="1.7"/>
          <artifact:dependencies>
            <dependency groupId="org.slf4j" artifactId="slf4j-api" version="\${base.version}.36" />
          </artifact:dependencies>
        </project>
      `);

      const result = await extractAllPackageFiles({}, ['build.xml']);

      expect(result).toEqual([
        {
          packageFile: 'build.xml',
          deps: [
            expect.objectContaining({
              depName: 'org.slf4j:slf4j-api',
              skipReason: 'version-placeholder',
            }),
          ],
        },
      ]);
    });
  });

  describe('edge cases', () => {
    it('handles unparseable XML returned by readLocalFile', async () => {
      fs.readLocalFile.mockResolvedValue('<<< not xml >>>');

      const result = await extractAllPackageFiles({}, ['build.xml']);

      expect(result).toBeNull();
    });

    it('handles absolute path in property file reference', async () => {
      fs.readLocalFile.mockImplementation((file: string) => {
        if (file === 'build.xml') {
          return Promise.resolve(codeBlock`
            <project>
              <property file="/absolute/versions.properties"/>
              <artifact:dependencies>
                <dependency groupId="junit" artifactId="junit" version="\${junit.version}" />
              </artifact:dependencies>
            </project>
          `);
        }
        if (file === '/absolute/versions.properties') {
          return Promise.resolve('junit.version=4.13.2\n');
        }
        return Promise.resolve(null);
      });

      const result = await extractAllPackageFiles({}, ['build.xml']);

      expect(result).toEqual([
        {
          packageFile: '/absolute/versions.properties',
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

    it('skips duplicate property file references', async () => {
      let propsReadCount = 0;
      fs.readLocalFile.mockImplementation((file: string) => {
        if (file === 'build.xml') {
          return Promise.resolve(codeBlock`
            <project>
              <property file="versions.properties"/>
              <property file="versions.properties"/>
              <artifact:dependencies>
                <dependency groupId="junit" artifactId="junit" version="\${junit.version}" />
              </artifact:dependencies>
            </project>
          `);
        }
        if (file === 'versions.properties') {
          propsReadCount++;
          return Promise.resolve('junit.version=4.13.2\n');
        }
        return Promise.resolve(null);
      });

      const result = await extractAllPackageFiles({}, ['build.xml']);

      expect(propsReadCount).toBe(1);
      expect(result).toEqual([
        {
          packageFile: 'versions.properties',
          deps: [
            expect.objectContaining({
              depName: 'junit:junit',
              currentValue: '4.13.2',
            }),
          ],
        },
      ]);
    });

    it('follows import file references', async () => {
      fs.readLocalFile.mockImplementation((fileName: string) => {
        const files: Record<string, string> = {
          'build.xml': codeBlock`
            <project>
              <import file="deps.xml" />
            </project>
          `,
          'deps.xml': codeBlock`
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
          packageFile: 'deps.xml',
          deps: [
            expect.objectContaining({
              depName: 'junit:junit',
              currentValue: '4.13.2',
            }),
          ],
        },
      ]);
    });

    it('skips missing import files', async () => {
      fs.readLocalFile.mockImplementation((fileName: string) => {
        const files: Record<string, string> = {
          'build.xml': codeBlock`
            <project>
              <import file="missing.xml" />
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

    it('does not loop on self-importing files', async () => {
      fs.readLocalFile.mockImplementation((fileName: string) => {
        const files: Record<string, string> = {
          'build.xml': codeBlock`
            <project>
              <import file="build.xml" />
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

    it('shares properties across imported files', async () => {
      fs.readLocalFile.mockImplementation((fileName: string) => {
        const files: Record<string, string> = {
          'build.xml': codeBlock`
            <project>
              <property name="junit.version" value="4.13.2" />
              <import file="deps.xml" />
            </project>
          `,
          'deps.xml': codeBlock`
            <project>
              <artifact:dependencies>
                <dependency groupId="junit" artifactId="junit" version="\${junit.version}" />
              </artifact:dependencies>
            </project>
          `,
        };
        return Promise.resolve(files[fileName] ?? null);
      });

      const result = await extractAllPackageFiles({}, ['build.xml']);

      expect(fs.readLocalFile).toHaveBeenCalledWith('deps.xml', 'utf8');
      expect(result).toEqual([
        {
          packageFile: 'build.xml',
          deps: [
            expect.objectContaining({
              depName: 'junit:junit',
              currentValue: '4.13.2',
              sharedVariableName: 'junit.version',
              editFile: 'build.xml',
            }),
          ],
        },
      ]);
    });

    it('extracts dependency from 3-part coords attribute', async () => {
      fs.readLocalFile.mockImplementation((fileName: string) => {
        const files: Record<string, string> = {
          'build.xml': codeBlock`
            <project>
              <artifact:dependencies>
                <dependency coords="junit:junit:4.13.2" />
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
              datasource: 'maven',
              depName: 'junit:junit',
              currentValue: '4.13.2',
              depType: 'compile',
              registryUrls: [],
            }),
          ],
        },
      ]);
    });

    it('extracts scope from 4-part coords attribute', async () => {
      fs.readLocalFile.mockImplementation((fileName: string) => {
        const files: Record<string, string> = {
          'build.xml': codeBlock`
            <project>
              <artifact:dependencies>
                <dependency coords="junit:junit:4.13.2:test" />
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
              depType: 'test',
            }),
          ],
        },
      ]);
    });

    it('ignores coords with fewer than 3 parts', async () => {
      fs.readLocalFile.mockImplementation((fileName: string) => {
        const files: Record<string, string> = {
          'build.xml': codeBlock`
            <project>
              <artifact:dependencies>
                <dependency coords="junit:junit" />
              </artifact:dependencies>
            </project>
          `,
        };
        return Promise.resolve(files[fileName] ?? null);
      });

      await expect(
        extractAllPackageFiles({}, ['build.xml']),
      ).resolves.toBeNull();
    });

    it('ignores coords with empty groupId', async () => {
      fs.readLocalFile.mockImplementation((fileName: string) => {
        const files: Record<string, string> = {
          'build.xml': codeBlock`
            <project>
              <artifact:dependencies>
                <dependency coords=":junit:4.13.2" />
              </artifact:dependencies>
            </project>
          `,
        };
        return Promise.resolve(files[fileName] ?? null);
      });

      await expect(
        extractAllPackageFiles({}, ['build.xml']),
      ).resolves.toBeNull();
    });

    it('resolves property references in coords version', async () => {
      fs.readLocalFile.mockImplementation((fileName: string) => {
        const files: Record<string, string> = {
          'build.xml': codeBlock`
            <project>
              <property name="junit.version" value="4.13.2" />
              <artifact:dependencies>
                <dependency coords="junit:junit:\${junit.version}" />
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
              sharedVariableName: 'junit.version',
            }),
          ],
        },
      ]);
    });

    it('marks coords dependency with unresolvable property', async () => {
      fs.readLocalFile.mockImplementation((fileName: string) => {
        const files: Record<string, string> = {
          'build.xml': codeBlock`
            <project>
              <artifact:dependencies>
                <dependency coords="junit:junit:\${missing}" />
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
              skipReason: 'version-placeholder',
            }),
          ],
        },
      ]);
    });

    it('treats last part as version when it is not a known scope', async () => {
      fs.readLocalFile.mockImplementation((fileName: string) => {
        const files: Record<string, string> = {
          'build.xml': codeBlock`
            <project>
              <artifact:dependencies>
                <dependency coords="org.example:lib:jar:1.0.0" />
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
              currentValue: '1.0.0',
              depType: 'compile',
            }),
          ],
        },
      ]);
    });

    it('collects registry URLs from remoteRepository elements', async () => {
      fs.readLocalFile.mockImplementation((fileName: string) => {
        const files: Record<string, string> = {
          'build.xml': codeBlock`
            <project>
              <artifact:dependencies>
                <remoteRepository url="https://repo.example.com/maven2" />
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
              registryUrls: ['https://repo.example.com/maven2'],
            }),
          ],
        },
      ]);
    });

    it('collects registry URLs from settingsFile attribute', async () => {
      fs.readLocalFile.mockImplementation((fileName: string) => {
        const files: Record<string, string> = {
          'build.xml': codeBlock`
            <project>
              <artifact:dependencies settingsFile="build/settings.xml">
                <dependency groupId="junit" artifactId="junit" version="4.13.2" />
              </artifact:dependencies>
            </project>
          `,
          'build/settings.xml': codeBlock`
            <settings xmlns="http://maven.apache.org/SETTINGS/1.0.0">
              <mirrors>
                <mirror>
                  <url>https://artifactory.example.com/maven</url>
                </mirror>
              </mirrors>
            </settings>
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
              registryUrls: ['https://artifactory.example.com/maven'],
            }),
          ],
        },
      ]);
    });

    it('merges registries from settingsFile and remoteRepository', async () => {
      fs.readLocalFile.mockImplementation((fileName: string) => {
        const files: Record<string, string> = {
          'build.xml': codeBlock`
            <project>
              <artifact:dependencies settingsFile="build/settings.xml">
                <remoteRepository url="https://repo.example.com/maven2" />
                <dependency groupId="junit" artifactId="junit" version="4.13.2" />
              </artifact:dependencies>
            </project>
          `,
          'build/settings.xml': codeBlock`
            <settings xmlns="http://maven.apache.org/SETTINGS/1.0.0">
              <mirrors>
                <mirror>
                  <url>https://artifactory.example.com/maven</url>
                </mirror>
              </mirrors>
            </settings>
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
              registryUrls: [
                'https://artifactory.example.com/maven',
                'https://repo.example.com/maven2',
              ],
            }),
          ],
        },
      ]);
    });

    it('does not pass registries to dependencies outside the block', async () => {
      fs.readLocalFile.mockImplementation((fileName: string) => {
        const files: Record<string, string> = {
          'build.xml': codeBlock`
            <project>
              <artifact:dependencies>
                <remoteRepository url="https://repo.example.com/maven2" />
                <dependency groupId="junit" artifactId="junit" version="4.13.2" />
              </artifact:dependencies>
              <artifact:dependencies>
                <dependency groupId="org.slf4j" artifactId="slf4j-api" version="1.7.36" />
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
              registryUrls: ['https://repo.example.com/maven2'],
            }),
            expect.objectContaining({
              depName: 'org.slf4j:slf4j-api',
              registryUrls: [],
            }),
          ],
        },
      ]);
    });

    it('handles chain referencing undefined property', async () => {
      fs.readLocalFile.mockResolvedValue(codeBlock`
        <project>
          <property name="a" value="\${nonexistent}"/>
          <artifact:dependencies>
            <dependency groupId="junit" artifactId="junit" version="\${a}" />
          </artifact:dependencies>
        </project>
      `);

      const result = await extractAllPackageFiles({}, ['build.xml']);

      expect(result).toEqual([
        {
          packageFile: 'build.xml',
          deps: [
            expect.objectContaining({
              depName: 'junit:junit',
              skipReason: 'recursive-placeholder',
            }),
          ],
        },
      ]);
    });
  });
});
