import { DockerDatasource } from '../../../datasource/docker/index.ts';
import { dockerActions } from './docker.ts';

describe('modules/manager/github-actions/known-actions/docker', () => {
  it('uses the docker datasource for every entry', () => {
    for (const cfg of Object.values(dockerActions)) {
      expect(cfg.datasource).toBe(DockerDatasource.id);
    }
  });
});
