const fs = require('fs');
const goUpdate = require('../../../lib/manager/gomod/update');

const gomod1 = fs.readFileSync('test/_fixtures/go/1/go.mod', 'utf8');
const gomod2 = fs.readFileSync('test/_fixtures/go/2/go.mod', 'utf8');

describe('manager/gomod/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        depName: 'github.com/pkg/errors',
        lineNumber: 2,
        newValue: 'v0.8.0',
      };
      const res = goUpdate.updateDependency(gomod1, upgrade);
      expect(res).not.toEqual(gomod1);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('replaces two values in one file', () => {
      const upgrade1 = {
        depName: 'github.com/pkg/errors',
        lineNumber: 2,
        newValue: 'v0.8.0',
      };
      const res1 = goUpdate.updateDependency(gomod1, upgrade1);
      expect(res1).not.toEqual(gomod1);
      expect(res1.includes(upgrade1.newValue)).toBe(true);
      const upgrade2 = {
        depName: 'github.com/aws/aws-sdk-go',
        lineNumber: 3,
        newValue: 'v1.15.36',
      };
      const res2 = goUpdate.updateDependency(res1, upgrade2);
      expect(res2).not.toEqual(res1);
      expect(res2).toMatchSnapshot();
    });
    it('returns same', () => {
      const upgrade = {
        depName: 'github.com/pkg/errors',
        lineNumber: 2,
        newValue: 'v0.7.0',
      };
      const res = goUpdate.updateDependency(gomod1, upgrade);
      expect(res).toEqual(gomod1);
    });
    it('skips major updates > 1', () => {
      const upgrade = {
        depName: 'github.com/pkg/errors',
        lineNumber: 2,
        newMajor: 2,
        updateType: 'major',
        newValue: 'v2.0.0',
      };
      const res = goUpdate.updateDependency(gomod1, upgrade);
      expect(res).toEqual(gomod1);
    });
    it('returns null if mismatch', () => {
      const upgrade = {
        depName: 'github.com/aws/aws-sdk-go',
        lineNumber: 2,
        newValue: 'v1.15.36',
      };
      const res = goUpdate.updateDependency(gomod1, upgrade);
      expect(res).toBe(null);
    });
    it('returns null if error', () => {
      const res = goUpdate.updateDependency(null, null);
      expect(res).toBe(null);
    });
    it('replaces multiline', () => {
      const upgrade = {
        depName: 'github.com/fatih/color',
        lineNumber: 8,
        multiLine: true,
        newValue: 'v1.8.0',
      };
      const res = goUpdate.updateDependency(gomod2, upgrade);
      expect(res).not.toEqual(gomod2);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('handles multiline mismatch', () => {
      const upgrade = {
        depName: 'github.com/fatih/color',
        lineNumber: 8,
        newValue: 'v1.8.0',
      };
      const res = goUpdate.updateDependency(gomod2, upgrade);
      expect(res).toBe(null);
    });
  });
});
