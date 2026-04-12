import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import { CachedMavenXml } from './schema.ts';

describe('modules/datasource/maven/schema', () => {
  it('trims release metadata to the fields used by Renovate', () => {
    const input = Fixtures.get('metadata.xml');

    expect(CachedMavenXml.parse(input)).toMatchInlineSnapshot(
      `
      "<?xml version="1.0" encoding="UTF-8"?>
      <metadata>
        <versioning>
          <latest>2.0.0</latest>
          <release>2.0.0</release>
          <versions>
            <version>0.0.1</version>
            <version>1.0.0</version>
            <version>1.0.1</version>
            <version>1.0.2</version>
            <version>1.0.3-SNAPSHOT</version>
            <version>1.0.4-SNAPSHOT</version>
            <version>1.0.5-SNAPSHOT</version>
            <version>2.0.0</version>
          </versions>
        </versioning>
      </metadata>"
      `,
    );
  });

  it('trims snapshot metadata to the fields used by Renovate', () => {
    const input = Fixtures.get('metadata-snapshot-version.xml');

    expect(CachedMavenXml.parse(input)).toMatchInlineSnapshot(
      `
      "<?xml version="1.0" encoding="UTF-8"?>
      <metadata>
        <version>1.0.3-SNAPSHOT</version>
        <versioning>
          <snapshot>
            <timestamp>20200101.010003</timestamp>
            <buildNumber>3</buildNumber>
          </snapshot>
        </versioning>
      </metadata>"
      `,
    );
  });

  it('trims pom files to the fields used by Renovate', () => {
    const input = codeBlock`
      <project>
        <groupId>org.example</groupId>
        <artifactId>package</artifactId>
        <name>Package Name</name>
        <description>Package description</description>
        <url>https://package.example.org/about</url>
        <scm>
          <url>scm:git:https://github.com/example/package</url>
        </scm>
        <distributionManagement>
          <relocation>
            <groupId>org.relocated</groupId>
            <artifactId>package-new</artifactId>
            <version>2.0.0</version>
            <message>Moved</message>
          </relocation>
        </distributionManagement>
        <parent>
          <groupId>org.parent</groupId>
          <artifactId>package-parent</artifactId>
          <version>1.2.3</version>
        </parent>
      </project>
    `;

    expect(CachedMavenXml.parse(input)).toMatchInlineSnapshot(
      `
      "<?xml version="1.0" encoding="UTF-8"?>
      <project>
        <groupId>org.example</groupId>
        <url>https://package.example.org/about</url>
        <scm>
          <url>scm:git:https://github.com/example/package</url>
        </scm>
        <distributionManagement>
          <relocation>
            <groupId>org.relocated</groupId>
            <artifactId>package-new</artifactId>
            <version>2.0.0</version>
            <message>Moved</message>
          </relocation>
        </distributionManagement>
        <parent>
          <groupId>org.parent</groupId>
          <artifactId>package-parent</artifactId>
          <version>1.2.3</version>
        </parent>
      </project>"
      `,
    );
  });

  it('preserves empty relocation tags', () => {
    const input = codeBlock`
      <project>
        <artifactId>package</artifactId>
        <name>Package Name</name>
        <distributionManagement>
          <relocation />
        </distributionManagement>
      </project>
    `;

    expect(CachedMavenXml.parse(input)).toMatchInlineSnapshot(`
      "<?xml version="1.0" encoding="UTF-8"?>
      <project>
        <distributionManagement>
          <relocation />
        </distributionManagement>
      </project>"
    `);
  });

  it('passes through unknown XML unchanged', () => {
    const input = '<root><value>test</value></root>';
    expect(CachedMavenXml.parse(input)).toBe(input);
  });

  it('passes through prefixed pom XML unchanged', () => {
    const input =
      '<m:project xmlns:m="http://maven.apache.org/POM/4.0.0"><m:url>https://package.example.org/about</m:url></m:project>';
    expect(CachedMavenXml.parse(input)).toBe(input);
  });

  it('passes through pom XML when no retained fields are present', () => {
    const input = '<project><artifactId>package</artifactId></project>';
    expect(CachedMavenXml.parse(input)).toBe(input);
  });

  it('passes through metadata XML when no retained fields are present', () => {
    const input = '<metadata><groupId>org.example</groupId></metadata>';
    expect(CachedMavenXml.parse(input)).toBe(input);
  });

  it('passes through invalid XML unchanged', () => {
    const input = '<project>';
    expect(CachedMavenXml.parse(input)).toBe(input);
  });
});
