import { DockerDatasource } from '../../../datasource/docker/index.ts';
import { dockerDynamicActions } from './docker-dynamic.ts';

describe('modules/manager/github-actions/known-actions/docker-dynamic', () => {
  it('uses the docker datasource for every entry', () => {
    for (const cfg of Object.values(dockerDynamicActions)) {
      expect(cfg.datasource).toBe(DockerDatasource.id);
    }
  });
});
