import { codeBlock } from 'common-tags';
import { extractPackageFile } from './extract.ts';

describe('modules/manager/kotlin-toolchain/catalog', () => {
  it('extracts libraries and shared versions without Gradle plugins', () => {
    const content = codeBlock`
      [versions]
      shared-version = "1.0.0"

      [libraries]
      first = { module = "org.example:first", version.ref = "shared-version" }
      second = { group = "org.example", name = "second", version.ref = "shared-version" }
      inline = { module = "org.example:inline", version = "2.0.0" }
      simple = "org.example:simple:3.0.0"
      managed = { module = "org.example:managed" }

      [plugins]
      ignored = { id = "org.example.plugin", version = "4.0.0" }

      [bundles]
      ignored = ["first", "second"]
    `;

    const res = extractPackageFile(content, 'libs.versions.toml');

    expect(res?.deps).toHaveLength(5);
    expect(res?.deps).toMatchObject([
      {
        depName: 'org.example:first',
        currentValue: '1.0.0',
        sharedVariableName: 'shared.version',
        datasource: 'maven',
        depType: 'versionCatalog',
        replaceString: 'shared-version = "1.0.0"',
        managerData: {
          libraryAlias: 'first',
          replacePrefix: 'shared-version = "',
          replaceSuffix: '"',
        },
      },
      {
        depName: 'org.example:second',
        currentValue: '1.0.0',
        sharedVariableName: 'shared.version',
        managerData: { libraryAlias: 'second' },
      },
      { depName: 'org.example:inline', currentValue: '2.0.0' },
      { depName: 'org.example:simple', currentValue: '3.0.0' },
      { depName: 'managed', skipReason: 'unspecified-version' },
    ]);
    expect(res?.deps[0].managerData?.fileReplacePosition).toEqual(
      res?.deps[1].managerData?.fileReplacePosition,
    );
  });

  it('skips rich versions that Kotlin Toolchain does not support', () => {
    const content = codeBlock`
      [versions]
      strict = { strictly = "1.0.0" }

      [libraries]
      inline = { module = "org.example:inline", version = { require = "2.0.0" } }
      reference = { module = "org.example:reference", version.ref = "strict" }
      missing = { module = "org.example:missing", version.ref = "absent" }
    `;

    const res = extractPackageFile(content, 'libs.versions.toml');

    expect(res?.deps).toMatchObject([
      { depName: 'inline', skipReason: 'unsupported-version' },
      { depName: 'reference', skipReason: 'unsupported-version' },
      { depName: 'missing', skipReason: 'unspecified-version' },
    ]);
  });

  it('does not update numeric catalog versions', () => {
    const content =
      '[libraries]\nlib = { module = "org.example:lib", version = 10 }';

    const res = extractPackageFile(content, 'libs.versions.toml');

    expect(res?.deps[0]).toMatchObject({
      depName: 'lib',
      skipReason: 'unspecified-version',
    });
    expect(res?.deps[0]).not.toHaveProperty('replaceString');
  });

  it('skips a decoded version that cannot be located in the source', () => {
    const content =
      '[libraries]\nlib = { module = "org.example:lib", version = "1.\\u0030" }';

    const res = extractPackageFile(content, 'libs.versions.toml');

    expect(res?.deps[0].skipReason).toBe('invalid-value');
  });

  it.each(['', '[plugins]\nignored = "org.example.plugin:1.0.0"'])(
    'handles a catalog without libraries: %s',
    (content) => {
      expect(extractPackageFile(content, 'libs.versions.toml')).toEqual({
        deps: [],
      });
    },
  );

  it.each([
    '[libraries',
    '[libraries]\ninvalid = { module = false, version = "1.0.0" }',
  ])('returns null for an invalid catalog: %s', (content) => {
    expect(extractPackageFile(content, 'libs.versions.toml')).toBeNull();
  });
});
