import { readFileSync } from 'fs';
import { updateDependency } from './update';

const pipeline1 = readFileSync(
  'lib/manager/buildkite/__fixtures__/pipeline1.yml',
  'utf8'
);
const pipeline2 = readFileSync(
  'lib/manager/buildkite/__fixtures__/pipeline2.yml',
  'utf8'
);
const pipeline4 = readFileSync(
  'lib/manager/buildkite/__fixtures__/pipeline4.yml',
  'utf8'
);

describe('manager/buildkite/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        managerData: { lineNumber: 3 },
        newValue: 'v2.2.0',
      };
      const res = updateDependency({ fileContent: pipeline1, upgrade });
      expect(res).not.toEqual(pipeline1);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('replaces arrays', () => {
      const upgrade = {
        managerData: { lineNumber: 11 },
        newValue: 'v2.2.0',
      };
      const res = updateDependency({ fileContent: pipeline4, upgrade });
      expect(res).not.toEqual(pipeline4);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('replaces two values in one file', () => {
      const upgrade1 = {
        managerData: { lineNumber: 5 },
        newValue: 'v1.5.0',
      };
      const res1 = updateDependency({
        fileContent: pipeline2,
        upgrade: upgrade1,
      });
      expect(res1).not.toEqual(pipeline2);
      expect(res1.includes(upgrade1.newValue)).toBe(true);
      const upgrade2 = {
        managerData: { lineNumber: 16 },
        newValue: 'v1.5.0',
      };
      const res2 = updateDependency({
        fileContent: res1,
        upgrade: upgrade2,
      });
      expect(res2).not.toEqual(res1);
      expect(res2).toMatchSnapshot();
    });
    it('returns same', () => {
      const upgrade = {
        managerData: { lineNumber: 3 },
        newValue: 'v2.0.0',
      };
      const res = updateDependency({
        fileContent: pipeline1,
        upgrade,
      });
      expect(res).toEqual(pipeline1);
    });
    it('returns null if mismatch', () => {
      const upgrade = {
        managerData: { lineNumber: 4 },
        newValue: 'v2.2.0',
      };
      const res = updateDependency({
        fileContent: pipeline1,
        upgrade,
      });
      expect(res).toBeNull();
    });
    it('returns null if error', () => {
      const res = updateDependency({ fileContent: null, upgrade: null });
      expect(res).toBeNull();
    });
  });
});
