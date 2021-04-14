import { readFileSync } from 'fs';
import { resolve } from 'upath';
import { getName } from '../../../test/util';

import { extractPackageFile } from './extract';

const droneYAML = readFileSync(
  resolve('lib/manager/droneci/__fixtures__/.drone.yml'),
  'utf8'
);

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts multiple image lines', () => {
      const res = extractPackageFile(droneYAML);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(4);
    });
  });
});
