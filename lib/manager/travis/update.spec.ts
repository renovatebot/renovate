import { readFileSync } from 'fs';
import { resolve } from 'upath';
import { getName } from '../../../test/util';
import { updateDependency } from './update';

const content = readFileSync(
  resolve('lib/manager/travis/__fixtures__/travis.yml'),
  'utf8'
);

describe(getName(__filename), () => {
  describe('updateDependency', () => {
    it('updates values', () => {
      // TODO: should be `Upgrade`
      const upgrade: any = {
        currentValue: ['8', '6', '4'],
        newValue: '6,8',
      };
      const res = updateDependency({ fileContent: content, upgrade });
      expect(res).toMatchSnapshot();
    });
    it('falls back to 2 spaces', () => {
      // TODO: should be `Upgrade`
      const upgrade: any = {
        currentValue: [8, 6, 4],
        newValue: '6,8',
      };
      const res = updateDependency({
        fileContent: 'hello: world',
        upgrade,
      });
      expect(res).toMatchSnapshot();
    });
    it('uses double quotes', () => {
      // TODO: should be `Upgrade`
      const upgrade: any = {
        currentValue: ['6'],
        newValue: '6,8',
      };
      const res = updateDependency({
        fileContent: 'node_js:\n  - "6"\n',
        upgrade,
      });
      expect(res).toMatchSnapshot();
    });
    it('returns null if error', () => {
      // TODO: should be `Upgrade`
      const upgrade: any = {
        currentValue: [8, 6, 4],
        newValue: 6,
      };
      const res = updateDependency({ fileContent: content, upgrade });
      expect(res).toBeNull();
    });
  });
});
