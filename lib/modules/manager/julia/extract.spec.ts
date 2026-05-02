import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile } from './extract.ts';

const projectToml = Fixtures.get('Project.toml');

describe('modules/manager/julia/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for unparseable TOML', () => {
      expect(extractPackageFile('not [ valid toml', 'Project.toml')).toBeNull();
    });

    it('returns null when there is no [compat] section', () => {
      const content = `name = "Foo"\nversion = "0.1.0"\n[deps]\nExample = "abc"\n`;
      expect(extractPackageFile(content, 'Project.toml')).toBeNull();
    });

    it('returns null when [compat] is empty after skipping julia', () => {
      const content = `name = "Foo"\n[compat]\njulia = "1.6"\n`;
      expect(extractPackageFile(content, 'Project.toml')).toBeNull();
    });

    it('skips non-string compat values defensively', () => {
      const content = `[compat]\nExample = ["0.5", "1"]\nJSON = "1"\n`;
      const res = extractPackageFile(content, 'Project.toml');
      expect(res?.deps).toEqual([
        {
          depName: 'JSON',
          depType: 'compat',
          currentValue: '1',
          datasource: 'julia-general-metadata',
          versioning: 'julia',
        },
      ]);
    });

    it('extracts compat entries with abbreviated UUIDs and the package version', () => {
      const res = extractPackageFile(projectToml, 'Project.toml');
      expect(res).toEqual({
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

    it('falls back to [extras] when a compat entry is not in [deps]', () => {
      const content = `
[deps]
Example = "7876af07-990d-54b4-ab0e-23690620f79a"

[extras]
Test = "8dfed614-e22c-5e08-85e1-65c5234f0b40"

[compat]
Example = "0.5"
Test = "1"
`;
      const res = extractPackageFile(content, 'Project.toml');
      expect(res?.deps).toEqual([
        expect.objectContaining({
          depName: 'Example',
          commitMessageTopic: 'Example [7876af07]',
        }),
        expect.objectContaining({
          depName: 'Test',
          commitMessageTopic: 'Test [8dfed614]',
        }),
      ]);
    });

    it('omits commitMessageTopic when no UUID can be found', () => {
      const content = `[compat]\nExample = "0.5"\n`;
      const res = extractPackageFile(content, 'Project.toml');
      expect(res?.deps?.[0]).not.toHaveProperty('commitMessageTopic');
    });

    it('omits commitMessageTopic when [deps] entry is malformed', () => {
      const content = `[deps]\nExample = "not-a-uuid"\n[compat]\nExample = "0.5"\n`;
      const res = extractPackageFile(content, 'Project.toml');
      expect(res?.deps?.[0]).not.toHaveProperty('commitMessageTopic');
    });

    it('omits packageFileVersion when none is declared', () => {
      const content = `[compat]\nExample = "0.5"\n`;
      const res = extractPackageFile(content, 'Project.toml');
      expect(res?.packageFileVersion).toBeUndefined();
      expect(res?.deps).toHaveLength(1);
    });
  });
});
