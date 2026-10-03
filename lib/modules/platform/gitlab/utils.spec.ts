import type { HttpResponse } from '../../../util/http/types.ts';
import type { RepoResponse } from './types.ts';
import { defaults, getRepoUrl } from './utils.ts';

function makeRes(
  overrides: Partial<RepoResponse> = {},
): HttpResponse<RepoResponse> {
  return {
    statusCode: 200,
    headers: {},
    body: {
      id: 1,
      archived: false,
      mirror: false,
      default_branch: 'main',
      empty_repo: false,
      ssh_url_to_repo: null,
      http_url_to_repo: null,
      forked_from_project: false,
      repository_access_level: 'enabled',
      merge_requests_access_level: 'enabled',
      merge_method: 'merge',
      path_with_namespace: 'group/repo',
      ...overrides,
    },
  };
}

describe('modules/platform/gitlab/utils', () => {
  describe('getRepoUrl()', () => {
    let savedEndpoint: string;

    beforeEach(() => {
      savedEndpoint = defaults.endpoint;
      defaults.endpoint = 'not-a-valid-url';
    });

    afterEach(() => {
      defaults.endpoint = savedEndpoint;
    });

    it('throws on invalid endpoint when gitUrl is endpoint', () => {
      expect(() => getRepoUrl('group/repo', 'endpoint', makeRes())).toThrow(
        'Invalid GitLab endpoint: not-a-valid-url',
      );
    });

    it('uses the configured endpoint instead of the returned repository URL', () => {
      defaults.endpoint = 'https://gitlab.example.com/api/v4/';
      hostRules.add({
        hostType: 'gitlab',
        matchHost: 'gitlab.example.com',
        token: 'test-token',
      });
      const res = makeRes({
        http_url_to_repo: 'https://other.example.com/group/repo.git',
      });

      expect(getRepoUrl('group/repo', 'endpoint', res)).toBe(
        'https://oauth2:test-token@gitlab.example.com/group/repo.git',
      );
    });

    it('throws on invalid endpoint when http_url_to_repo is null', () => {
      expect(() =>
        getRepoUrl(
          'group/repo',
          undefined,
          makeRes({ http_url_to_repo: null }),
        ),
      ).toThrow('Invalid GitLab endpoint: not-a-valid-url');
    });
  });
});

import * as hostRules from '../../../util/host-rules.ts';
