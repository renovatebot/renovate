const {
  sortBranches,
} = require('../../../../lib/workers/repository/process/sort');

describe('workers/repository/process/sort', () => {
  describe('sortBranches()', () => {
    it('sorts based on updateType and prTitle', () => {
      const branches = [
        {
          updateType: 'major',
          prTitle: 'some major update',
        },
        {
          updateType: 'pin',
          prTitle: 'some pin',
        },
        {
          updateType: 'pin',
          prTitle: 'some other pin',
        },
        {
          updateType: 'minor',
          prTitle: 'a minor update',
        },
      ];
      sortBranches(branches);
      expect(branches).toMatchSnapshot();
    });
  });
});
