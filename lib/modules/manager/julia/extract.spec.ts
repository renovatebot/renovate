import { codeBlock } from 'common-tags';
import { extractPackageFile } from './extract.ts';

describe('modules/manager/julia/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid TOML', () => {
      expect(extractPackageFile('not [ valid toml', 'Project.toml')).toBeNull();
    });

    it('returns null without a [compat] section', () => {
      const content = codeBlock`
        name = "Foo"

        [deps]
        Example = "7876af07-990d-54b4-ab0e-23690620f79a"
      `;

      expect(extractPackageFile(content, 'Project.toml')).toBeNull();
    });

    it('returns null when [compat] has only the julia entry', () => {
      const content = codeBlock`
        [compat]
        julia = "1.6"
      `;

      expect(extractPackageFile(content, 'Project.toml')).toBeNull();
    });

    it('extracts compat entries with UUIDs and the package version', () => {
      const content = codeBlock`
        name = "Sample"
        version = "0.1.0"

        [deps]
        Example = "7876af07-990d-54b4-ab0e-23690620f79a"
        JSON = "682c06a0-de6a-54ab-a142-c8b1cf79cde6"

        [compat]
        Example = "0.5"
        JSON = "0.21, 1"
        julia = "1.6"
      `;

      expect(extractPackageFile(content, 'Project.toml')).toEqual({
        packageFileVersion: '0.1.0',
        deps: [
          {
            depName: 'Example',
            depType: 'deps',
            currentValue: '0.5',
            datasource: 'julia-general-metadata',
            packageName: 'Example=7876af07-990d-54b4-ab0e-23690620f79a',
          },
          {
            depName: 'JSON',
            depType: 'deps',
            currentValue: '0.21, 1',
            datasource: 'julia-general-metadata',
            packageName: 'JSON=682c06a0-de6a-54ab-a142-c8b1cf79cde6',
          },
        ],
      });
    });

    it('takes UUIDs and the depType from [weakdeps] and [extras] too', () => {
      const content = codeBlock`
        [weakdeps]
        JSON = "682c06a0-de6a-54ab-a142-c8b1cf79cde6"

        [extras]
        Aqua = "4c88cf16-eb10-579e-8560-4a9242c79595"

        [compat]
        JSON = "1"
        Aqua = "0.8"
      `;

      expect(extractPackageFile(content, 'Project.toml')?.deps).toMatchObject([
        {
          depName: 'JSON',
          depType: 'weakdeps',
          packageName: 'JSON=682c06a0-de6a-54ab-a142-c8b1cf79cde6',
        },
        {
          depName: 'Aqua',
          depType: 'extras',
          packageName: 'Aqua=4c88cf16-eb10-579e-8560-4a9242c79595',
        },
      ]);
    });

    it('skips standard libraries that General does not register', () => {
      const content = codeBlock`
        [compat]
        LinearAlgebra = "1"
        Statistics = "1"
      `;

      expect(extractPackageFile(content, 'Project.toml')?.deps).toEqual([
        {
          depName: 'LinearAlgebra',
          depType: 'compat',
          currentValue: '1',
          datasource: 'julia-general-metadata',
          skipReason: 'unsupported',
        },
        {
          depName: 'Statistics',
          depType: 'compat',
          currentValue: '1',
          datasource: 'julia-general-metadata',
        },
      ]);
    });

    it('omits the UUID when it is malformed', () => {
      const content = codeBlock`
        [deps]
        Example = "not-a-uuid"

        [compat]
        Example = "0.5"
      `;

      const dep = extractPackageFile(content, 'Project.toml')?.deps[0];
      expect(dep).toMatchObject({ depName: 'Example', depType: 'deps' });
      expect(dep).not.toHaveProperty('packageName');
    });

    it('takes the depType of an [extras] package from [targets]', () => {
      const content = codeBlock`
        [extras]
        Aqua = "4c88cf16-eb10-579e-8560-4a9242c79595"
        Conda = "8f4d0f93-b110-5947-807f-2305c1781a2d"
        JSON = "682c06a0-de6a-54ab-a142-c8b1cf79cde6"
        Example = "7876af07-990d-54b4-ab0e-23690620f79a"

        [targets]
        test = ["Aqua", "JSON"]
        build = ["Conda", "JSON"]

        [compat]
        Aqua = "0.8"
        Conda = "1"
        JSON = "1"
        Example = "0.5"
      `;

      expect(extractPackageFile(content, 'Project.toml')?.deps).toMatchObject([
        { depName: 'Aqua', depType: 'test' },
        { depName: 'Conda', depType: 'build' },
        { depName: 'JSON', depType: 'test' },
        { depName: 'Example', depType: 'extras' },
      ]);
    });

    it('takes the depType from [deps] for a package also in [extras]', () => {
      const content = codeBlock`
        [deps]
        Example = "7876af07-990d-54b4-ab0e-23690620f79a"

        [extras]
        Example = "7876af07-990d-54b4-ab0e-23690620f79a"

        [compat]
        Example = "0.5"
      `;

      expect(extractPackageFile(content, 'Project.toml')?.deps).toMatchObject([
        { depName: 'Example', depType: 'deps' },
      ]);
    });

    it('keeps the dependencies when the package version is not a string', () => {
      const content = codeBlock`
        version = 1

        [deps]
        Example = "7876af07-990d-54b4-ab0e-23690620f79a"

        [compat]
        Example = "0.5"
      `;

      expect(extractPackageFile(content, 'Project.toml')).toEqual({
        deps: [
          {
            depName: 'Example',
            depType: 'deps',
            currentValue: '0.5',
            datasource: 'julia-general-metadata',
            packageName: 'Example=7876af07-990d-54b4-ab0e-23690620f79a',
          },
        ],
      });
    });

    it('skips packages that [sources] takes from git or a path', () => {
      const content = codeBlock`
        [deps]
        Example = "7876af07-990d-54b4-ab0e-23690620f79a"
        JSON = "682c06a0-de6a-54ab-a142-c8b1cf79cde6"
        Sample = "c2b9a2c5-1a5e-4f8f-9e57-8b5e8a6f2a3d"

        [sources]
        Example = {url = "https://github.com/JuliaLang/Example.jl", rev = "master"}
        JSON = {path = "../JSON"}
        Sample = {rev = "main"}

        [compat]
        Example = "0.5"
        JSON = "1"
        Sample = "0.1"
      `;

      expect(extractPackageFile(content, 'Project.toml')?.deps).toMatchObject([
        { depName: 'Example', skipReason: 'git-dependency' },
        { depName: 'JSON', skipReason: 'path-dependency' },
        { depName: 'Sample' },
      ]);
      expect(
        extractPackageFile(content, 'Project.toml')?.deps[2],
      ).not.toHaveProperty('skipReason');
    });

    it('ignores a malformed [sources] section', () => {
      const content = codeBlock`
        sources = "Example"

        [compat]
        Example = "0.5"
      `;

      expect(extractPackageFile(content, 'Project.toml')?.deps).toEqual([
        {
          depName: 'Example',
          depType: 'compat',
          currentValue: '0.5',
          datasource: 'julia-general-metadata',
        },
      ]);
    });

    it('drops compat values that are not strings', () => {
      const content = codeBlock`
        [compat]
        Example = ["0.5", "1"]
        JSON = "1"
      `;

      expect(extractPackageFile(content, 'Project.toml')).toEqual({
        deps: [
          {
            depName: 'JSON',
            depType: 'compat',
            currentValue: '1',
            datasource: 'julia-general-metadata',
          },
        ],
      });
    });
  });
});
