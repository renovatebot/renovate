const fs = require('fs');
const tfUpdate = require('../../../lib/manager/terraform/update');

const tf1 = fs.readFileSync('test/_fixtures/terraform/1.tf', 'utf8');

describe('manager/terraform/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        depName: 'foo',
        lineNumber: 1,
        githubRepo: 'hashicorp/example',
        newValue: 'v1.0.1',
      };
      const res = tfUpdate.updateDependency(tf1, upgrade);
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(tf1);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('returns same', () => {
      const upgrade = {
        depName: 'foo',
        lineNumber: 1,
        githubRepo: 'hashicorp/example',
        newValue: 'v1.0.0',
      };
      const res = tfUpdate.updateDependency(tf1, upgrade);
      expect(res).toEqual(tf1);
    });
    it('returns null if wrong line', () => {
      const upgrade = {
        depName: 'foo',
        lineNumber: 2,
        githubRepo: 'hashicorp/example',
        newValue: 'v1.0.0',
      };
      const res = tfUpdate.updateDependency(tf1, upgrade);
      expect(res).toBeNull();
    });
    /*
    it('replaces major updates > 1', () => {
      const upgrade = {
        depName: 'github.com/pkg/errors',
        lineNumber: 2,
        newMajor: 2,
        updateType: 'major',
        currentValue: 'v0.7.0',
        newValue: 'v2.0.0',
      };
      const res = tfUpdate.updateDependency(tf1, upgrade);
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
      const res = tfUpdate.updateDependency(tf1, upgrade);
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
      const res = tfUpdate.updateDependency(tf1, upgrade);
      expect(res).toBe(null);
    });
    it('returns null if error', () => {
      const res = tfUpdate.updateDependency(null, null);
      expect(res).toBe(null);
    });
    it('replaces multiline', () => {
      const upgrade = {
        depName: 'github.com/fatih/color',
        lineNumber: 8,
        multiLine: true,
        newValue: 'v1.8.0',
      };
      const res = tfUpdate.updateDependency(gomod2, upgrade);
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
      const res = tfUpdate.updateDependency(gomod2, upgrade);
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
      const res = tfUpdate.updateDependency(gomod2, upgrade);
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
      const res = tfUpdate.updateDependency(gomod2, upgrade);
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
      const res = tfUpdate.updateDependency(gomod2, upgrade);
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
      const res = tfUpdate.updateDependency(gomod2, upgrade);
      expect(res).toEqual(gomod2);
    });
    it('handles multiline mismatch', () => {
      const upgrade = {
        depName: 'github.com/fatih/color',
        lineNumber: 8,
        newValue: 'v1.8.0',
      };
      const res = tfUpdate.updateDependency(gomod2, upgrade);
      expect(res).toBe(null);
    });
    */
  });
});
