import { mocked } from '../../../../test/util';
import { CONFIG_GIT_URL_UNAVAILABLE } from '../../../constants/error-messages';
import * as _hostRules from '../../../util/host-rules';
import { hashBody } from '../pr-body';
import type { SpaceMergeRequestRecord } from './types';
import * as utils from './utils';
import { flatten, mapNotNullFlatten } from './utils';

jest.mock('../../../util/host-rules');

const hostRules = mocked(_hostRules);

describe('modules/platform/space/utils', () => {
  describe('getSpaceRepoUrl()', () => {
    const repoName = 'main/my-repo';
    const orgName = 'my-org';
    const endpoint = `${orgName}.jetbrains.space`;

    it('create a git url with token', () => {
      const token = 'my-secret-token';
      hostRules.find.mockReturnValue({
        token,
      });

      const repoUrl = utils.getSpaceRepoUrl(repoName, endpoint);
      expect(repoUrl).toBe(
        `https://username-doesnt-matter:${token}@git.jetbrains.space/${orgName}/${repoName}`,
      );
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
        Error(
          'Init: repository name must include project key, like my-project/my-repo (default project key is "main")',
        ),
      );
    });
  });

  describe('mapSpaceCodeReviewDetailsToPr()', () => {
    it('map a space code review to to Pr', () => {
      const title = 'My opened PR';
      const sourceBranch = 'renovate/dependency-1.x';
      const targetBranch = 'main';

      const record: SpaceMergeRequestRecord = {
        title,
        branchPairs: [{ sourceBranch, targetBranch }],
        createdAt: 0,
        id: '1357',
        number: 123456,
        state: 'Opened',
      };

      const body = 'my opened pr description';

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

  describe('AsyncIterator', () => {
    it('should map not null and flatten', async () => {
      const valueToSkip = 'valueToSkip';
      const valueToKeep1 = 'valueToKeep1';
      const valueToKeep2 = 'valueToKeep2';

      const prefix = 'my-prefix-';

      const iterable = new TestIterable([
        [valueToSkip],
        [valueToKeep1],
        [valueToKeep2],
      ]);
      const result = await mapNotNullFlatten(iterable, (it) => {
        if (it === valueToSkip) {
          return Promise.resolve(undefined);
        } else {
          return Promise.resolve(prefix + it);
        }
      });

      expect(result).toEqual([prefix + valueToKeep1, prefix + valueToKeep2]);
    });

    it('should flatten', async () => {
      const value1 = 'value1';
      const value2 = 'value2';
      const iterable = new TestIterable([[value1], [value2]]);

      const actual = await flatten(iterable);
      expect(actual).toEqual([value1, value2]);
    });
  });
});

class TestIterable implements AsyncIterable<string[]> {
  constructor(private data: string[][]) {}

  [Symbol.asyncIterator](): AsyncIterator<string[]> {
    const it = this.data.values();
    return {
      next(): Promise<IteratorResult<string[]>> {
        return Promise.resolve(it.next());
      },
    };
  }
}
