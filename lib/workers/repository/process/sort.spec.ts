import { UpdateType } from '../../../config';
import { sortBranches } from './sort';

describe('workers/repository/process/sort', () => {
  describe('sortBranches()', () => {
    it('sorts based on updateType and prTitle', () => {
      const branches = [
        {
          matchUpdateTypes: ['major' as UpdateType],
          prTitle: 'some major update',
        },
        {
          matchUpdateTypes: ['pin' as UpdateType],
          prTitle: 'some pin',
        },
        {
          matchUpdateTypes: ['pin' as UpdateType],
          prTitle: 'some other pin',
        },
        {
          matchUpdateTypes: ['minor' as UpdateType],
          prTitle: 'a minor update',
        },
      ];
      sortBranches(branches);
      expect(branches).toMatchSnapshot();
    });
    it('sorts based on prPriority', () => {
      const branches = [
        {
          matchUpdateTypes: ['major' as UpdateType],
          prTitle: 'some major update',
          prPriority: 1,
        },
        {
          matchUpdateTypes: ['pin' as UpdateType],
          prTitle: 'some pin',
          prPriority: -1,
        },
        {
          matchUpdateTypes: ['pin' as UpdateType],
          prTitle: 'some other pin',
          prPriority: 0,
        },
        {
          matchUpdateTypes: ['minor' as UpdateType],
          prTitle: 'a minor update',
          prPriority: -1,
        },
      ];
      sortBranches(branches);
      expect(branches).toMatchSnapshot();
    });
  });
});
