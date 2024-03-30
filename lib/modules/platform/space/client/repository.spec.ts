import * as httpMock from '../../../../../test/http-mock';
import {SpaceRepositoryClient} from "./repository";
import {SpaceHttp} from "../../../../util/http/space";
import type {SpaceBranchHead, SpaceRepositoryBasicInfo, SpaceRepositoryDetails} from "../types";
import {expect} from "@jest/globals";


const spaceEndpointUrl = 'https://myorg.jetbrains.space';
const jsonResultHeader = { 'content-type': 'application/json;charset=utf-8' };

describe('modules/platform/space/client/repository', () => {

  const client = new SpaceRepositoryClient(new SpaceHttp(spaceEndpointUrl))

  describe('getAll()', () => {
    it('should return repos', async () => {
      const repo1: SpaceRepositoryBasicInfo = {
        projectKey: 'main1',
        repository: 'repo1',
      }
      const repo2: SpaceRepositoryBasicInfo = {
        projectKey: 'main2',
        repository: 'repo2',
      }

      const next1 = 'next1'
      const next2 = 'next2'

      mockRepositoriesPage([repo1], next1)
      mockRepositoriesPage([repo2], next2, next1)
      mockRepositoriesPage([], next2, next2)

      expect(await client.getAll()).toEqual([repo1, repo2]);
    });
  });

  describe('getByName()', () => {
    it('should get repository details', async () => {
      const projectKey = 'test123'
      const repository = 'my-great-repo'

      const expected: SpaceRepositoryDetails = {
        id: "123abcd",
        name: repository,
        description: "my greatest repo",
        defaultBranch: {
          head: "refs/heads/main",
          ref: ""
        }
      }

      httpMock
        .scope(spaceEndpointUrl)
        .get(`/api/http/projects/key:${projectKey}/repositories/${repository}`)
        .reply(
          200,
          expected,
          jsonResultHeader
        )

      const actual = await client.getByName(projectKey, repository)
      expect(actual).toEqual(expected)
    })
  })

  describe('getBranchesHeads()', () => {
    it('should return all branches heads', async () => {
      const projectKey = 'test123'
      const repository = 'my-great-repo'

      const head1: SpaceBranchHead = {
        head: 'refs/heads/head1',
        ref: "ref1"
      }

      const head2: SpaceBranchHead = {
        head: 'refs/heads/head1',
        ref: "ref1"
      }

      const next1 = 'next1'
      const next2 = 'next2'

      mockBranchesHeadsPage(projectKey, repository, [head1], next1)
      mockBranchesHeadsPage(projectKey, repository, [head2], next2, next1)
      mockBranchesHeadsPage(projectKey, repository, [], next2, next2)

      const actual = await client.getBranchesHeads(projectKey, repository)
      expect(actual).toEqual([head1, head2]);
    });
  })

  describe('getFileContent', () => {
    it('should get file content', async () => {
      const line1 = 'this is a first line'
      const line2 = 'this is a second line'

      const projectKey = 'test123'
      const repository = 'my-great-repo'
      const commit = 'HEAD'
      const path = 'path/to/my/file'

      httpMock
        .scope(spaceEndpointUrl)
        .get(`/api/http/projects/key:${projectKey}/repositories/${repository}/text-content?commit=${commit}&path=${path}`)
        .reply(
          200,
          {
            type: 'TEXT',
            lines: [
              {
                text: line1
              },
              {
                text: line2
              }
            ]
          },
          jsonResultHeader
        );

      const actual = await client.getFileContent(projectKey, repository, path, commit);
      expect(actual).toBe(`${line1}\n${line2}`);
    });
  })
});

function mockRepositoriesPage(repos: SpaceRepositoryBasicInfo[], next: string, nextQuery?: string) {
  let path = '/api/http/projects/repositories'
  if (nextQuery) {
    path += `?next=${nextQuery}`
  }

  httpMock
    .scope(spaceEndpointUrl)
    .get(path)
    .reply(
      200,
      {
        next,
        data: repos
      },
      jsonResultHeader,
    );
}

function mockBranchesHeadsPage(projectKey: string, repository: string, heads: SpaceBranchHead[], next: string, nextQuery?: string) {
  let path = `/api/http/projects/key:${projectKey}/repositories/${repository}/heads`
  if (nextQuery) {
    path += `?$skip=${nextQuery}`
  }

  httpMock
    .scope(spaceEndpointUrl)
    .get(path)
    .reply(
      200,
      {
        next,
        data: heads
      },
      jsonResultHeader,
    );
}
