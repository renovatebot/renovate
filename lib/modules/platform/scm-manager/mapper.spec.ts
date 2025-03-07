import { mapPrFromScmToRenovate } from './mapper';
import type { PullRequest } from './schema';

describe('modules/platform/scm-manager/mapper', () => {
  it('should correctly map the scm-manager type of a PR to the Renovate PR type', () => {
    const scmPr: PullRequest = {
      source: 'feat/new',
      target: 'develop',
      creationDate: '2024-12-24T18:21Z',
      closeDate: '2024-12-25T18:21Z',
      reviewer: [
        { id: 'id', displayName: 'user', mail: 'user@user.de', approved: true },
      ],
      labels: ['label'],
      id: '1',
      status: 'OPEN',
      title: 'Merge please',
      description: 'Description',
      tasks: { todo: 0, done: 0 },
      _links: {},
      _embedded: {
        defaultConfig: {
          mergeStrategy: 'SQUASH',
          deleteBranchOnMerge: true,
        },
      },
    };

    const result = mapPrFromScmToRenovate(scmPr);
    expect(result).toEqual({
      sourceBranch: 'feat/new',
      targetBranch: 'develop',
      createdAt: '2024-12-24T18:21Z',
      closedAt: '2024-12-25T18:21Z',
      hasAssignees: true,
      labels: ['label'],
      number: 1,
      reviewers: ['user'],
      state: 'OPEN',
      title: 'Merge please',
      isDraft: false,
    });
  });
});
