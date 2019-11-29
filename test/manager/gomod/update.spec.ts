import { readFileSync } from 'fs';
import { updateDependency } from '../../../lib/manager/gomod/update';

const gomod1 = readFileSync('test/manager/gomod/_fixtures/1/go.mod', 'utf8');
const gomod2 = readFileSync('test/manager/gomod/_fixtures/2/go.mod', 'utf8');

describe('manager/gomod/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        depName: 'github.com/pkg/errors',
        managerData: { lineNumber: 2 },
        newValue: 'v0.8.0',
        depType: 'require',
      };
      const res = updateDependency(gomod1, upgrade);
      expect(res).not.toEqual(gomod1);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('replaces two values in one file', () => {
      const upgrade1 = {
        depName: 'github.com/pkg/errors',
        managerData: { lineNumber: 2 },
        newValue: 'v0.8.0',
        depType: 'require',
      };
      const res1 = updateDependency(gomod1, upgrade1);
      expect(res1).not.toEqual(gomod1);
      expect(res1.includes(upgrade1.newValue)).toBe(true);
      const upgrade2 = {
        depName: 'github.com/aws/aws-sdk-go',
        managerData: { lineNumber: 3 },
        newValue: 'v1.15.36',
        depType: 'require',
      };
      const res2 = updateDependency(res1, upgrade2);
      expect(res2).not.toEqual(res1);
      expect(res2).toMatchSnapshot();
    });
    it('returns same', () => {
      const upgrade = {
        depName: 'github.com/pkg/errors',
        managerData: { lineNumber: 2 },
        newValue: 'v0.7.0',
      };
      const res = updateDependency(gomod1, upgrade);
      expect(res).toEqual(gomod1);
    });
    it('replaces major updates > 1', () => {
      const upgrade = {
        depName: 'github.com/pkg/errors',
        managerData: { lineNumber: 2 },
        newMajor: 2,
        updateType: 'major',
        currentValue: 'v0.7.0',
        newValue: 'v2.0.0',
        depType: 'require',
      };
      const res = updateDependency(gomod1, upgrade);
      expect(res).not.toEqual(gomod2);
      expect(res.includes(upgrade.newValue)).toBe(true);
      expect(res.includes('github.com/pkg/errors/v2')).toBe(true);
    });
    it('replaces major gopkg.in updates', () => {
      const upgrade = {
        depName: 'gopkg.in/russross/blackfriday.v1',
        managerData: { lineNumber: 7 },
        newMajor: 2,
        updateType: 'major',
        currentValue: 'v1.0.0',
        newValue: 'v2.0.0',
        depType: 'require',
      };
      const res = updateDependency(gomod1, upgrade);
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(gomod2);
      expect(res.includes('gopkg.in/russross/blackfriday.v2 v2.0.0')).toBe(
        true
      );
    });
    it('returns null if mismatch', () => {
      const upgrade = {
        depName: 'github.com/aws/aws-sdk-go',
        managerData: { lineNumber: 2 },
        newValue: 'v1.15.36',
      };
      const res = updateDependency(gomod1, upgrade);
      expect(res).toBeNull();
    });
    it('returns null if error', () => {
      const res = updateDependency(null, null);
      expect(res).toBeNull();
    });
    it('replaces multiline', () => {
      const upgrade = {
        depName: 'github.com/fatih/color',
        managerData: { lineNumber: 8, multiLine: true },
        newValue: 'v1.8.0',
        depType: 'require',
      };
      const res = updateDependency(gomod2, upgrade);
      expect(res).not.toEqual(gomod2);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('replaces quoted multiline', () => {
      const upgrade = {
        depName: 'gopkg.in/src-d/go-billy.v4',
        managerData: { lineNumber: 57, multiLine: true },
        newValue: 'v4.8.0',
        depType: 'require',
      };
      const res = updateDependency(gomod2, upgrade);
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(gomod2);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('replaces major multiline', () => {
      const upgrade = {
        depName: 'github.com/emirpasic/gods',
        managerData: { lineNumber: 7, multiLine: true },
        currentValue: 'v1.9.0',
        newValue: 'v2.0.0',
        newMajor: 2,
        updateType: 'major',
        depType: 'require',
      };
      const res = updateDependency(gomod2, upgrade);
      expect(res).not.toEqual(gomod2);
      expect(res.includes(upgrade.newValue)).toBe(true);
      expect(res.includes('github.com/emirpasic/gods/v2')).toBe(true);
    });
    it('bumps major multiline', () => {
      const upgrade = {
        depName: 'github.com/src-d/gcfg',
        managerData: { lineNumber: 47, multiLine: true },
        currentValue: 'v2.3.0',
        newValue: 'v3.0.0',
        newMajor: 3,
        updateType: 'major',
        depType: 'require',
      };
      const res = updateDependency(gomod2, upgrade);
      expect(res).not.toEqual(gomod2);
      expect(res.includes(upgrade.newValue)).toBe(true);
      expect(res.includes('github.com/src-d/gcfg/v3')).toBe(true);
    });
    it('update multiline digest', () => {
      const upgrade = {
        depName: 'github.com/spf13/jwalterweatherman',
        managerData: { lineNumber: 43, multiLine: true },
        currentVersion: 'v0.0.0',
        updateType: 'digest',
        currentDigest: '14d3d4c51834',
        newDigest: '123456123456abcdef',
        depType: 'require',
      };
      const res = updateDependency(gomod2, upgrade);
      expect(res).not.toEqual(gomod2);
      expect(res.includes(upgrade.newDigest)).toBe(false);
      expect(res.includes(upgrade.newDigest.substring(0, 12))).toBe(true);
    });
    it('skips already-updated multiline digest', () => {
      const upgrade = {
        depName: 'github.com/spf13/jwalterweatherman',
        managerData: { lineNumber: 43, multiLine: true },
        currentVersion: 'v0.0.0',
        updateType: 'digest',
        currentDigest: 'abcdefabcdef',
        newDigest: '14d3d4c51834000000',
        depType: 'require',
      };
      const res = updateDependency(gomod2, upgrade);
      expect(res).toEqual(gomod2);
    });
    it('handles multiline mismatch', () => {
      const upgrade = {
        depName: 'github.com/fatih/color',
        managerData: { lineNumber: 8 },
        newValue: 'v1.8.0',
        depType: 'require',
      };
      const res = updateDependency(gomod2, upgrade);
      expect(res).toBeNull();
    });
    it('handles +incompatible tag', () => {
      const upgrade = {
        depName: 'github.com/Azure/azure-sdk-for-go',
        managerData: { lineNumber: 8 },
        newValue: 'v26.0.0',
        depType: 'require',
      };
      const res = updateDependency(gomod1, upgrade);
      expect(res).not.toEqual(gomod1);
      // Assert that the version still contains +incompatible tag.
      expect(res.includes(upgrade.newValue + '+incompatible')).toBe(true);
    });
    it('handles replace line with minor version update', () => {
      const upgrade = {
        depName: 'github.com/pravesht/gocql',
        managerData: { lineNumber: 11 },
        newValue: 'v0.0.1',
        depType: 'replace',
      };
      const res = updateDependency(gomod1, upgrade);
      expect(res).not.toEqual(gomod1);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('handles replace line with major version update', () => {
      const upgrade = {
        depName: 'github.com/pravesht/gocql',
        managerData: { lineNumber: 11 },
        newValue: 'v2.0.0',
        depType: 'replace',
        currentValue: 'v0.7.0',
        newMajor: 2,
        updateType: 'major',
      };
      const res = updateDependency(gomod1, upgrade);
      expect(res).not.toEqual(gomod1);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('handles replace line with digest', () => {
      const upgrade = {
        depName: 'github.com/pravesht/gocql',
        managerData: { lineNumber: 11 },
        newValue: 'v2.0.0',
        depType: 'replace',
        currentValue: 'v0.7.0',
        newMajor: 2,
        updateType: 'digest',
        currentDigest: '14d3d4c51834',
        newDigest: '123456123456abcdef',
      };
      const res = updateDependency(gomod1, upgrade);
      expect(res).not.toEqual(gomod1);
      expect(res.includes(upgrade.newDigest.substring(0, 12))).toBe(true);
    });
    it('handles no pinned version to latest available version', () => {
      const upgrade = {
        depName: 'github.com/caarlos0/env',
        managerData: { lineNumber: 13 },
        newValue: 'v6.1.0',
        depType: 'require',
        currentValue: 'v3.5.0+incompatible',
        newMajor: 6,
        updateType: 'major',
      };
      const res = updateDependency(gomod1, upgrade);
      expect(res).not.toEqual(gomod1);
      expect(res.includes(upgrade.newValue)).toBe(true);
      expect(res).toContain(upgrade.depName + '/v6');
    });
  });
});
