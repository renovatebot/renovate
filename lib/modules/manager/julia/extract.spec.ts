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

    it('extracts compat entries and the package version', () => {
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
          },
          {
            depName: 'JSON',
            depType: 'compat',
            currentValue: '0.21, 1',
            datasource: 'julia-general-metadata',
            versioning: 'julia',
          },
        ],
      });
    });

    it('omits packageFileVersion when none is declared', () => {
      const content = `[compat]\nExample = "0.5"\n`;
      const res = extractPackageFile(content, 'Project.toml');
      expect(res?.packageFileVersion).toBeUndefined();
      expect(res?.deps).toHaveLength(1);
    });
  });
});
