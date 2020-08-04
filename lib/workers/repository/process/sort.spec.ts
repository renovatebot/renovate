import { UpdateType } from '../../../config';
import { sortBranches } from './sort';

describe('workers/repository/process/sort', () => {
  describe('sortBranches()', () => {
    it('sorts based on updateType and prTitle', () => {
      const branches = [
        {
          updateTypes: ['major' as UpdateType],
          prTitle: 'some major update',
        },
        {
          updateTypes: ['pin' as UpdateType],
          prTitle: 'some pin',
        },
        {
          updateTypes: ['pin' as UpdateType],
          prTitle: 'some other pin',
        },
        {
          updateTypes: ['minor' as UpdateType],
          prTitle: 'a minor update',
        },
      ];
      sortBranches(branches);
      expect(branches).toMatchSnapshot();
    });
    it('sorts based on prPriority', () => {
      const branches = [
        {
          updateTypes: ['major' as UpdateType],
          prTitle: 'some major update',
          prPriority: 1,
        },
        {
          updateTypes: ['pin' as UpdateType],
          prTitle: 'some pin',
          prPriority: -1,
        },
        {
          updateTypes: ['pin' as UpdateType],
          prTitle: 'some other pin',
          prPriority: 0,
        },
        {
          updateTypes: ['minor' as UpdateType],
          prTitle: 'a minor update',
          prPriority: -1,
        },
      ];
      sortBranches(branches);
      expect(branches).toMatchSnapshot();
    });
  });
});
