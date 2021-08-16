import { loadFixture } from '../../../test/util';
import { updateDependency } from './update';

const content = loadFixture('travis.yml');

describe('manager/travis/update', () => {
  describe('updateDependency', () => {
    it('updates values', () => {
      const upgrade: any = {
        currentValue: ['8', '6', '4'],
        newValue: '6,8',
      };
      const res = updateDependency({ fileContent: content, upgrade });
      // FIXME: explicit assert condition
      expect(res).toMatchSnapshot();
    });
    it('falls back to 2 spaces', () => {
      const upgrade: any = {
        currentValue: [8, 6, 4],
        newValue: '6,8',
      };
      const res = updateDependency({
        fileContent: 'hello: world',
        upgrade,
      });
      // FIXME: explicit assert condition
      expect(res).toMatchSnapshot();
    });
    it('uses double quotes', () => {
      const upgrade: any = {
        currentValue: ['6'],
        newValue: '6,8',
      };
      const res = updateDependency({
        fileContent: 'node_js:\n  - "6"\n',
        upgrade,
      });
      // FIXME: explicit assert condition
      expect(res).toMatchSnapshot();
    });
    it('returns null if error', () => {
      const upgrade: any = {
        currentValue: [8, 6, 4],
        newValue: 6,
      };
      const res = updateDependency({ fileContent: content, upgrade });
      expect(res).toBeNull();
    });
  });
});
