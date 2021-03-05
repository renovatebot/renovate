import { readFileSync } from 'fs';
import { UpdateType } from '../../config';
import { updateDependency } from './update';

const gomod1 = readFileSync('lib/manager/gomod/__fixtures__/1/go.mod', 'utf8');
const gomod2 = readFileSync('lib/manager/gomod/__fixtures__/2/go.mod', 'utf8');

describe('manager/gomod/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        depName: 'github.com/pkg/errors',
        managerData: { lineNumber: 2 },
        newValue: 'v0.8.0',
        depType: 'require',
      };
      const res = updateDependency({ fileContent: gomod1, upgrade });
      expect(res).not.toEqual(gomod1);
      expect(res).toContain(upgrade.newValue);
    });
    it('replaces two values in one file', () => {
      const upgrade1 = {
        depName: 'github.com/pkg/errors',
        managerData: { lineNumber: 2 },
        newValue: 'v0.8.0',
        depType: 'require',
      };
      const res1 = updateDependency({
        fileContent: gomod1,
        upgrade: upgrade1,
      });
      expect(res1).not.toEqual(gomod1);
      expect(res1).toContain(upgrade1.newValue);
      const upgrade2 = {
        depName: 'github.com/aws/aws-sdk-go',
        managerData: { lineNumber: 3 },
        newValue: 'v1.15.36',
        depType: 'require',
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
        depName: 'github.com/pkg/errors',
        managerData: { lineNumber: 2 },
        newValue: 'v0.7.0',
      };
      const res = updateDependency({ fileContent: gomod1, upgrade });
      expect(res).toEqual(gomod1);
    });
    it('bumps major v0 > v1', () => {
      const upgrade = {
        depName: 'github.com/pkg/errors',
        managerData: { lineNumber: 2 },
        currentValue: 'v0.7.0',
        newValue: 'v1.0.0',
        newMajor: 1,
        updateType: 'major' as UpdateType,
        depType: 'require',
      };
      const res = updateDependency({ fileContent: gomod1, upgrade });
      expect(res).not.toEqual(gomod1);
      expect(res).toContain('github.com/pkg/errors v1.0.0');
    });
    it('replaces major updates > 1', () => {
      const upgrade = {
        depName: 'github.com/pkg/errors',
        managerData: { lineNumber: 2 },
        newMajor: 2,
        updateType: 'major' as UpdateType,
        currentValue: 'v0.7.0',
        newValue: 'v2.0.0',
        depType: 'require',
      };
      const res = updateDependency({ fileContent: gomod1, upgrade });
      expect(res).not.toEqual(gomod2);
      expect(res).toContain('github.com/pkg/errors/v2 v2.0.0');
    });
    it('replaces major gopkg.in updates', () => {
      const upgrade = {
        depName: 'gopkg.in/russross/blackfriday.v1',
        managerData: { lineNumber: 7 },
        newMajor: 2,
        updateType: 'major' as UpdateType,
        currentValue: 'v1.0.0',
        newValue: 'v2.0.0',
        depType: 'require',
      };
      const res = updateDependency({ fileContent: gomod1, upgrade });
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(gomod2);
      expect(res).toContain('gopkg.in/russross/blackfriday.v2 v2.0.0');
    });
    it('returns null if mismatch', () => {
      const upgrade = {
        depName: 'github.com/aws/aws-sdk-go',
        managerData: { lineNumber: 2 },
        newValue: 'v1.15.36',
      };
      const res = updateDependency({ fileContent: gomod1, upgrade });
      expect(res).toBeNull();
    });
    it('returns null if error', () => {
      const res = updateDependency({ fileContent: null, upgrade: null });
      expect(res).toBeNull();
    });
    it('replaces multiline', () => {
      const upgrade = {
        depName: 'github.com/fatih/color',
        managerData: { lineNumber: 8, multiLine: true },
        newValue: 'v1.8.0',
        depType: 'require',
      };
      const res = updateDependency({ fileContent: gomod2, upgrade });
      expect(res).not.toEqual(gomod2);
      expect(res).toContain('github.com/fatih/color v1.8.0');
    });
    it('replaces quoted multiline', () => {
      const upgrade = {
        depName: 'gopkg.in/src-d/go-billy.v4',
        managerData: { lineNumber: 57, multiLine: true },
        newValue: 'v4.8.0',
        depType: 'require',
      };
      const res = updateDependency({ fileContent: gomod2, upgrade });
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(gomod2);
      expect(res).toContain(upgrade.newValue);
    });
    it('replaces major multiline', () => {
      const upgrade = {
        depName: 'github.com/emirpasic/gods',
        managerData: { lineNumber: 7, multiLine: true },
        currentValue: 'v1.9.0',
        newValue: 'v2.0.0',
        newMajor: 2,
        updateType: 'major' as UpdateType,
        depType: 'require',
      };
      const res = updateDependency({ fileContent: gomod2, upgrade });
      expect(res).not.toEqual(gomod2);
      expect(res).toContain('github.com/emirpasic/gods/v2 v2.0.0');
    });
    it('bumps major multiline', () => {
      const upgrade = {
        depName: 'github.com/src-d/gcfg/v2',
        managerData: { lineNumber: 47, multiLine: true },
        currentValue: 'v2.3.0',
        newValue: 'v3.0.0',
        newMajor: 3,
        updateType: 'major' as UpdateType,
        depType: 'require',
      };
      const res = updateDependency({ fileContent: gomod2, upgrade });
      expect(res).not.toEqual(gomod2);
      expect(res).toContain('github.com/src-d/gcfg/v3 v3.0.0');
    });
    it('bumps major v0 > v1 multiline', () => {
      const upgrade = {
        depName: 'golang.org/x/text',
        managerData: { lineNumber: 56, multiLine: true },
        currentValue: 'v0.3.0',
        newValue: 'v1.0.0',
        newMajor: 1,
        updateType: 'major' as UpdateType,
        depType: 'require',
      };
      const res = updateDependency({ fileContent: gomod2, upgrade });
      expect(res).not.toEqual(gomod2);
      expect(res).toContain('golang.org/x/text v1.0.0');
    });
    it('update multiline digest', () => {
      const upgrade = {
        depName: 'github.com/spf13/jwalterweatherman',
        managerData: { lineNumber: 43, multiLine: true },
        updateType: 'digest' as UpdateType,
        currentDigest: '14d3d4c51834',
        newDigest: '123456123456abcdef',
        depType: 'require',
      };
      const res = updateDependency({ fileContent: gomod2, upgrade });
      expect(res).not.toEqual(gomod2);
      expect(res).not.toContain(upgrade.newDigest);
      expect(res).toContain(upgrade.newDigest.substring(0, 12));
    });
    it('skips already-updated multiline digest', () => {
      const upgrade = {
        depName: 'github.com/spf13/jwalterweatherman',
        managerData: { lineNumber: 43, multiLine: true },
        updateType: 'digest' as UpdateType,
        currentDigest: 'abcdefabcdef',
        newDigest: '14d3d4c51834000000',
        depType: 'require',
      };
      const res = updateDependency({ fileContent: gomod2, upgrade });
      expect(res).toEqual(gomod2);
    });
    it('handles multiline mismatch', () => {
      const upgrade = {
        depName: 'github.com/fatih/color',
        managerData: { lineNumber: 8 },
        newValue: 'v1.8.0',
        depType: 'require',
      };
      const res = updateDependency({ fileContent: gomod2, upgrade });
      expect(res).toBeNull();
    });
    it('handles +incompatible tag', () => {
      const upgrade = {
        depName: 'github.com/Azure/azure-sdk-for-go',
        managerData: { lineNumber: 8 },
        newValue: 'v26.0.0',
        depType: 'require',
      };
      const res = updateDependency({ fileContent: gomod1, upgrade });
      expect(res).not.toEqual(gomod1);
      // Assert that the version still contains +incompatible tag.
      expect(res).toContain(
        'github.com/Azure/azure-sdk-for-go v26.0.0+incompatible'
      );
    });
    it('handles replace line with minor version update', () => {
      const upgrade = {
        depName: 'github.com/pravesht/gocql',
        managerData: { lineNumber: 11 },
        newValue: 'v0.0.1',
        depType: 'replace',
      };
      const res = updateDependency({ fileContent: gomod1, upgrade });
      expect(res).not.toEqual(gomod1);
      expect(res).toContain('github.com/pravesht/gocql v0.0.1');
    });
    it('handles replace line with major version update', () => {
      const upgrade = {
        depName: 'github.com/pravesht/gocql',
        managerData: { lineNumber: 11 },
        newValue: 'v2.0.0',
        depType: 'replace',
        currentValue: 'v0.7.0',
        newMajor: 2,
        updateType: 'major' as UpdateType,
      };
      const res = updateDependency({ fileContent: gomod1, upgrade });
      expect(res).not.toEqual(gomod1);
      expect(res).toContain('github.com/pravesht/gocql/v2 v2.0.0');
    });
    it('handles replace line with digest', () => {
      const upgrade = {
        depName: 'github.com/pravesht/gocql',
        managerData: { lineNumber: 11 },
        newValue: 'v2.0.0',
        depType: 'replace',
        currentValue: 'v0.7.0',
        newMajor: 2,
        updateType: 'digest' as UpdateType,
        currentDigest: '14d3d4c51834',
        newDigest: '123456123456abcdef',
      };
      const res = updateDependency({ fileContent: gomod1, upgrade });
      expect(res).not.toEqual(gomod1);
      expect(res).toContain(upgrade.newDigest.substring(0, 12));
    });
    it('handles no pinned version to latest available version', () => {
      const upgrade = {
        depName: 'github.com/caarlos0/env',
        managerData: { lineNumber: 13 },
        newValue: 'v6.1.0',
        depType: 'require',
        currentValue: 'v3.5.0+incompatible',
        newMajor: 6,
        updateType: 'major' as UpdateType,
      };
      const res = updateDependency({ fileContent: gomod1, upgrade });
      expect(res).not.toEqual(gomod1);
      expect(res).toContain('github.com/caarlos0/env/v6 v6.1.0');
    });
  });
});
