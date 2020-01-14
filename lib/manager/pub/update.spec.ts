import { readFileSync } from 'fs';
import { updateDependency } from '.';

const fileContent = readFileSync(
  'lib/manager/pub/__fixtures__/update.yaml',
  'utf8'
);

describe('manager/pub/update', () => {
  describe('updateDependency', () => {
    it('returns content untouched if versions are same', () => {
      const updateOptions = {
        depName: 'foo',
        currentValue: '1',
        newValue: '1',
        depType: 'dependencies',
      };
      const res = updateDependency({ fileContent, updateOptions });
      expect(res).toEqual(fileContent);
    });
    it('returns null if content was updated', () => {
      expect(
        updateDependency({
          fileContent,
          updateOptions: {
            depName: 'test',
            currentValue: '0.0.1',
            newValue: '1',
            depType: 'dev_dependencies',
          },
        })
      ).toBe(null);
      expect(
        updateDependency({
          fileContent,
          updateOptions: {
            depName: 'build',
            currentValue: '0.0.1',
            newValue: '1',
            depType: 'dev_dependencies',
          },
        })
      ).toBe(null);
    });
    it('replaces one-line value', () => {
      const updateOptions = {
        depName: 'foo',
        currentValue: '1',
        newValue: '1.2.3',
        depType: 'dependencies',
      };
      const res = updateDependency({ fileContent, updateOptions });
      expect(res).not.toEqual(fileContent);
      expect(res.includes(updateOptions.newValue)).toBe(true);
      expect(res).toMatchSnapshot();
    });
    it('replaces nested value', () => {
      const updateOptions = {
        depName: 'bar',
        currentValue: '1',
        newValue: '1.2.3',
        depType: 'dependencies',
      };
      const res = updateDependency({ fileContent, updateOptions });
      expect(res).not.toEqual(fileContent);
      expect(res.includes(updateOptions.newValue)).toBe(true);
      expect(res).toMatchSnapshot();
    });
  });
});
