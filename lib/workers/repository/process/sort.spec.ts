import type { UpdateType } from '../../../config/types';
import { sortBranches } from './sort';

describe('workers/repository/process/sort', () => {
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
      expect(branches).toEqual([
        { prTitle: 'some other pin', updateType: 'pin' },
        { prTitle: 'some pin', updateType: 'pin' },
        { prTitle: 'a minor update', updateType: 'minor' },
        { prTitle: 'some major update', updateType: 'major' },
      ]);
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
      expect(branches).toEqual([
        { prPriority: 1, prTitle: 'some major update', updateType: 'major' },
        { prPriority: 0, prTitle: 'some other pin', updateType: 'pin' },
        { prPriority: -1, prTitle: 'some pin', updateType: 'pin' },
        { prPriority: -1, prTitle: 'a minor update', updateType: 'minor' },
      ]);
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
      expect(branches).toEqual([
        {
          isVulnerabilityAlert: true,
          prPriority: -1,
          prTitle: 'a minor update',
          updateType: 'minor',
        },
        { prPriority: 1, prTitle: 'some major update', updateType: 'major' },
        { prPriority: 0, prTitle: 'some other pin', updateType: 'pin' },
        { prPriority: -1, prTitle: 'some pin', updateType: 'pin' },
      ]);
    });

    it('sorts based on isVulnerabilityAlert symmetric', () => {
      const branches = [
        {
          updateType: 'minor' as UpdateType,
          prTitle: 'a minor update',
          prPriority: -1,
          isVulnerabilityAlert: true,
        },
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
      ];
      sortBranches(branches);
      expect(branches).toEqual([
        {
          isVulnerabilityAlert: true,
          prPriority: -1,
          prTitle: 'a minor update',
          updateType: 'minor',
        },
        { prPriority: 1, prTitle: 'some major update', updateType: 'major' },
        { prPriority: 0, prTitle: 'some other pin', updateType: 'pin' },
        { prPriority: -1, prTitle: 'some pin', updateType: 'pin' },
      ]);
    });
  });
});
