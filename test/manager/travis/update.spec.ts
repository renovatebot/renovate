import { readFileSync } from 'fs';
import { resolve } from 'path';
import { updateDependency } from '../../../lib/manager/travis/update';

const content = readFileSync(
  resolve('test/manager/travis/_fixtures/travis.yml'),
  'utf8'
);

describe('manager/travis/update', () => {
  describe('updateDependency', () => {
    it('updates values', () => {
      // TODO: should be `Upgrade`
      const upgrade: any = {
        currentValue: ['8', '6', '4'],
        newValue: [6, 8],
      };
      const res = updateDependency(content, upgrade);
      expect(res).toMatchSnapshot();
    });
    it('falls back to 2 spaces', () => {
      // TODO: should be `Upgrade`
      const upgrade: any = {
        currentValue: [8, 6, 4],
        newValue: [6, 8],
      };
      const res = updateDependency('hello: world', upgrade);
      expect(res).toMatchSnapshot();
    });
    it('it uses double quotes', () => {
      // TODO: should be `Upgrade`
      const upgrade: any = {
        currentValue: ['6'],
        newValue: [6, 8],
      };
      const res = updateDependency('node_js:\n  - "6"\n', upgrade);
      expect(res).toMatchSnapshot();
    });
    it('returns null if error', () => {
      // TODO: should be `Upgrade`
      const upgrade: any = {
        currentValue: [8, 6, 4],
        newValue: '6',
      };
      const res = updateDependency(content, upgrade);
      expect(res).toBeNull();
    });
  });
});
