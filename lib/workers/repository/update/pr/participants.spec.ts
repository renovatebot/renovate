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
  });

  describe('assignees', () => {
    it('does not assignees when there are none', async () => {
      await addParticipants({ ...config, assignees: undefined }, pr);
      expect(platform.addAssignees).not.toHaveBeenCalled();
    });

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

    it('expands group code owners assignees', async () => {
      codeOwners.codeOwnersForPr.mockResolvedValueOnce([
        'user',
        '@group',
        'u@email.com',
      ]);
      platform.expandGroupMembers = jest
        .fn()
        .mockResolvedValueOnce(['u@email.com', 'user', 'group.user']);
      await addParticipants(
        {
          ...config,
          assigneesFromCodeOwners: true,
          expandCodeOwnersGroups: true,
        },
        pr,
      );
      expect(platform.expandGroupMembers).toHaveBeenCalledWith([
        'user',
        '@group',
        'u@email.com',
      ]);
      expect(codeOwners.codeOwnersForPr).toHaveBeenCalledOnce();
      expect(platform.addAssignees).toHaveBeenCalledWith(123, [
        'a',
        'b',
        'c',
        'u@email.com',
        'user',
        'group.user',
      ]);
    });

    it('does not expand group code owners assignees when assigneesFromCodeOwners disabled', async () => {
      codeOwners.codeOwnersForPr.mockResolvedValueOnce(['user', '@group']);
      platform.expandGroupMembers = jest
        .fn()
        .mockResolvedValueOnce(['user', 'group.user']);
      await addParticipants(config, pr);
      expect(codeOwners.codeOwnersForPr).not.toHaveBeenCalled();
      expect(platform.expandGroupMembers).not.toHaveBeenCalled();
      expect(platform.addAssignees).toHaveBeenCalledWith(123, ['a', 'b', 'c']);
    });

    it('does not expand group code owners assignees when expandCodeOwnersGroups disabled', async () => {
      codeOwners.codeOwnersForPr.mockResolvedValueOnce(['user', '@group']);
      platform.expandGroupMembers = jest
        .fn()
        .mockResolvedValueOnce(['user', 'group.user']);
      await addParticipants({ ...config, assigneesFromCodeOwners: true }, pr);
      expect(codeOwners.codeOwnersForPr).toHaveBeenCalledOnce();
      expect(platform.expandGroupMembers).not.toHaveBeenCalled();
      expect(platform.addAssignees).toHaveBeenCalledWith(123, [
        'a',
        'b',
        'c',
        'user',
        'group',
      ]);
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
      GlobalConfig.set({ dryRun: 'full' });
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
    it('does not assignees when there are none', async () => {
      await addParticipants({ ...config, reviewers: undefined }, pr);
      expect(platform.addReviewers).not.toHaveBeenCalled();
    });

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
      GlobalConfig.set({ dryRun: 'full' });
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
        pr,
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
