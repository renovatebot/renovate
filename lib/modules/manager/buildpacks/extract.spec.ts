import { Fixtures } from '../../../../test/fixtures';

import { extractPackageFile } from '.';

describe('modules/manager/buildpacks/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid files', () => {
      expect(extractPackageFile('not a project toml', '', {})).toBeNull();
    });

    it('returns null for empty package.toml', () => {
      const res = extractPackageFile(
        Fixtures.get('empty_project.toml'),
        'project.toml',
        {},
      );
      expect(res).toBeNull();
    });

    it('extracts builder and buildpack images', () => {
      const res = extractPackageFile(
        Fixtures.get('project.toml'),
        'project.toml',
        {},
      );
      expect(res?.deps).toHaveLength(3);
      expect(res?.deps).toMatchSnapshot();
    });
  });
});
