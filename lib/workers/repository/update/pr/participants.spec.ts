import { mocked, partial, platform } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import type { Pr } from '../../../../modules/platform/types';
import * as _util from '../../../../util/sample';
import * as _codeOwners from './code-owners';
import { addParticipants } from './participants';

jest.mock('../../../../util/sample');
const util = mocked(_util);

jest.mock('./code-owners');
const codeOwners = mocked(_codeOwners);

describe('workers/repository/update/pr/participants', () => {
  const config: RenovateConfig = {
    assignees: ['a', 'b', '@c'],
    reviewers: ['x', 'y', '@z'],
    additionalReviewers: [],
    assigneesSampleSize: null,
    reviewersSampleSize: null,
  } as never;

  const pr = partial<Pr>({ number: 123 });

  beforeEach(() => {
    GlobalConfig.reset();
    jest.resetAllMocks();
  });

  describe('assignees', () => {
    it('adds assignees', async () => {
      await addParticipants(config, pr);
      expect(platform.addAssignees).toHaveBeenCalledWith(123, ['a', 'b', 'c']);
    });

    it('filters assignees', async () => {
      platform.filterUnavailableUsers = jest
        .fn()
        .mockResolvedValueOnce(['a', 'b']);
      await addParticipants({ ...config, filterUnavailableUsers: true }, pr);
      expect(platform.addAssignees).toHaveBeenCalledWith(123, ['a', 'b']);
    });

    it('supports assigneesSampleSize', async () => {
      util.sampleSize.mockReturnValueOnce(['a', 'c']);
      await addParticipants({ ...config, assigneesSampleSize: 2 }, pr);
      expect(platform.addAssignees).toHaveBeenCalledWith(123, ['a', 'c']);
    });

    it('handles add assignee errors', async () => {
      platform.addAssignees.mockRejectedValueOnce('Unknown error');
      await expect(addParticipants(config, pr)).not.toReject();
    });

    it('supports dry run assignee adding', async () => {
      GlobalConfig.set({ dryRun: true });
      await addParticipants(config, pr);
      expect(platform.addAssignees).not.toHaveBeenCalled();
    });

    it('supports assigneesFromCodeOwners', async () => {
      codeOwners.codeOwnersForPr.mockResolvedValueOnce(['foo', 'bar', 'baz']);
      await addParticipants({ ...config, assigneesFromCodeOwners: true }, pr);
      expect(platform.addAssignees).toHaveBeenCalledWith(123, [
        'a',
        'b',
        'c',
        'foo',
        'bar',
        'baz',
      ]);
    });
  });

  describe('reviewers', () => {
    it('adds reviewers', async () => {
      await addParticipants(config, pr);
      expect(platform.addReviewers).toHaveBeenCalledWith(123, ['x', 'y', 'z']);
    });

    it('handles add assignee errors', async () => {
      platform.addReviewers.mockRejectedValueOnce('Unknown error');
      await expect(addParticipants(config, pr)).not.toReject();
    });

    it('supports reviewersSampleSize', async () => {
      util.sampleSize.mockReturnValueOnce(['x', 'z']);
      await addParticipants({ ...config, reviewersSampleSize: 2 }, pr);
      expect(platform.addReviewers).toHaveBeenCalledWith(123, ['x', 'z']);
    });

    it('supports dry run assignee adding', async () => {
      GlobalConfig.set({ dryRun: true });
      await addParticipants(config, pr);
      expect(platform.addReviewers).not.toHaveBeenCalled();
    });

    it('supports reviewersFromCodeOwners', async () => {
      codeOwners.codeOwnersForPr.mockResolvedValueOnce(['foo', 'bar', 'baz']);
      await addParticipants({ ...config, reviewersFromCodeOwners: true }, pr);
      expect(platform.addReviewers).toHaveBeenCalledWith(123, [
        'x',
        'y',
        'z',
        'foo',
        'bar',
        'baz',
      ]);
    });

    it('supports additionalReviewers', async () => {
      await addParticipants(
        { ...config, additionalReviewers: ['foo', 'bar', 'baz'] },
        pr
      );
      expect(platform.addReviewers).toHaveBeenCalledWith(123, [
        'x',
        'y',
        'z',
        'foo',
        'bar',
        'baz',
      ]);
    });
  });
});
