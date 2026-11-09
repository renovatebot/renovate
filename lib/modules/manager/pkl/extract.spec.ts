import { codeBlock } from 'common-tags';
import { extractPackageFile } from './extract.ts';

describe('modules/manager/pkl/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts a GitHub release package from an amends clause', () => {
      const content = codeBlock`
        amends "package://github.com/jdx/hk/releases/download/v1.48.0/hk@1.48.0#/Config.pkl"
      `;

      const result = extractPackageFile(content);

      expect(result).toEqual({
        deps: [
          {
            datasource: 'github-releases',
            versioning: 'semver',
            depName: 'hk',
            packageName: 'jdx/hk',
            currentValue: '1.48.0',
            extractVersion: '^v(?<version>.+)$',
            replaceString:
              'package://github.com/jdx/hk/releases/download/v1.48.0/hk@1.48.0#/Config.pkl',
          },
        ],
      });
    });

    const hkUri =
      'package://github.com/jdx/hk/releases/download/v1.48.0/hk@1.48.0#/Builtins.pkl';

    it.each`
      form                  | content
      ${'extends'}          | ${`extends "${hkUri}"`}
      ${'import'}           | ${`import "${hkUri}"`}
      ${'import as'}        | ${`import "${hkUri}" as builtins`}
      ${'import*'}          | ${`import* "${hkUri}"`}
      ${'import()'}         | ${`local builtins = import("${hkUri}")`}
      ${'import*()'}        | ${`local all = import*( "${hkUri}" )`}
      ${'nested in object'} | ${`hooks { ["check"] = import("${hkUri}").check }`}
    `('extracts a package URI from the $form form', ({ content }) => {
      const result = extractPackageFile(content);

      expect(result?.deps).toMatchObject([
        { depName: 'hk', currentValue: '1.48.0', replaceString: hkUri },
      ]);
    });

    it('maps a registry package under a GitHub path to that repository', () => {
      const content = codeBlock`
        import "package://pkg.pkl-lang.org/github.com/jdx/hk/hk@1.58.1#/Builtins.pkl"
      `;

      const result = extractPackageFile(content);

      expect(result?.deps).toEqual([
        {
          datasource: 'github-releases',
          versioning: 'semver',
          depName: 'hk',
          packageName: 'jdx/hk',
          currentValue: '1.58.1',
          extractVersion: '^hk@(?<version>.+)$',
          replaceString:
            'package://pkg.pkl-lang.org/github.com/jdx/hk/hk@1.58.1#/Builtins.pkl',
        },
      ]);
    });

    it('maps a bare registry package to the Apple repository of its project', () => {
      const content = codeBlock`
        import "package://pkg.pkl-lang.org/pkl-pantry/pkl.toml@1.0.3#/toml.pkl"
      `;

      const result = extractPackageFile(content);

      expect(result?.deps).toEqual([
        {
          datasource: 'github-releases',
          versioning: 'semver',
          depName: 'pkl.toml',
          packageName: 'apple/pkl-pantry',
          currentValue: '1.0.3',
          extractVersion: '^pkl\\.toml@(?<version>.+)$',
          replaceString:
            'package://pkg.pkl-lang.org/pkl-pantry/pkl.toml@1.0.3#/toml.pkl',
        },
      ]);
    });

    it.each`
      reason                          | uri                                                                 | depName
      ${'an unknown host'}            | ${'package://example.com/pkl/lib@1.0.0#/Lib.pkl'}                   | ${'example.com/pkl/lib'}
      ${'a non-release GitHub path'}  | ${'package://github.com/jdx/hk/archive/hk@1.0.0#/Config.pkl'}       | ${'github.com/jdx/hk/archive/hk'}
      ${'a registry repository path'} | ${'package://pkg.pkl-lang.org/github.com/jdx/hk@1.0.0#/Config.pkl'} | ${'pkg.pkl-lang.org/github.com/jdx/hk'}
    `(
      'skips a package URI with $reason as unsupported-url',
      ({ uri, depName }) => {
        const content = `import "${uri}"`;

        const result = extractPackageFile(content);

        expect(result?.deps).toEqual([
          { depName, currentValue: '1.0.0', skipReason: 'unsupported-url' },
        ]);
      },
    );

    it('skips a package URI pinned with a checksum as unsupported', () => {
      const content = codeBlock`
        amends "package://github.com/jdx/hk/releases/download/v1.0.0/hk@1.0.0::sha256:0123456789abcdef#/Config.pkl"
      `;

      const result = extractPackageFile(content);

      expect(result?.deps).toEqual([
        { depName: 'hk', currentValue: '1.0.0', skipReason: 'unsupported' },
      ]);
    });

    it('skips a package URI whose release tag does not contain the version as unsupported-version', () => {
      const content = codeBlock`
        amends "package://github.com/jdx/hk/releases/download/latest/hk@1.0.0#/Config.pkl"
      `;

      const result = extractPackageFile(content);

      expect(result?.deps).toEqual([
        {
          depName: 'hk',
          currentValue: '1.0.0',
          skipReason: 'unsupported-version',
        },
      ]);
    });

    it('extracts every package URI from a real hk.pkl with comment markers inside strings', () => {
      // excerpt of jdx/mise hk.pkl
      const content = codeBlock`
        amends "package://github.com/jdx/hk/releases/download/v2.0.0/hk@2.0.0#/Config.pkl"
        local bash_exclude = List("*.ps1", "**/*.fish", "*.ts", "**/.*", "**/*.py")
        import "package://github.com/jdx/hk/releases/download/v2.0.0/hk@2.0.0#/Builtins.pkl"
      `;

      const result = extractPackageFile(content);

      expect(result?.deps).toMatchObject([
        { depName: 'hk', packageName: 'jdx/hk', currentValue: '2.0.0' },
        { depName: 'hk', packageName: 'jdx/hk', currentValue: '2.0.0' },
      ]);
    });

    it('extracts a registry package from a real Secrets.pkl', () => {
      // excerpt of element-hq/element-x-ios Components/Secrets/Secrets.pkl
      const content = codeBlock`
        import "package://pkg.pkl-lang.org/github.com/element-hq/pkl-tools/staticcode@1.1.0#/StaticCode.pkl"
      `;

      const result = extractPackageFile(content);

      expect(result?.deps).toMatchObject([
        {
          depName: 'staticcode',
          packageName: 'element-hq/pkl-tools',
          currentValue: '1.1.0',
          extractVersion: '^staticcode@(?<version>.+)$',
        },
      ]);
    });

    it('ignores a package URI without a version', () => {
      const content = codeBlock`
        import "package://github.com/jdx/hk/releases/download/v1.0.0/hk#/Config.pkl"
      `;

      const result = extractPackageFile(content);

      expect(result).toBeNull();
    });

    it('ignores package URIs in line, doc and block comments', () => {
      const content = codeBlock`
        // amends "package://github.com/jdx/hk/releases/download/v1.1.0/hk@1.1.0#/Config.pkl"
        /// import "package://github.com/jdx/hk/releases/download/v1.2.0/hk@1.2.0#/Config.pkl"
        /*
        import "package://github.com/jdx/hk/releases/download/v1.3.0/hk@1.3.0#/Config.pkl"
        */
        import "${hkUri}" // trailing comment
      `;

      const result = extractPackageFile(content);

      expect(result?.deps).toMatchObject([{ currentValue: '1.48.0' }]);
    });

    it('returns null for a module without package URIs', () => {
      const content = codeBlock`
        amends "pkl:Project"
        import "../shared/Base.pkl"
        import "modulepath:/com/example/Lib.pkl"
        import "https://example.com/Lib.pkl"
        import "projectpackage://example.com/lib@1.0.0#/Lib.pkl"
        name = "package://github.com/jdx/hk/releases/download/v1.0.0/hk@1.0.0"
      `;

      const result = extractPackageFile(content);

      expect(result).toBeNull();
    });
  });
});
