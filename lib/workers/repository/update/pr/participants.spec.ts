import { partial, platform } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import type { RenovateConfig } from '../../../../config/types.ts';
import type { Pr } from '../../../../modules/platform/types.ts';
import * as _util from '../../../../util/sample.ts';
import * as _codeOwners from './code-owners.ts';
import { addParticipants } from './participants.ts';

vi.mock('../../../../util/sample.ts');
const util = vi.mocked(_util);

vi.mock('./code-owners.ts');
const codeOwners = vi.mocked(_codeOwners);

describe('workers/repository/update/pr/participants', () => {
  // oxlint-disable-next-line renovate/prefer-partial-in-specs -- assigneesSampleSize/reviewersSampleSize intentionally set to null, which the type does not allow, to simulate an unset value
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
      expect(platform.addAssignees).toHaveBeenCalledExactlyOnceWith(123, [
        'a',
        'b',
        'c',
      ]);
    });

    it('filters assignees', async () => {
      platform.filterUnavailableUsers = vi
        .fn()
        .mockResolvedValueOnce(['a', 'b']);
      await addParticipants({ ...config, filterUnavailableUsers: true }, pr);
      expect(platform.addAssignees).toHaveBeenCalledExactlyOnceWith(123, [
        'a',
        'b',
      ]);
    });

    it('adds nothing when filtering leaves no assignee', async () => {
      platform.filterUnavailableUsers = vi.fn().mockResolvedValueOnce([]);

      await addParticipants({ ...config, filterUnavailableUsers: true }, pr);

      expect(platform.addAssignees).not.toHaveBeenCalled();
    });

    it('expands group code owners assignees', async () => {
      codeOwners.codeOwnersForPr.mockResolvedValueOnce([
        'user',
        '@group',
        'u@email.com',
      ]);
      platform.expandGroupMembers = vi
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
      expect(platform.expandGroupMembers).toHaveBeenCalledExactlyOnceWith([
        'user',
        '@group',
        'u@email.com',
      ]);
      expect(codeOwners.codeOwnersForPr).toHaveBeenCalledExactlyOnceWith({
        number: 123,
      });
      expect(platform.addAssignees).toHaveBeenCalledExactlyOnceWith(123, [
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
      platform.expandGroupMembers = vi
        .fn()
        .mockResolvedValueOnce(['user', 'group.user']);
      await addParticipants(config, pr);
      expect(codeOwners.codeOwnersForPr).not.toHaveBeenCalled();
      expect(platform.expandGroupMembers).not.toHaveBeenCalled();
      expect(platform.addAssignees).toHaveBeenCalledExactlyOnceWith(123, [
        'a',
        'b',
        'c',
      ]);
    });

    it('does not expand group code owners assignees when expandCodeOwnersGroups disabled', async () => {
      codeOwners.codeOwnersForPr.mockResolvedValueOnce(['user', '@group']);
      platform.expandGroupMembers = vi
        .fn()
        .mockResolvedValueOnce(['user', 'group.user']);
      await addParticipants({ ...config, assigneesFromCodeOwners: true }, pr);
      expect(codeOwners.codeOwnersForPr).toHaveBeenCalledExactlyOnceWith({
        number: 123,
      });
      expect(platform.expandGroupMembers).not.toHaveBeenCalled();
      expect(platform.addAssignees).toHaveBeenCalledExactlyOnceWith(123, [
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
      expect(platform.addAssignees).toHaveBeenCalledExactlyOnceWith(123, [
        'a',
        'c',
      ]);
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
      expect(platform.addAssignees).toHaveBeenCalledExactlyOnceWith(123, [
        'a',
        'b',
        'c',
        'foo',
        'bar',
        'baz',
      ]);
    });

    it('supports excludeAssignees', async () => {
      await addParticipants({ ...config, excludeAssignees: ['@a', 'c'] }, pr);
      expect(platform.addAssignees).toHaveBeenCalledExactlyOnceWith(123, ['b']);
    });

    it('excludes assignees from code owners', async () => {
      codeOwners.codeOwnersForPr.mockResolvedValueOnce(['foo', '@bot', 'baz']);
      await addParticipants(
        {
          ...config,
          assigneesFromCodeOwners: true,
          excludeAssignees: ['bot'],
        },
        pr,
      );
      expect(platform.addAssignees).toHaveBeenCalledExactlyOnceWith(123, [
        'a',
        'b',
        'c',
        'foo',
        'baz',
      ]);
    });

    it('samples assignees after exclusion', async () => {
      util.sampleSize.mockReturnValueOnce(['b']);
      await addParticipants(
        { ...config, excludeAssignees: ['a'], assigneesSampleSize: 1 },
        pr,
      );
      expect(util.sampleSize).toHaveBeenCalledExactlyOnceWith(['b', 'c'], 1);
      expect(platform.addAssignees).toHaveBeenCalledExactlyOnceWith(123, ['b']);
    });

    it('adds no assignees when all are excluded', async () => {
      await addParticipants(
        { ...config, excludeAssignees: ['a', 'b', 'c'] },
        pr,
      );
      expect(platform.addAssignees).not.toHaveBeenCalled();
    });
  });

  describe('reviewers', () => {
    it('does not assignees when there are none', async () => {
      await addParticipants({ ...config, reviewers: undefined }, pr);
      expect(platform.addReviewers).not.toHaveBeenCalled();
    });

    it('adds reviewers', async () => {
      await addParticipants(config, pr);
      expect(platform.addReviewers).toHaveBeenCalledExactlyOnceWith(123, [
        'x',
        'y',
        'z',
      ]);
    });

    it('handles add assignee errors', async () => {
      platform.addReviewers.mockRejectedValueOnce('Unknown error');
      await expect(addParticipants(config, pr)).not.toReject();
    });

    it('supports reviewersSampleSize', async () => {
      util.sampleSize.mockReturnValueOnce(['x', 'z']);
      await addParticipants({ ...config, reviewersSampleSize: 2 }, pr);
      expect(platform.addReviewers).toHaveBeenCalledExactlyOnceWith(123, [
        'x',
        'z',
      ]);
    });

    it('supports dry run assignee adding', async () => {
      GlobalConfig.set({ dryRun: 'full' });
      await addParticipants(config, pr);
      expect(platform.addReviewers).not.toHaveBeenCalled();
    });

    it('supports reviewersFromCodeOwners', async () => {
      codeOwners.codeOwnersForPr.mockResolvedValueOnce(['foo', 'bar', 'baz']);
      await addParticipants({ ...config, reviewersFromCodeOwners: true }, pr);
      expect(platform.addReviewers).toHaveBeenCalledExactlyOnceWith(123, [
        'x',
        'y',
        'z',
        'foo',
        'bar',
        'baz',
      ]);
    });

    it('filters out bare @ from malformed CODEOWNERS entries', async () => {
      codeOwners.codeOwnersForPr.mockResolvedValueOnce([
        '@UserOne',
        '@UserTwo',
        '@',
      ]);
      await addParticipants(
        { ...config, reviewers: [], reviewersFromCodeOwners: true },
        pr,
      );
      expect(platform.addReviewers).toHaveBeenCalledExactlyOnceWith(123, [
        'UserOne',
        'UserTwo',
      ]);
    });

    it('supports additionalReviewers', async () => {
      await addParticipants(
        { ...config, additionalReviewers: ['foo', 'bar', 'baz'] },
        pr,
      );
      expect(platform.addReviewers).toHaveBeenCalledExactlyOnceWith(123, [
        'x',
        'y',
        'z',
        'foo',
        'bar',
        'baz',
      ]);
    });

    it('supports excludeReviewers', async () => {
      await addParticipants({ ...config, excludeReviewers: ['@x', 'z'] }, pr);
      expect(platform.addReviewers).toHaveBeenCalledExactlyOnceWith(123, ['y']);
    });

    it('excludes reviewers from code owners', async () => {
      codeOwners.codeOwnersForPr.mockResolvedValueOnce(['foo', '@bot', 'baz']);
      await addParticipants(
        {
          ...config,
          reviewersFromCodeOwners: true,
          excludeReviewers: ['bot'],
        },
        pr,
      );
      expect(platform.addReviewers).toHaveBeenCalledExactlyOnceWith(123, [
        'x',
        'y',
        'z',
        'foo',
        'baz',
      ]);
    });

    it('excludes additionalReviewers', async () => {
      await addParticipants(
        {
          ...config,
          additionalReviewers: ['foo', 'bar'],
          excludeReviewers: ['bar'],
        },
        pr,
      );
      expect(platform.addReviewers).toHaveBeenCalledExactlyOnceWith(123, [
        'x',
        'y',
        'z',
        'foo',
      ]);
    });

    it('samples reviewers after exclusion', async () => {
      util.sampleSize.mockReturnValueOnce(['y']);
      await addParticipants(
        { ...config, excludeReviewers: ['x'], reviewersSampleSize: 1 },
        pr,
      );
      expect(util.sampleSize).toHaveBeenCalledExactlyOnceWith(['y', 'z'], 1);
      expect(platform.addReviewers).toHaveBeenCalledExactlyOnceWith(123, ['y']);
    });

    it('adds no reviewers when all are excluded', async () => {
      await addParticipants(
        { ...config, excludeReviewers: ['x', 'y', 'z'] },
        pr,
      );
      expect(platform.addReviewers).not.toHaveBeenCalled();
    });
  });
});
