import { join } from 'upath';
import { fs, loadFixture } from '../../../test/util';
import { setGlobalConfig } from '../../config/global';
import type { RepoGlobalConfig } from '../../config/types';
import { extractPackageFile } from '.';

const tf1 = loadFixture('1.tf');
const tf2 = `module "relative" {
  source = "../../modules/fe"
}
`;
const helm = loadFixture('helm.tf');
const lockedVersion = loadFixture('lockedVersion.tf');
const lockedVersionLockfile = loadFixture('rangeStrategy.hcl');
const terraformBlock = loadFixture('terraformBlock.tf');

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
};

// auto-mock fs
jest.mock('../../util/fs');

describe('manager/terraform/extract', () => {
  beforeEach(() => {
    setGlobalConfig(adminConfig);
  });
  describe('extractPackageFile()', () => {
    it('returns null for empty', async () => {
      expect(await extractPackageFile('nothing here', '1.tf', {})).toBeNull();
    });

    it('extracts', async () => {
      const res = await extractPackageFile(tf1, '1.tf', {});
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(46);
      expect(res.deps.filter((dep) => dep.skipReason)).toHaveLength(8);
    });

    it('returns null if only local deps', async () => {
      expect(await extractPackageFile(tf2, '2.tf', {})).toBeNull();
    });

    it('extract helm releases', async () => {
      const res = await extractPackageFile(helm, 'helm.tf', {});
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(6);
      expect(res.deps.filter((dep) => dep.skipReason)).toHaveLength(2);
    });

    it('update lockfile constraints with range strategy update-lockfile', async () => {
      fs.readLocalFile.mockResolvedValueOnce(lockedVersionLockfile);
      fs.getSiblingFileName.mockReturnValueOnce('aLockFile.hcl');

      const res = await extractPackageFile(
        lockedVersion,
        'lockedVersion.tf',
        {}
      );
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(3);
      expect(res.deps.filter((dep) => dep.skipReason)).toHaveLength(0);
    });

    it('test terraform block with only requirement_terraform_version', async () => {
      const res = await extractPackageFile(
        terraformBlock,
        'terraformBlock.tf',
        {}
      );
      expect(res.deps).toHaveLength(1);
      expect(res.deps.filter((dep) => dep.skipReason)).toHaveLength(0);
      expect(res).toMatchSnapshot();
    });
  });
});
