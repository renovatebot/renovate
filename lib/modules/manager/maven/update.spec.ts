// TODO #22198
import { codeBlock } from 'common-tags';
import { XmlDocument } from 'xmldoc';
import { Fixtures } from '~test/fixtures.ts';
import { extractExtensions, extractPackage } from './extract.ts';
import { bumpPackageVersion, updateDependency } from './update.ts';

const simpleContent = Fixtures.get(`simple.pom.xml`);
const minimumContent = Fixtures.get(`minimum.pom.xml`);
const minimumSnapshotContent = Fixtures.get(`minimum_snapshot.pom.xml`);
const prereleaseContent = Fixtures.get(`prerelease.pom.xml`);
const cnbContent = Fixtures.get(`full_cnb.pom.xml`);
const simpleDep = extractPackage(simpleContent, 'pom.xml', {})!.deps[1];
const cnbDeps = extractPackage(cnbContent, 'pom.xml', {})!.deps;

describe('modules/manager/maven/update', () => {
  describe('updateDependency', () => {
    it('should update version', () => {
      const res = updateDependency({
        fileContent: simpleContent,
        packageFile: 'pom.xml',
        upgrade: {
          updateType: 'patch',
          depName: 'org.example:foo',
          currentValue: '0.0.1',
          managerData: simpleDep.managerData,
          newValue: '0.0.2',
        },
      });

      const project = new XmlDocument(res!);
      expect(
        project.valueWithPath(
          'dependencyManagement.dependencies.dependency.version',
        ),
      ).toBe('0.0.2');
    });

    it('should do simple replacement', () => {
      const res = updateDependency({
        fileContent: simpleContent,
        packageFile: 'pom.xml',
        upgrade: {
          updateType: 'replacement',
          depName: 'org.example:foo',
          currentValue: '0.0.1',
          managerData: simpleDep.managerData,
          newName: 'org.example.new:foo',
          newValue: '0.0.1',
        },
      });

      const project = new XmlDocument(res!);
      expect(
        project.valueWithPath(
          'dependencyManagement.dependencies.dependency.groupId',
        ),
      ).toBe('org.example.new');
    });

    it('should do full replacement', () => {
      const res = updateDependency({
        fileContent: simpleContent,
        packageFile: 'pom.xml',
        upgrade: {
          updateType: 'replacement',
          depName: 'org.example:foo',
          currentValue: '0.0.1',
          managerData: simpleDep.managerData,
          newName: 'org.example.new:bar',
          newValue: '0.0.2',
        },
      });

      const project = new XmlDocument(res!);
      expect(
        project.valueWithPath(
          'dependencyManagement.dependencies.dependency.groupId',
        ),
      ).toBe('org.example.new');
      expect(
        project.valueWithPath(
          'dependencyManagement.dependencies.dependency.artifactId',
        ),
      ).toBe('bar');
      expect(
        project.valueWithPath(
          'dependencyManagement.dependencies.dependency.version',
        ),
      ).toBe('0.0.2');
    });

    it('should do replacement if version is first', () => {
      const res = updateDependency({
        fileContent: codeBlock`
            <project xmlns="http://maven.apache.org/POM/4.0.0">
              <dependencyManagement>
                <dependencies>
                  <dependency>
                    <version>0.0.1</version>
                    <artifactId>foo</artifactId>
                    <groupId>org.example</groupId>
                  </dependency>
                </dependencies>
              </dependencyManagement>
            </project>
          `,
        packageFile: 'pom.xml',
        upgrade: {
          updateType: 'replacement',
          depName: 'org.example:foo',
          currentValue: '0.0.1',
          managerData: simpleDep.managerData,
          newName: 'org.example.new:bar',
          newValue: '0.0.1',
        },
      });

      const project = new XmlDocument(res!);
      expect(
        project.valueWithPath(
          'dependencyManagement.dependencies.dependency.groupId',
        ),
      ).toBe('org.example.new');
      expect(
        project.valueWithPath(
          'dependencyManagement.dependencies.dependency.artifactId',
        ),
      ).toBe('bar');
      expect(
        project.valueWithPath(
          'dependencyManagement.dependencies.dependency.version',
        ),
      ).toBe('0.0.1');
    });

    it('should ignore replacement if name does not match', () => {
      const res = updateDependency({
        fileContent: simpleContent,
        packageFile: 'pom.xml',
        upgrade: {
          updateType: 'replacement',
          depName: 'org.example.old:bar',
          currentValue: '0.0.1',
          managerData: simpleDep.managerData,
          newName: 'org.example:foo',
          newValue: '0.0.1',
        },
      });

      expect(res).toBe(simpleContent);
    });

    it('should update a cloud native buildpack version', () => {
      const res = updateDependency({
        fileContent: cnbContent,
        packageFile: 'pom.xml',
        upgrade: {
          datasource: 'docker',
          updateType: 'patch',
          depName: 'paketo-buildpacks/nodejs',
          currentValue: '6.1.1',
          managerData: cnbDeps.find((dep) => dep.fileReplacePosition === 1430)!
            .managerData,
          newValue: '6.1.2',
        },
      });

      const project = new XmlDocument(res!);
      expect(
        project.valueWithPath(
          'build.plugins.plugin.configuration.image.buildpacks.buildpack',
        ),
      ).toBe('paketo-buildpacks/nodejs@6.1.2');
    });

    it('should update a cloud native buildpack digest', () => {
      const res = updateDependency({
        fileContent: cnbContent,
        packageFile: 'pom.xml',
        upgrade: {
          updateType: 'patch',
          currentDigest:
            'sha256:2c27cd0b4482a4aa5aeb38104f6d934511cd87c1af34a10d1d6cdf2d9d16f138',
          currentValue: '2.22.1',
          newDigest:
            'sha256:ab0cf962a92158f15d9e4fed6f905d5d292ed06a8e6291aa1ce3c33a5c78bde1',
          newValue: '2.24.3',
          datasource: 'docker',
          depName: 'docker.io/paketobuildpacks/python',
          managerData: cnbDeps.find((dep) => dep.fileReplacePosition === 1634)!
            .managerData,
        },
      });

      const project = new XmlDocument(res!);
      const buildpacks = project
        .childNamed('build')!
        .childNamed('plugins')!
        .childNamed('plugin')!
        .childNamed('configuration')!
        .childNamed('image')!
        .childNamed('buildpacks')!
        .childrenNamed('buildpack');
      const buildpackWithDigest = [];
      for (const buildpack of buildpacks) {
        const buildpackValue = buildpack.val;
        if (buildpackValue.includes('docker://')) {
          buildpackWithDigest.push(buildpackValue.trim());
        }
      }
      expect(buildpackWithDigest).toEqual([
        'docker://docker.io/paketobuildpacks/python:2.24.3@sha256:ab0cf962a92158f15d9e4fed6f905d5d292ed06a8e6291aa1ce3c33a5c78bde1',
        'docker://docker.io/paketobuildpacks/ruby@sha256:080f4cfa5c8fe43837b2b83f69ae16e320ea67c051173e4934a015590b2ca67a',
      ]);
    });
  });

  describe('XML targets', () => {
    it('updates distinct duplicate dependencies and a parent before the project version', () => {
      const pom = codeBlock`
        <?xml version="1.0"?>
        <!-- keep this comment -->
        <project xmlns="http://maven.apache.org/POM/4.0.0">
          <parent><groupId>org.example</groupId><artifactId>parent</artifactId><version>9.9.9</version></parent>
          <version source="1.0.99">  1.0.99  </version>
          <dependencies>
            <dependency><groupId>org.example</groupId><artifactId>foo</artifactId><version>1.2.3</version></dependency>
            <!-- sibling ordinals ignore comments and whitespace -->
            <dependency><groupId>org.example</groupId><artifactId>foo</artifactId><version>1.2.3</version></dependency>
          </dependencies>
        </project>
      `;
      const content = `  \n${pom}`;
      const { deps } = extractPackage(content, 'pom.xml', {})!;
      const bumped = bumpPackageVersion(
        content,
        '1.0.99',
        'patch',
      ).bumpedContent!;
      const first = updateDependency({
        packageFile: 'pom.xml',
        fileContent: bumped,
        upgrade: {
          ...deps[1],
          newName: 'org.replaced:foo-new',
          newValue: '1.20.30',
        },
      })!;
      const second = updateDependency({
        packageFile: 'pom.xml',
        fileContent: first,
        upgrade: { ...deps[2], newValue: '1.2.4' },
      })!;
      const result = updateDependency({
        packageFile: 'pom.xml',
        fileContent: second,
        upgrade: { ...deps[0], newValue: '10.0.0' },
      });
      expect(result).toBe(
        content
          .replace('>9.9.9<', '>10.0.0<')
          .replace('>  1.0.99  <', '>  1.0.100  <')
          .replace(
            '<groupId>org.example</groupId><artifactId>foo</artifactId><version>1.2.3</version>',
            '<groupId>org.replaced</groupId><artifactId>foo-new</artifactId><version>1.20.30</version>',
          )
          .replace('>1.2.3<', '>1.2.4<'),
      );
    });

    it('updates an extension without a project version', () => {
      const content = codeBlock`
        <extensions xmlns="http://maven.apache.org/EXTENSIONS/1.0.0">
          <extension><groupId>org.example</groupId><artifactId>foo</artifactId><version>1.2.3</version></extension>
        </extensions>
      `;
      const { deps } = extractExtensions(content, '.mvn/extensions.xml')!;
      expect(
        updateDependency({
          fileContent: content,
          packageFile: '.mvn/extensions.xml',
          upgrade: { ...deps[0], newValue: '1.20.30' },
        }),
      ).toBe(content.replace('1.2.3', '1.20.30'));
    });

    it.each`
      path
      ${undefined}
      ${[]}
      ${[{ name: 'project', index: 1 }]}
      ${[{ name: 'project', index: 0 }, { name: 'missing', index: 0 }]}
    `('rejects a missing or unresolved target: $path', ({ path }) => {
      expect(
        updateDependency({
          fileContent: simpleContent,
          packageFile: 'pom.xml',
          upgrade: {
            ...simpleDep,
            newValue: '0.0.2',
            managerData: path ? { xmlPath: path } : undefined,
          },
        }),
      ).toBeNull();
    });

    it('rejects malformed XML', () => {
      expect(
        updateDependency({
          fileContent: 'invalid xml content',
          packageFile: 'pom.xml',
          upgrade: { ...simpleDep, newValue: '0.0.2' },
        }),
      ).toBeNull();
    });
  });

  describe('bumpPackageVersion', () => {
    it('bumps pom.xml version', () => {
      const { bumpedContent } = bumpPackageVersion(
        simpleContent,
        '0.0.1',
        'patch',
      );

      const project = new XmlDocument(bumpedContent!);
      expect(project.valueWithPath('version')).toBe('0.0.2');
    });

    it('bumps pom.xml version keeping SNAPSHOT', () => {
      const { bumpedContent } = bumpPackageVersion(
        minimumSnapshotContent,
        '0.0.1-SNAPSHOT',
        'patch',
      );

      const project = new XmlDocument(bumpedContent!);
      expect(project.valueWithPath('version')).toBe('0.0.2-SNAPSHOT');
    });

    it('bumps pom.xml minor version keeping SNAPSHOT', () => {
      const { bumpedContent } = bumpPackageVersion(
        minimumSnapshotContent,
        '0.0.1-SNAPSHOT',
        'minor',
      );

      const project = new XmlDocument(bumpedContent!);
      expect(project.valueWithPath('version')).toBe('0.1.0-SNAPSHOT');
    });

    it('bumps pom.xml major version keeping SNAPSHOT', () => {
      const { bumpedContent } = bumpPackageVersion(
        minimumSnapshotContent,
        '0.0.1-SNAPSHOT',
        'major',
      );

      const project = new XmlDocument(bumpedContent!);
      expect(project.valueWithPath('version')).toBe('1.0.0-SNAPSHOT');
    });

    it('bumps pom.xml version keeping qualifier with -SNAPSHOT', () => {
      const { bumpedContent } = bumpPackageVersion(
        minimumSnapshotContent.replace(
          '0.0.1-SNAPSHOT',
          '0.0.1-qualified-SNAPSHOT',
        ),
        '0.0.1-qualified-SNAPSHOT',
        'patch',
      );

      const project = new XmlDocument(bumpedContent!);
      expect(project.valueWithPath('version')).toBe('0.0.2-qualified-SNAPSHOT');
    });

    it('does not bump version twice across a version length change', () => {
      const content = codeBlock`
        <project><version source="1.0.99">  <!-- keep -->1.0.99  </version></project>
      `;
      const { bumpedContent } = bumpPackageVersion(content, '1.0.99', 'patch');
      const { bumpedContent: bumpedContent2 } = bumpPackageVersion(
        bumpedContent!,
        '1.0.99',
        'patch',
      );

      expect(bumpedContent).toBe(
        codeBlock`
          <project><version source="1.0.99">  <!-- keep -->1.0.100  </version></project>
        `,
      );
      expect(bumpedContent2).toBe(bumpedContent);
    });

    it('replaces the complete current version after a minor then patch bump', () => {
      const content = codeBlock`
        <project><version source="1.0.99">  <!-- keep -->1.0.99  </version></project>
      `;
      const first = bumpPackageVersion(content, '1.0.99', 'minor');
      expect(first.bumpedContent).toBe(
        content.replace('<!-- keep -->1.0.99', '<!-- keep -->1.1.0'),
      );

      const second = bumpPackageVersion(
        first.bumpedContent!,
        '1.0.99',
        'patch',
      );

      expect(second.bumpedContent).toBe(
        codeBlock`
          <project><version source="1.0.99">  <!-- keep -->1.0.100  </version></project>
        `,
      );
    });

    it('does not bump version if version is not a semantic version', () => {
      const { bumpedContent } = bumpPackageVersion(
        minimumContent,
        '1',
        'patch',
      );

      const project = new XmlDocument(bumpedContent!);
      expect(project.valueWithPath('version')).toBe('1');
    });

    it('does not bump version if pom.xml has no version', () => {
      const { bumpedContent } = bumpPackageVersion(minimumContent, '', 'patch');

      expect(bumpedContent).toEqual(minimumContent);
    });

    it('returns content if bumping errors', () => {
      const { bumpedContent } = bumpPackageVersion(
        simpleContent,
        '0.0.1',
        true as any,
      );
      expect(bumpedContent).toEqual(simpleContent);
    });

    it('bumps pom.xml version to SNAPSHOT with prerelease', () => {
      const { bumpedContent } = bumpPackageVersion(
        simpleContent,
        '0.0.1',
        'prerelease',
      );

      const project = new XmlDocument(bumpedContent!);
      expect(project.valueWithPath('version')).toBe('0.0.2-SNAPSHOT');
    });

    it('bumps pom.xml version with prerelease semver level', () => {
      const { bumpedContent } = bumpPackageVersion(
        prereleaseContent,
        '1.0.0-1',
        'prerelease',
      );

      const project = new XmlDocument(bumpedContent!);
      expect(project.valueWithPath('version')).toBe('1.0.0-2');
    });
  });
});
