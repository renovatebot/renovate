import {mocked} from '../../../../test/util';
import {CONFIG_GIT_URL_UNAVAILABLE} from '../../../constants/error-messages';
import * as _hostRules from '../../../util/host-rules';
import {hashBody} from '../pr-body';
import type {SpaceMergeRequestRecord,} from './types';
import * as utils from './utils';

jest.mock('../../../util/host-rules');

const hostRules = mocked(_hostRules);

describe('modules/platform/space/utils', () => {
  describe('getSpaceRepoUrl()', () => {
    const repoName = 'main/my-repo'
    const orgName = 'my-org'
    const endpoint = `${orgName}.jetbrains.space`
    it('create a git url with token', () => {

      const token = 'my-secret-token'
      hostRules.find.mockReturnValue({
        token
      });

      const repoUrl = utils.getSpaceRepoUrl(repoName, endpoint);
      expect(repoUrl).toBe(`https://username-doesnt-matter:${token}@git.jetbrains.space/${orgName}/${repoName}`);
    });

    it('fails to create a repo url without token', () => {
      hostRules.find.mockReturnValue({});
      expect(() => utils.getSpaceRepoUrl(repoName, endpoint)).toThrow(
        'Init: You must configure a JetBrains Space token',
      );
    });

    it('throws on invalid endpoint', () => {
      expect(() => utils.getSpaceRepoUrl(repoName, '...')).toThrow(
        Error(CONFIG_GIT_URL_UNAVAILABLE),
      );
    });

    it('throws on invalid repo name', () => {
      expect(() => utils.getSpaceRepoUrl('bla', endpoint)).toThrow(
        Error('Init: repository name must include project key, like my-project/my-repo (default project key is "main")'),
      );
    });
  });

  describe('mapSpaceCodeReviewDetailsToPr()', () => {
    it('map a space code review to to Pr', () => {
      const title = 'My opened PR'
      const sourceBranch = 'renovate/dependency-1.x'
      const targetBranch = 'main'

      const record: SpaceMergeRequestRecord = {
        title,
        branchPairs: [{sourceBranch, targetBranch}],
        createdAt: 0,
        id: "1357",
        number: 123456,
        state: "Opened",
      }

      const body = 'my opened pr description'

      expect(utils.mapSpaceCodeReviewDetailsToPr(record, body)).toEqual({
        number: 123456,
        state: 'open',
        title,
        sourceBranch,
        targetBranch,
        bodyStruct: {
          hash: hashBody(body),
        },
      });
    });
  });
});
