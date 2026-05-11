import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import type { UpdateType } from '../../../config/types.ts';
import { updateDependency } from './index.ts';

const gomod1 = Fixtures.get('1/go-mod');
const gomod2 = Fixtures.get('2/go-mod');
const gomod3 = Fixtures.get('3/go-mod');

describe('modules/manager/gomod/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        depName: 'github.com/pkg/errors',
        managerData: { lineNumber: 2 },
        newValue: 'v0.8.0',
        depType: 'require',
      };
      const res = updateDependency({
        fileContent: gomod1,
        packageFile: 'go.mod',
        upgrade,
      });
      expect(res).not.toEqual(gomod1);
      expect(res).toContain(upgrade.newValue);
    });

    it('replaces golang version update', () => {
      const upgrade = {
        depName: 'go',
        managerData: { lineNumber: 2 },
        newValue: '1.18',
        depType: 'golang',
      };
      const res = updateDependency({
        fileContent: gomod3,
        packageFile: 'go.mod',
        upgrade,
      });
      expect(res).not.toEqual(gomod3);
      expect(res).toContain(upgrade.newValue);
    });

    it('replaces go toolchain', () => {
      const upgrade = {
        depName: 'go',
        managerData: { lineNumber: 134 },
        newValue: '1.22.2',
        depType: 'toolchain',
      };
      const res = updateDependency({
        fileContent: gomod3,
        packageFile: 'go.mod',
        upgrade,
      });
      expect(res).not.toEqual(gomod3);
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
        packageFile: 'go.mod',
        upgrade: upgrade1,
      });
      expect(res1).toBeString();
      expect(res1).not.toEqual(gomod1);
      expect(res1).toContain(upgrade1.newValue);
      const upgrade2 = {
        depName: 'github.com/aws/aws-sdk-go',
        managerData: { lineNumber: 3 },
        newValue: 'v1.15.36',
        depType: 'require',
      };
      const res2 = updateDependency({
        fileContent: res1!,
        packageFile: 'go.mod',
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
      const res = updateDependency({
        fileContent: gomod1,
        packageFile: 'go.mod',
        upgrade,
      });
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
      const res = updateDependency({
        fileContent: gomod1,
        packageFile: 'go.mod',
        upgrade,
      });
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
      const res = updateDependency({
        fileContent: gomod1,
        packageFile: 'go.mod',
        upgrade,
      });
      expect(res).not.toEqual(gomod1);
      expect(res).toContain('github.com/pkg/errors/v2 v2.0.0');
    });

    it('bumps major with single package name component', () => {
      const upgrade = {
        depName: 'sigs.k8s.io/structured-merge-diff/v4',
        managerData: { lineNumber: 15 },
        currentValue: 'v4.7.0',
        newValue: 'v6.0.0',
        newMajor: 6,
        updateType: 'major' as UpdateType,
        depType: 'require',
      };
      const res = updateDependency({
        fileContent: gomod1,
        packageFile: 'go.mod',
        upgrade,
      });
      expect(res).not.toEqual(gomod1);
      expect(res).toContain('sigs.k8s.io/structured-merge-diff/v6 v6.0.0');
    });

    it('bumps major with multiple package name components', () => {
      const upgrade = {
        depName: 'github.com/cucumber/common/messages/go/v18',
        managerData: { lineNumber: 16 },
        currentValue: 'v18.0.0',
        newValue: 'v19.0.0',
        newMajor: 19,
        updateType: 'major' as UpdateType,
        depType: 'require',
      };
      const res = updateDependency({
        fileContent: gomod1,
        packageFile: 'go.mod',
        upgrade,
      });
      expect(res).not.toEqual(gomod1);
      expect(res).toContain(
        'github.com/cucumber/common/messages/go/v19 v19.0.0',
      );
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
      const res = updateDependency({
        fileContent: gomod1,
        packageFile: 'go.mod',
        upgrade,
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(gomod1);
      expect(res).toContain('gopkg.in/russross/blackfriday.v2 v2.0.0');
    });

    it('skip replacing incompatible major updates', () => {
      const upgrade = {
        depName: 'github.com/Azure/azure-sdk-for-go',
        managerData: { lineNumber: 8 },
        newMajor: 26,
        updateType: 'major' as UpdateType,
        currentValue: 'v25.1.0+incompatible',
        newValue: 'v26.0.0+incompatible',
        depType: 'require',
      };
      const res = updateDependency({
        fileContent: gomod1,
        packageFile: 'go.mod',
        upgrade,
      });
      expect(res).not.toEqual(gomod1);
      expect(res).toContain(
        'github.com/Azure/azure-sdk-for-go v26.0.0+incompatible',
      );
    });

    it('returns null if mismatch', () => {
      const upgrade = {
        depName: 'github.com/aws/aws-sdk-go',
        managerData: { lineNumber: 2 },
        newValue: 'v1.15.36',
      };
      const res = updateDependency({
        fileContent: gomod1,
        packageFile: 'go.mod',
        upgrade,
      });
      expect(res).toBeNull();
    });

    it('returns null if error', () => {
      // TODO: #22198 bad test, uses invalid null to throwing nullref error
      const res = updateDependency({
        fileContent: null as never,
        packageFile: 'go.mod',
        upgrade: null as never,
      });
      expect(res).toBeNull();
    });

    it('replaces multiline', () => {
      const upgrade = {
        depName: 'github.com/fatih/color',
        managerData: { lineNumber: 8, multiLine: true },
        newValue: 'v1.8.0',
        depType: 'require',
      };
      const res = updateDependency({
        fileContent: gomod2,
        packageFile: 'go.mod',
        upgrade,
      });
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
      const res = updateDependency({
        fileContent: gomod2,
        packageFile: 'go.mod',
        upgrade,
      });
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
      const res = updateDependency({
        fileContent: gomod2,
        packageFile: 'go.mod',
        upgrade,
      });
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
      const res = updateDependency({
        fileContent: gomod2,
        packageFile: 'go.mod',
        upgrade,
      });
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
      const res = updateDependency({
        fileContent: gomod2,
        packageFile: 'go.mod',
        upgrade,
      });
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
      const res = updateDependency({
        fileContent: gomod2,
        packageFile: 'go.mod',
        upgrade,
      });
      expect(res).not.toEqual(gomod2);
      expect(res).toContain('github.com/spf13/jwalterweatherman 123456123456');
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
      const res = updateDependency({
        fileContent: gomod2,
        packageFile: 'go.mod',
        upgrade,
      });
      expect(res).toEqual(gomod2);
    });

    it('updates pseudo-version with digest updateType', () => {
      const fileContent = codeBlock`
        module example.com/test
        require (
          knative.dev/pkg v0.0.0-20250312035536-b7bbf4be5dbd
          k8s.io/utils v0.0.0-20251002143259-bc988d571ff4
        )
      `;
      const upgrade = {
        depName: 'knative.dev/pkg',
        managerData: { lineNumber: 2, multiLine: true },
        updateType: 'digest' as const,
        currentValue: 'v0.0.0-20250312035536-b7bbf4be5dbd',
        currentDigest: 'b7bbf4be5dbd',
        newValue: 'v0.0.0-20260120122510-4a022ed9999a',
        newDigest: '4a022ed9999a',
        depType: 'require',
      };
      const res = updateDependency({
        fileContent,
        packageFile: 'go.mod',
        upgrade,
      });
      // Should write the full pseudo-version, not just the digest
      expect(res).toContain(
        'knative.dev/pkg v0.0.0-20260120122510-4a022ed9999a',
      );
      expect(res).not.toContain('knative.dev/pkg 4a022ed9999a');
    });

    it('handles multiline mismatch', () => {
      const upgrade = {
        depName: 'github.com/fatih/color',
        managerData: { lineNumber: 8 },
        newValue: 'v1.8.0',
        depType: 'require',
      };
      const res = updateDependency({
        fileContent: gomod2,
        packageFile: 'go.mod',
        upgrade,
      });
      expect(res).toBeNull();
    });

    it('handles +incompatible tag', () => {
      const upgrade = {
        depName: 'github.com/Azure/azure-sdk-for-go',
        managerData: { lineNumber: 8 },
        newValue: 'v26.0.0',
        depType: 'require',
      };
      const res = updateDependency({
        fileContent: gomod1,
        packageFile: 'go.mod',
        upgrade,
      });
      expect(res).not.toEqual(gomod1);
      // Assert that the version still contains +incompatible tag.
      expect(res).toContain(
        'github.com/Azure/azure-sdk-for-go v26.0.0+incompatible',
      );
    });

    it('handles +incompatible tag without duplicating it', () => {
      const upgrade = {
        depName: 'github.com/Azure/azure-sdk-for-go',
        managerData: { lineNumber: 8 },
        newValue: 'v26.0.0+incompatible',
        depType: 'require',
      };
      const res = updateDependency({
        fileContent: gomod1,
        packageFile: 'go.mod',
        upgrade,
      });
      expect(res).not.toEqual(gomod1);
      expect(res).not.toContain(
        'github.com/Azure/azure-sdk-for-go v26.0.0+incompatible+incompatible',
      );
      expect(res).toContain(
        'github.com/Azure/azure-sdk-for-go v26.0.0+incompatible',
      );
    });

    it('handles replace line with minor version update', () => {
      const upgrade = {
        depName: 'github.com/pravesht/gocql',
        managerData: { lineNumber: 11 },
        newValue: 'v0.0.1',
        depType: 'replace',
      };
      const res = updateDependency({
        fileContent: gomod1,
        packageFile: 'go.mod',
        upgrade,
      });
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
      const res = updateDependency({
        fileContent: gomod1,
        packageFile: 'go.mod',
        upgrade,
      });
      expect(res).not.toEqual(gomod1);
      expect(res).toContain('github.com/pravesht/gocql/v2 v2.0.0');
    });

    // from #41260, a Go module with a `replace` on the same module (for this example) and a multi-line replace being converted to a single-line `replace`
    it('handles replace line with major version update that bumps both sides of the replace', () => {
      const gomod = codeBlock`
        module github.com/walsm232/renovate-gomod-bug-test

        go 1.25

        replace (
            github.com/grpc-ecosystem/grpc-gateway => github.com/grpc-ecosystem/grpc-gateway v1.16.0
        )
      `;

      const upgrade = {
        depName: 'github.com/grpc-ecosystem/grpc-gateway',
        managerData: { multiLine: true, lineNumber: 5 },
        newValue: 'v2.28.0',
        depType: 'replace',
        currentValue: 'v1.16.0',
        newMajor: 2,
        updateType: 'major' as UpdateType,
      };
      const res = updateDependency({
        fileContent: gomod,
        packageFile: 'go.mod',
        upgrade,
      });
      expect(res).not.toEqual(gomod);
      expect(res).toContain(
        'github.com/grpc-ecosystem/grpc-gateway/v2 => github.com/grpc-ecosystem/grpc-gateway/v2 v2.28.0',
      );
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
      const res = updateDependency({
        fileContent: gomod1,
        packageFile: 'go.mod',
        upgrade,
      });
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
      const res = updateDependency({
        fileContent: gomod1,
        packageFile: 'go.mod',
        upgrade,
      });
      expect(res).not.toEqual(gomod1);
      expect(res).toContain('github.com/caarlos0/env/v6 v6.1.0');
    });

    it('handles multiline replace update', () => {
      const fileContent = `
      go 1.23
      replace (
        k8s.io/client-go => k8s.io/client-go v0.21.9
      )`;
      const upgrade = {
        depName: 'k8s.io/client-go',
        managerData: { lineNumber: 3, multiLine: true },
        newValue: 'v0.22.0',
        depType: 'replace',
        currentValue: 'v0.21.9',
        newMajor: 2,
        updateType: 'minor' as UpdateType,
      };
      const res = updateDependency({
        fileContent,
        packageFile: 'go.mod',
        upgrade,
      });
      expect(res).not.toEqual(fileContent);
      expect(res).toContain('k8s.io/client-go => k8s.io/client-go v0.22.0');
    });

    it('should return null for replacement', () => {
      const res = updateDependency({
        fileContent: '',
        packageFile: 'go.mod',
        upgrade: { updateType: 'replacement' },
      });
      expect(res).toBeNull();
    });

    it('should perform indirect upgrades when top-level', () => {
      const upgrade = {
        depName: 'github.com/davecgh/go-spew',
        managerData: { lineNumber: 4 },
        newValue: 'v1.1.1',
        depType: 'indirect',
      };
      const res = updateDependency({
        fileContent: gomod1,
        packageFile: 'go.mod',
        upgrade,
      });
      expect(res).not.toEqual(gomod1);
      expect(res).toContain(`${upgrade.newValue} // indirect`);
    });

    it('should perform indirect upgrades when in require blocks', () => {
      const upgrade = {
        depName: 'github.com/go-ole/go-ole',
        managerData: { lineNumber: 23, multiLine: true },
        newValue: 'v1.5.0',
        depType: 'indirect',
      };
      const res = updateDependency({
        fileContent: gomod3,
        packageFile: 'go.mod',
        upgrade,
      });
      expect(res).not.toEqual(gomod2);
      expect(res).toContain(`${upgrade.newValue} // indirect`);
    });
  });
});
