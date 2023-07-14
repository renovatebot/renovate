import { updateArtifacts } from './lockfile';

describe('modules/manager/maven/lockfile', () => {
  describe('updateArtifacts()', () => {
    it('rejects if no datasource=maven found', async () => {
      await expect(
        updateArtifacts({
          packageFileName: 'pom.xml',
          updatedDeps: [],
          newPackageFileContent: '{}',
          config: {},
        })
      ).toReject();
    });

    it('rejects if no lockfile.json found', async () => {
      await expect(
        updateArtifacts({
          packageFileName: 'pom.xml',
          updatedDeps: [{ datasource: 'maven' }],
          newPackageFileContent: '{}',
          config: {},
        })
      ).toReject();
    });
  });
});
