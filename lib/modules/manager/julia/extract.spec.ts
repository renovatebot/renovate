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

    it('extracts compat entries with abbreviated UUIDs and the package version', () => {
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
            depType: 'compat',
            currentValue: '0.5',
            datasource: 'julia-general-metadata',
            versioning: 'julia',
            commitMessageTopic: 'Example [7876af07]',
          },
          {
            depName: 'JSON',
            depType: 'compat',
            currentValue: '0.21, 1',
            datasource: 'julia-general-metadata',
            versioning: 'julia',
            commitMessageTopic: 'JSON [682c06a0]',
          },
        ],
      });
    });

    it('takes UUIDs from [weakdeps] and [extras] too', () => {
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
        { depName: 'JSON', commitMessageTopic: 'JSON [682c06a0]' },
        { depName: 'Aqua', commitMessageTopic: 'Aqua [4c88cf16]' },
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
          versioning: 'julia',
          skipReason: 'unsupported',
        },
        {
          depName: 'Statistics',
          depType: 'compat',
          currentValue: '1',
          datasource: 'julia-general-metadata',
          versioning: 'julia',
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

      expect(
        extractPackageFile(content, 'Project.toml')?.deps[0],
      ).not.toHaveProperty('commitMessageTopic');
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
            versioning: 'julia',
          },
        ],
      });
    });
  });
});
