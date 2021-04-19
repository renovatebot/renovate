import { getName } from '../../../../test/util';
import type { UpdateType } from '../../../config/types';
import { sortBranches } from './sort';

describe(getName(__filename), () => {
  describe('sortBranches()', () => {
    it('sorts based on updateType and prTitle', () => {
      const branches = [
        {
          updateType: 'major' as UpdateType,
          prTitle: 'some major update',
        },
        {
          updateType: 'pin' as UpdateType,
          prTitle: 'some pin',
        },
        {
          updateType: 'pin' as UpdateType,
          prTitle: 'some other pin',
        },
        {
          updateType: 'minor' as UpdateType,
          prTitle: 'a minor update',
        },
      ];
      sortBranches(branches);
      expect(branches).toMatchSnapshot();
    });
    it('sorts based on prPriority', () => {
      const branches = [
        {
          updateType: 'major' as UpdateType,
          prTitle: 'some major update',
          prPriority: 1,
        },
        {
          updateType: 'pin' as UpdateType,
          prTitle: 'some pin',
          prPriority: -1,
        },
        {
          updateType: 'pin' as UpdateType,
          prTitle: 'some other pin',
          prPriority: 0,
        },
        {
          updateType: 'minor' as UpdateType,
          prTitle: 'a minor update',
          prPriority: -1,
        },
      ];
      sortBranches(branches);
      expect(branches).toMatchSnapshot();
    });
    it('sorts based on isVulnerabilityAlert', () => {
      const branches = [
        {
          updateType: 'major' as UpdateType,
          prTitle: 'some major update',
          prPriority: 1,
        },
        {
          updateType: 'pin' as UpdateType,
          prTitle: 'some pin',
          prPriority: -1,
        },
        {
          updateType: 'pin' as UpdateType,
          prTitle: 'some other pin',
          prPriority: 0,
        },
        {
          updateType: 'minor' as UpdateType,
          prTitle: 'a minor update',
          prPriority: -1,
          isVulnerabilityAlert: true,
        },
      ];
      sortBranches(branches);
      expect(branches).toMatchSnapshot();
    });
  });
});
