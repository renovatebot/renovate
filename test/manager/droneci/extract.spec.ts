import { readFileSync } from 'fs';
import { resolve } from 'path';

const { extractPackageFile } = require('../../../lib/manager/droneci/extract');

const droneYAML = readFileSync(
  resolve('test/manager/droneci/_fixtures/.drone.yml'),
  'utf8'
);

describe('lib/manager/droneci/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile({ content: 'nothing here' })).toBeNull();
    });

    it('extracts multiple image lines', () => {
      const res = extractPackageFile({ content: droneYAML });
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(4);
    });
  });
});
