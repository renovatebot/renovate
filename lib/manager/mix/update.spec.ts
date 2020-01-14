import fs from 'fs-extra';
import path from 'path';
import { updateDependency } from '.';

const sample = fs.readFileSync(
  path.resolve(__dirname, './__fixtures__/mix.exs'),
  'utf-8'
);

describe('lib/manager/mix/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const updateOptions = {
        depName: 'postgrex',
        managerData: { lineNumber: 18 },
        newValue: '~> 0.8.2',
      };
      const res = updateDependency({ fileContent: sample, updateOptions });
      expect(res).not.toEqual(sample);
      expect(res.includes(updateOptions.newValue)).toBe(true);
    });
    it('return the same', () => {
      const updateOptions = {
        depName: 'postgrex',
        managerData: { lineNumber: 18 },
        newValue: '~> 0.8.1',
      };
      const res = updateDependency({ fileContent: sample, updateOptions });
      expect(res).toEqual(sample);
    });
    it('returns null if wrong line', () => {
      const updateOptions = {
        depName: 'postgrex',
        managerData: { lineNumber: 19 },
        newValue: '~> 0.8.2',
      };
      const res = updateDependency({ fileContent: sample, updateOptions });
      expect(res).toBeNull();
    });
    it('returns null for unsupported depType', () => {
      const updateOptions = {
        depName: 'cowboy',
        managerData: { lineNumber: 19 },
        newValue: '~> 0.8.2',
      };
      const res = updateDependency({ fileContent: sample, updateOptions });
      expect(res).toBeNull();
    });
  });
});
