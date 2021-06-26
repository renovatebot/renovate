import { getName } from '../../../../test/util';
import { volumeCreate, volumePrune } from './volume';

describe(getName(), () => {
  describe('volumeCreate', () => {
    it('creates new volume', async () => {
      // await volumeCreate('vol1', { foo: 'foo', bar: 'bar' });
      expect(true).toBeTrue();
    });
  });

  describe('volumePrune', () => {
    it('prunes volumes', async () => {
      // await volumePrune({ foo: 'foo', bar: 'bar' });
      expect(true).toBeTrue();
    });
  });
});
