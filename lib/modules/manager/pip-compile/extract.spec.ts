import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from './extract';

describe('modules/manager/pip-compile/extract', () => {
  beforeEach(() => {});

  describe('extractHeaderCommand()', () => {
    it('returns object for requirements.in', () => {
      expect(
        extractPackageFile(
          Fixtures.get('requirementsWithHashes.txt'),
          'requirements.in',
          {},
        ),
      ).toBeObject();
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
