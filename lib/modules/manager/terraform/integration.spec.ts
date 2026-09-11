import upath from 'upath';
import { getConfig } from '../../../config/defaults.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { doAutoReplace } from '../../../workers/repository/update/branch/auto-replace.ts';
import type { BranchUpgradeConfig } from '../../../workers/types.ts';
import { extractPackageFile } from './index.ts';

// auto-mock fs
vi.mock('../../../util/fs/index.ts');

describe('modules/manager/terraform/integration', () => {
  beforeEach(() => {
    GlobalConfig.set({ localDir: upath.join('/tmp/github/some/repo') });
  });

  describe('auto-replace SHA-pinned github modules', () => {
    it('rewrites the digest and version comment on update', async () => {
      const src = `
module "pinned" {
  source = "github.com/hashicorp/example?ref=aabbccddee1122334455667788990011aabbccdd" # v1.2.3
}
`;
      const deps = (await extractPackageFile(src, 'main.tf', {}))?.deps;
      const upgrade = getConfig() as BranchUpgradeConfig;
      Object.assign(upgrade, deps![0], {
        manager: 'terraform',
        packageFile: 'main.tf',
        depIndex: 0,
        baseDeps: deps,
        newValue: 'v2.0.0',
        newDigest: 'ffee00112233445566778899aabbccddeeff0011',
      });

      const res = await doAutoReplace(upgrade, src, false);
      expect(res).toBe(
        src.replace(
          'aabbccddee1122334455667788990011aabbccdd" # v1.2.3',
          'ffee00112233445566778899aabbccddeeff0011" # v2.0.0',
        ),
      );
    });

    it('preserves trailing params when rewriting', async () => {
      const src = `
module "pinned" {
  source = "github.com/hashicorp/example?ref=aabbccddee1122334455667788990011aabbccdd&depth=1" # v1.2.3
}
`;
      const deps = (await extractPackageFile(src, 'main.tf', {}))?.deps;
      const upgrade = getConfig() as BranchUpgradeConfig;
      Object.assign(upgrade, deps![0], {
        manager: 'terraform',
        packageFile: 'main.tf',
        depIndex: 0,
        baseDeps: deps,
        newValue: 'v2.0.0',
        newDigest: 'ffee00112233445566778899aabbccddeeff0011',
      });

      const res = await doAutoReplace(upgrade, src, false);
      expect(res).toBe(
        src.replace(
          'aabbccddee1122334455667788990011aabbccdd&depth=1" # v1.2.3',
          'ffee00112233445566778899aabbccddeeff0011&depth=1" # v2.0.0',
        ),
      );
    });
  });
});
