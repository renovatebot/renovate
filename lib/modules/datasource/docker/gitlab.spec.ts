import * as httpMock from '~test/http-mock.ts';
import { getGitlabTagTimestamps } from './gitlab.ts';

function repositoriesPath(projectPath: string): string {
  return `/api/v4/projects/${encodeURIComponent(projectPath)}/registry/repositories?per_page=100`;
}

function tagsPage(
  nodes: { name: string; publishedAt: string | null }[],
  endCursor: string | null = null,
) {
  return {
    data: {
      containerRepository: {
        tags: {
          pageInfo: { hasNextPage: endCursor !== null, endCursor },
          nodes,
        },
      },
    },
  };
}

describe('modules/datasource/docker/gitlab', () => {
  it('returns publish times of registry.gitlab.com tags via gitlab.com', async () => {
    httpMock
      .scope('https://gitlab.com')
      .get(repositoriesPath('group/project'))
      .reply(200, [
        { id: 1, path: 'group/project/other' },
        { id: 2, path: 'group/project' },
      ])
      .post('/api/graphql', (body) => {
        return (
          body.query.includes('sort: PUBLISHED_AT_DESC') &&
          body.variables.id === 'gid://gitlab/ContainerRepository/2' &&
          body.variables.after === null
        );
      })
      .reply(
        200,
        tagsPage([
          { name: '1.0.0', publishedAt: '2026-01-01T00:00:00+00:00' },
          { name: 'latest', publishedAt: null },
        ]),
      );

    const res = await getGitlabTagTimestamps({
      registryHost: 'https://registry.gitlab.com',
      dockerRepository: 'group/project',
    });

    expect(res).toEqual(new Map([['1.0.0', '2026-01-01T00:00:00.000Z']]));
  });

  it('finds images nested below their project, using registryApiUrl', async () => {
    httpMock
      .scope('https://gitlab.example.com')
      .get(repositoriesPath('group/project/image'))
      .reply(404)
      .get(repositoriesPath('group/project'))
      .reply(200, [{ id: 7, path: 'group/project/image' }])
      .post('/api/graphql')
      .reply(
        200,
        tagsPage(
          [{ name: '1.0.0', publishedAt: '2026-01-01T00:00:00Z' }],
          'cursor-1',
        ),
      )
      .post('/api/graphql', (body) => body.variables.after === 'cursor-1')
      .reply(
        200,
        tagsPage([{ name: '2.0.0', publishedAt: '2026-02-01T00:00:00Z' }]),
      );

    const res = await getGitlabTagTimestamps({
      registryHost: 'https://registry.example.com',
      dockerRepository: 'group/project/image',
      registryApiUrl: 'https://gitlab.example.com/api/v4',
    });

    expect(res).toEqual(
      new Map([
        ['1.0.0', '2026-01-01T00:00:00.000Z'],
        ['2.0.0', '2026-02-01T00:00:00.000Z'],
      ]),
    );
  });

  it('defaults the API to the registry host', async () => {
    httpMock
      .scope('https://gitlab.example.com')
      .get(repositoriesPath('group/project'))
      .reply(200, [{ id: 3, path: 'group/project' }])
      .post('/api/graphql')
      .reply(200, { data: { containerRepository: null } });

    const res = await getGitlabTagTimestamps({
      registryHost: 'https://gitlab.example.com',
      dockerRepository: 'group/project',
    });

    expect(res).toEqual(new Map());
  });

  it('returns null when no container repository matches', async () => {
    httpMock
      .scope('https://gitlab.com')
      .get(repositoriesPath('group/project'))
      .reply(200, [{ id: 1, path: 'group/project/other' }]);

    const res = await getGitlabTagTimestamps({
      registryHost: 'https://registry.gitlab.com',
      dockerRepository: 'group/project',
    });

    expect(res).toBeNull();
  });
});
