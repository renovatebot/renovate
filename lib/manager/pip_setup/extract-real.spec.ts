import { getName } from '../../../test/util';
import { extractSetupFile } from './extract';

describe(getName(__filename), () => {
  describe('extractSetupFile()', () => {
    it('can parse a setup.py importing stuff from its own package', async () => {
      const pkgInfo = await extractSetupFile(
        '',
        'lib/manager/pip_setup/__fixtures__/setup-3.py',
        {}
      );
      expect(pkgInfo.version).toEqual('1.0');
    });
  });
});
