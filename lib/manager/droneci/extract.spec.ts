import { readFileSync } from 'fs';
import { resolve } from 'path';

import { extractPackageFile } from './extract';

const droneYAML = readFileSync(
  resolve('lib/manager/droneci/__fixtures__/.drone.yml'),
  'utf8'
);

describe('lib/manager/droneci/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile({ fileContent: 'nothing here' })).toBeNull();
    });

    it('extracts multiple image lines', () => {
      const res = extractPackageFile({ fileContent: droneYAML });
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(4);
    });
  });
});
