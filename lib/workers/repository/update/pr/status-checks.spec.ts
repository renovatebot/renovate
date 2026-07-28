import { partial } from '~test/util.ts';
import type { BranchConfig } from '../../../types.ts';
import {
  type PrCreationStatusRequirement,
  getPrCreationStatusRequirement,
} from './status-checks.ts';

type TestCase = [
  prCreation: NonNullable<BranchConfig['prCreation']>,
  ignoreTests: boolean,
  forcePr: boolean,
  approvePr: boolean,
  expected: PrCreationStatusRequirement | null,
];

describe('workers/repository/update/pr/status-checks', () => {
  const config = partial<BranchConfig>({
    branchName: 'renovate/test',
  });

  it.each([
    ['immediate', false, false, false, null],
    ['immediate', false, false, true, null],
    ['immediate', false, true, false, null],
    ['immediate', false, true, true, null],
    ['immediate', true, false, false, null],
    ['immediate', true, false, true, null],
    ['immediate', true, true, false, null],
    ['immediate', true, true, true, null],
    ['approval', false, false, false, null],
    ['approval', false, false, true, null],
    ['approval', false, true, false, null],
    ['approval', false, true, true, null],
    ['approval', true, false, false, null],
    ['approval', true, false, true, null],
    ['approval', true, true, false, null],
    ['approval', true, true, true, null],
    ['not-pending', false, false, false, 'not-pending'],
    ['not-pending', false, false, true, null],
    ['not-pending', false, true, false, null],
    ['not-pending', false, true, true, null],
    ['not-pending', true, false, false, null],
    ['not-pending', true, false, true, null],
    ['not-pending', true, true, false, null],
    ['not-pending', true, true, true, null],
    ['status-success', false, false, false, 'green'],
    ['status-success', false, false, true, 'green'],
    ['status-success', false, true, false, 'green'],
    ['status-success', false, true, true, 'green'],
    ['status-success', true, false, false, null],
    ['status-success', true, false, true, null],
    ['status-success', true, true, false, null],
    ['status-success', true, true, true, null],
  ] satisfies TestCase[])(
    'handles prCreation=%s, ignoreTests=%s, forcePr=%s, approvePr=%s',
    (prCreation, ignoreTests, forcePr, approvePr, expected) => {
      expect(
        getPrCreationStatusRequirement({
          ...config,
          dependencyDashboardChecks: approvePr
            ? { 'renovate/test': 'approvePr' }
            : undefined,
          forcePr,
          ignoreTests,
          prCreation,
        }),
      ).toBe(expected);
    },
  );

  it('allows not-pending PR creation when artifact errors exist', () => {
    expect(
      getPrCreationStatusRequirement({
        ...config,
        artifactErrors: [{}],
        prCreation: 'not-pending',
      }),
    ).toBeNull();
  });
});
