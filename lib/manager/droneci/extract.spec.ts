import { readFileSync } from 'fs';
import { resolve } from 'path';

import { extractPackageFile } from './extract';

const droneYAML = readFileSync(
  resolve('lib/manager/droneci/_fixtures/.drone.yml'),
  'utf8'
);

describe('lib/manager/droneci/extract', () => {
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
