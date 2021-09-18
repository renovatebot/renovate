import { loadFixture } from '../../../test/util';
import type { ExtractConfig } from '../types';
import { extractPackageFile } from './extract';

const packageFile = 'setup.py';

const config: ExtractConfig = {};

describe('manager/pip_setup/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns found deps', () => {
      const content = loadFixture(packageFile);

      expect(
        extractPackageFile(content, packageFile, config)
      ).toMatchSnapshot();
    });
  });
});
