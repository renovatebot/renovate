import { updateDependency } from './update';

describe('manager/nodenv/update', () => {
  describe('updateDependency', () => {
    it('updates values', () => {
      const upgrade = {
        newValue: '8.9.1',
      };
      const res = updateDependency({ fileContent: '8.9.0\n', upgrade });
      expect(res).toMatchSnapshot();
    });
  });
});
