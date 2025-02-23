import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

jest.mock('../../../util/fs');

const pyprojectToml = Fixtures.get('pyproject.toml');
const pixiToml = Fixtures.get('pixi.toml');
const pyprojectWithoutPixi = Fixtures.get('pyproject_no_pixi.toml');

describe('modules/manager/pixi/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty pyproject.toml', async () => {
      expect(
        await extractPackageFile('nothing here', 'pyproject.toml'),
      ).toBeNull();
    });

    it('returns null for empty pixi.toml', async () => {
      expect(await extractPackageFile('nothing here', 'pixi.toml')).toBeNull();
    });

    it('returns null for parsed file without pixi section', async () => {
      expect(
        await extractPackageFile(pyprojectWithoutPixi, 'pyproject.toml'),
      ).toBeNull();
    });

    it('returns parse pixi.toml', async () => {
      expect(await extractPackageFile(pixiToml, 'pixi.toml')).toMatchObject({
        deps: [],
        fileFormat: 'toml',
        lockFiles: [],
      });
    });

    it('returns parse pixi section from pyproject.toml', async () => {
      expect(
        await extractPackageFile(pyprojectToml, 'pyproject.toml'),
      ).toMatchObject({
        deps: [],
        fileFormat: 'toml',
        lockFiles: [],
      });
    });
  });
});
