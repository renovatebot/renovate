const {
  sortBranches,
} = require('../../../../lib/workers/repository/process/sort');

describe('workers/repository/process/sort', () => {
  describe('sortBranches()', () => {
    it('sorts based on type and prTitle', () => {
      const branches = [
        {
          type: 'major',
          prTitle: 'some major update',
        },
        {
          type: 'pin',
          prTitle: 'some pin',
        },
        {
          type: 'pin',
          prTitle: 'some other pin',
        },
        {
          type: 'minor',
          prTitle: 'a minor update',
        },
      ];
      sortBranches(branches);
      expect(branches).toMatchSnapshot();
    });
  });
});
