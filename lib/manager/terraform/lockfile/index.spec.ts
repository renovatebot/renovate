import { join } from 'upath';
import { updateArtifacts } from './index';

const config = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
  constraints: { go: '1.14' },
};

// auto-mock fs
// jest.mock('fs');
jest.setTimeout(15000);

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
