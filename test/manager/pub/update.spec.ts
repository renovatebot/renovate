import { readFileSync } from 'fs';
import { updateDependency } from '../../../lib/manager/pub';

const fileContent = readFileSync(
  'test/manager/pub/_fixtures/update.yaml',
  'utf8'
);

describe('manager/pub/update', () => {
  describe('updateDependency', () => {
    it('returns content untouched if versions are same', () => {
      const upgrade = {
        depName: 'foo',
        currentValue: '1',
        newValue: '1',
        depType: 'dependencies',
      };
      const res = updateDependency(fileContent, upgrade);
      expect(res).toEqual(fileContent);
    });
    it('returns null if content was updated', () => {
      expect(
        updateDependency(fileContent, {
          depName: 'test',
          currentValue: '0.0.1',
          newValue: '1',
          depType: 'dev_dependencies',
        })
      ).toBe(null);
      expect(
        updateDependency(fileContent, {
          depName: 'build',
          currentValue: '0.0.1',
          newValue: '1',
          depType: 'dev_dependencies',
        })
      ).toBe(null);
    });
    it('replaces one-line value', () => {
      const upgrade = {
        depName: 'foo',
        currentValue: '1',
        newValue: '1.2.3',
        depType: 'dependencies',
      };
      const res = updateDependency(fileContent, upgrade);
      expect(res).not.toEqual(fileContent);
      expect(res.includes(upgrade.newValue)).toBe(true);
      expect(res).toMatchSnapshot();
    });
    it('replaces nested value', () => {
      const upgrade = {
        depName: 'bar',
        currentValue: '1',
        newValue: '1.2.3',
        depType: 'dependencies',
      };
      const res = updateDependency(fileContent, upgrade);
      expect(res).not.toEqual(fileContent);
      expect(res.includes(upgrade.newValue)).toBe(true);
      expect(res).toMatchSnapshot();
    });
  });
});
