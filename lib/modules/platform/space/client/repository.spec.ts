import * as httpMock from '../../../../../test/http-mock';
import {SpaceRepositoryClient} from "./repository";
import {SpaceHttp} from "../../../../util/http/space";


const spaceEndpointUrl = 'https://myorg.jetbrains.space';
const jsonResultHeader = { 'content-type': 'application/json;charset=utf-8' };

describe('modules/platform/space/client/repository', () => {

  const client = new SpaceRepositoryClient(new SpaceHttp(spaceEndpointUrl))

  describe('getAllRepositoriesForAllProjects()', () => {
    it('returns repos', async () => {
      httpMock
        .scope(spaceEndpointUrl)
        .get('/api/http/projects/repositories')
        .reply(
          200,
          {
            next: "2",
            totalCount: 2,
            data: [
              {
                projectKey: 'main',
                repository: 'repo1',
                starred: false
              },
              {
                projectKey: 'main',
                repository: 'repo2',
                starred: false
              }
            ]
          },
          jsonResultHeader,
        );
      expect(await client.getAll()).toEqual(['repo1', 'repo2']);
    });
  });
});
