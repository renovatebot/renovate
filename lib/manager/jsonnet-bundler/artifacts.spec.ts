import { join } from 'upath';
import { setGlobalConfig } from '../../config/global';
import { RepoGlobalConfig } from '../../config/types';
import * as docker from '../../util/exec/docker';
import { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from '.';

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
};
const config: UpdateArtifactsConfig = {};

describe('manager/jsonnet-bundler/artifacts', () => {
  beforeEach(() => {

    docker.resetPrefetchedImages();

    setGlobalConfig(adminConfig);
  });

  it('returns null if no jsonnetfile.lock found', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'jsonnetfile.json',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });
});
