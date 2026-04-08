import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import {
  extractAllPackageFiles,
  extractPackageFile,
  parsePropertiesFile,
} from './extract.ts';
import type { AntProp } from './types.ts';

vi.mock('../../../util/fs/index.ts');

describe('modules/manager/ant/extract', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

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
            <dependency groupId="org.slf4j" artifactId="slf4j-api" version="${'${slf4j.version}'}" />
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
                <dependency groupId="org.slf4j" artifactId="slf4j-api" version="${'${slf4j.version}'}" />
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
            <dependency groupId="junit" artifactId="junit" version="${'${junit.version}'}" />
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
                <dependency groupId="junit" artifactId="junit" version="${'${junit.version}'}" />
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
            <dependency groupId="junit" artifactId="junit" version="${'${missing.version}'}" />
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
          <property name="a" value="${'${b}'}"/>
          <property name="b" value="${'${a}'}"/>
          <artifact:dependencies>
            <dependency groupId="junit" artifactId="junit" version="${'${a}'}" />
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
          <property name="full.version" value="${'${base.version}'}.36"/>
          <property name="slf4j.version" value="${'${full.version}'}"/>
          <artifact:dependencies>
            <dependency groupId="org.slf4j" artifactId="slf4j-api" version="${'${slf4j.version}'}" />
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
            <dependency groupId="com.fasterxml.jackson.core" artifactId="jackson-core" version="${'${jackson.version}'}" />
            <dependency groupId="com.fasterxml.jackson.core" artifactId="jackson-databind" version="${'${jackson.version}'}" />
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
                <dependency groupId="junit" artifactId="junit" version="${'${junit.version}'}" />
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
                <dependency groupId="junit" artifactId="junit" version="${'${junit.version}'}" />
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
            <dependency groupId="junit" artifactId="junit" version="${'${junit.version}'}" />
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

    it('skips partial placeholder in version string', async () => {
      fs.readLocalFile.mockResolvedValue(codeBlock`
        <project>
          <property name="base.version" value="1.7"/>
          <artifact:dependencies>
            <dependency groupId="org.slf4j" artifactId="slf4j-api" version="${'${base.version}'}.36" />
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
                <dependency groupId="junit" artifactId="junit" version="${'${junit.version}'}" />
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
                <dependency groupId="junit" artifactId="junit" version="${'${junit.version}'}" />
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

    it('handles chain referencing undefined property', async () => {
      fs.readLocalFile.mockResolvedValue(codeBlock`
        <project>
          <property name="a" value="${'${nonexistent}'}"/>
          <artifact:dependencies>
            <dependency groupId="junit" artifactId="junit" version="${'${a}'}" />
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

  describe('parsePropertiesFile', () => {
    it('parses key=value pairs', () => {
      const props: Record<string, AntProp> = {};
      parsePropertiesFile(
        'key1=value1\nkey2=value2\n',
        'test.properties',
        props,
      );

      expect(props.key1).toEqual(
        expect.objectContaining({
          val: 'value1',
          packageFile: 'test.properties',
        }),
      );
      expect(props.key2).toEqual(
        expect.objectContaining({
          val: 'value2',
          packageFile: 'test.properties',
        }),
      );
    });

    it('skips comments and blank lines', () => {
      const props: Record<string, AntProp> = {};
      parsePropertiesFile(
        '# comment\n\nkey=value\n! another comment\n',
        'test.properties',
        props,
      );

      expect(Object.keys(props)).toEqual(['key']);
    });

    it('supports colon separator', () => {
      const props: Record<string, AntProp> = {};
      parsePropertiesFile('key:value\n', 'test.properties', props);

      expect(props.key).toEqual(expect.objectContaining({ val: 'value' }));
    });

    it('skips malformed lines without separators', () => {
      const props: Record<string, AntProp> = {};
      parsePropertiesFile(
        'key=value\nmalformed_line_no_separator\nother=val\n',
        'test.properties',
        props,
      );

      expect(Object.keys(props)).toEqual(['key', 'other']);
    });

    it('implements first-definition-wins', () => {
      const props: Record<string, AntProp> = {};
      parsePropertiesFile('key=first\nkey=second\n', 'test.properties', props);

      expect(props.key.val).toBe('first');
    });

    it('respects pre-existing props (first-definition-wins across sources)', () => {
      const props: Record<string, AntProp> = {
        key: {
          val: 'existing',
          fileReplacePosition: 0,
          packageFile: 'build.xml',
        },
      };
      parsePropertiesFile('key=new\n', 'test.properties', props);

      expect(props.key.val).toBe('existing');
      expect(props.key.packageFile).toBe('build.xml');
    });
  });
});
