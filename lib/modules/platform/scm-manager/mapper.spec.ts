import { mapPrFromScmToRenovate } from './mapper.ts';
import type { PrState, PullRequest } from './schema.ts';

describe('modules/platform/scm-manager/mapper', () => {
  it.each`
    scmPrState    | renovatePrState | expectedIsDraft
    ${'OPEN'}     | ${'open'}       | ${false}
    ${'DRAFT'}    | ${'open'}       | ${true}
    ${'REJECTED'} | ${'closed'}     | ${false}
    ${'MERGED'}   | ${'merged'}     | ${false}
  `(
    'should correctly map the scm-manager type of a PR with the $scmPrState to the Renovate PR type',
    ({
      scmPrState,
      renovatePrState,
      expectedIsDraft,
    }: {
      scmPrState: PrState;
      renovatePrState: string;
      expectedIsDraft: boolean;
    }) => {
      const scmPr: PullRequest = {
        source: 'feat/new',
        target: 'develop',
        creationDate: '2024-12-24T18:21Z',
        closeDate: '2024-12-25T18:21Z',
        reviewer: [
          {
            id: 'id',
            displayName: 'user',
            mail: 'user@user.de',
            approved: true,
          },
        ],
        labels: ['label'],
        id: '1',
        status: scmPrState,
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
        state: renovatePrState,
        title: 'Merge please',
        isDraft: expectedIsDraft,
      });
    },
  );
});
