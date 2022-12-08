import { mocked } from '../../../../test/util';
import * as _regex from './regex';
import { extractPackageFile } from '.';

jest.mock('./regex');
const regex = mocked(_regex);

describe('modules/manager/custom/index', () => {
  describe('extractPackageFile()', () => {
    it('returns null', () => {
      expect(
        extractPackageFile('', 'filename', { customType: 'dummy' })
      ).toBeNull();
    });

    it('returns non-null', () => {
      regex.extractPackageFile.mockReturnValue({ deps: [] });
      expect(extractPackageFile('', 'filename', {})).not.toBeNull();
    });
  });
});
