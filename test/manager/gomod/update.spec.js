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
    it('replaces major updates > 1', () => {
      const upgrade = {
        depName: 'github.com/pkg/errors',
        lineNumber: 2,
        newMajor: 2,
        updateType: 'major',
        currentValue: 'v0.7.0',
        newValue: 'v2.0.0',
      };
      const res = goUpdate.updateDependency(gomod1, upgrade);
      expect(res).not.toEqual(gomod2);
      expect(res.includes(upgrade.newValue)).toBe(true);
      expect(res.includes('github.com/pkg/errors/v2')).toBe(true);
    });
    it('replaces major gopkg.in updates', () => {
      const upgrade = {
        depName: 'gopkg.in/russross/blackfriday.v1',
        lineNumber: 7,
        newMajor: 2,
        updateType: 'major',
        currentValue: 'v1.0.0',
        newValue: 'v2.0.0',
      };
      const res = goUpdate.updateDependency(gomod1, upgrade);
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(gomod2);
      expect(res.includes('gopkg.in/russross/blackfriday.v2 v2.0.0')).toBe(
        true
      );
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
    it('replaces quoted multiline', () => {
      const upgrade = {
        depName: 'gopkg.in/src-d/go-billy.v4',
        lineNumber: 57,
        multiLine: true,
        newValue: 'v4.8.0',
      };
      const res = goUpdate.updateDependency(gomod2, upgrade);
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(gomod2);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('replaces major multiline', () => {
      const upgrade = {
        depName: 'github.com/emirpasic/gods',
        lineNumber: 7,
        multiLine: true,
        currentValue: 'v1.9.0',
        newValue: 'v2.0.0',
        newMajor: 2,
        updateType: 'major',
      };
      const res = goUpdate.updateDependency(gomod2, upgrade);
      expect(res).not.toEqual(gomod2);
      expect(res.includes(upgrade.newValue)).toBe(true);
      expect(res.includes('github.com/emirpasic/gods/v2')).toBe(true);
    });
    it('bumps major multiline', () => {
      const upgrade = {
        depName: 'github.com/src-d/gcfg',
        lineNumber: 47,
        multiLine: true,
        currentValue: 'v2.3.0',
        newValue: 'v3.0.0',
        newMajor: 3,
        updateType: 'major',
      };
      const res = goUpdate.updateDependency(gomod2, upgrade);
      expect(res).not.toEqual(gomod2);
      expect(res.includes(upgrade.newValue)).toBe(true);
      expect(res.includes('github.com/src-d/gcfg/v3')).toBe(true);
    });
    it('update multiline digest', () => {
      const upgrade = {
        depName: 'github.com/spf13/jwalterweatherman',
        lineNumber: 43,
        multiLine: true,
        currentVersion: 'v0.0.0',
        updateType: 'digest',
        currentDigest: '14d3d4c51834',
        newDigest: '123456123456abcdef',
      };
      const res = goUpdate.updateDependency(gomod2, upgrade);
      expect(res).not.toEqual(gomod2);
      expect(res.includes(upgrade.newDigest)).toBe(false);
      expect(res.includes(upgrade.newDigest.substring(0, 12))).toBe(true);
    });
    it('skips already-updated multiline digest', () => {
      const upgrade = {
        depName: 'github.com/spf13/jwalterweatherman',
        lineNumber: 43,
        multiLine: true,
        currentVersion: 'v0.0.0',
        updateType: 'digest',
        currentDigest: 'abcdefabcdef',
        newDigest: '14d3d4c51834000000',
      };
      const res = goUpdate.updateDependency(gomod2, upgrade);
      expect(res).toEqual(gomod2);
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
