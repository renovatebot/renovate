import _fs from 'fs-extra';
import { join } from 'upath';
import { updateArtifacts } from './index';

const fs: jest.Mocked<typeof _fs> = _fs as any;
const config = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
  constraints: { go: '1.14' },
};

describe('.updateArtifacts()', () => {
  it('returns null if no .terraform.lock.hcl found', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'main.tf',
        updatedDeps: ['aws'],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });
  it('returns null if .terraform.lock.hcl is empty', async () => {
    fs.readFile.mockResolvedValueOnce(null as any);
    expect(
      await updateArtifacts({
        packageFileName: 'main.tf',
        updatedDeps: ['aws'],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });
  // TODO add unit tests
});
