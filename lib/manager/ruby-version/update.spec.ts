import { updateDependency } from './update';

describe('manager/nvm/update', () => {
  describe('updateDependency', () => {
    it('updates values', () => {
      const updateOptions = {
        newValue: '8.9.1',
      };
      const res = updateDependency({ fileContent: '8.9.0\n', updateOptions });
      expect(res).toMatchSnapshot();
    });
  });
});
