import { updateDependency } from '../../../lib/manager/ruby-version/update';

describe('manager/nvm/update', () => {
  describe('updateDependency', () => {
    it('updates values', () => {
      const upgrade = {
        newValue: '8.9.1',
      };
      const res = updateDependency('8.9.0\n', upgrade);
      expect(res).toMatchSnapshot();
    });
  });
});
