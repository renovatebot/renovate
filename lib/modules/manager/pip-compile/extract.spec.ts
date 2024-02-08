import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from './extract';

jest.mock('../../../util/fs');

describe('modules/manager/pip-compile/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns object for requirements.in', () => {
      const packageFile = extractPackageFile(
        Fixtures.get('requirementsWithHashes.txt'),
        'requirements.in',
        {},
      );
      expect(packageFile).toHaveProperty('deps');
      expect(packageFile?.deps[0]).toHaveProperty('depName', 'attrs');
    });

    it.each([
      'random.py',
      'app.cfg',
      'already_locked.txt',
      // TODO(not7cd)
      'pyproject.toml',
      'setup.py',
      'setup.cfg',
    ])('returns null on not supported package files', (file: string) => {
      expect(extractPackageFile('some content', file, {})).toBeNull();
    });
  });
});
