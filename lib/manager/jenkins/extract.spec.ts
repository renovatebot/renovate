import { readFileSync } from 'fs';
import { getName } from '../../../test/util';
import { extractPackageFile } from './extract';

const pluginsFile = readFileSync(
  'lib/manager/jenkins/__fixtures__/plugins.txt',
  'utf8'
);

const pluginsEmptyFile = readFileSync(
  'lib/manager/jenkins/__fixtures__/empty.txt',
  'utf8'
);

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    it('returns empty list for an empty file', () => {
      const res = extractPackageFile(pluginsEmptyFile, 'plugins.txt', {
        ignoreComments: ['[renovate-ignore]', '[ignore-renovate]'],
      });
      expect(res.deps).toHaveLength(0);
    });

    it('extracts multiple image lines', () => {
      const res = extractPackageFile(pluginsFile, 'plugins.txt', {
        ignoreComments: ['[renovate-ignore]', '[ignore-renovate]'],
      });
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(4);
    });

    it('extracts multiple image lines, with different ignoreComments', () => {
      const res = extractPackageFile(pluginsFile, 'plugins.txt', {
        ignoreComments: ['[renovate-ignore]'],
      });
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(5);
    });

    it('extracts multiple image lines, when ignoreComments is empty', () => {
      const res = extractPackageFile(pluginsFile, 'plugins.txt', {
        ignoreComments: [],
      });
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(6);
    });
  });
});
