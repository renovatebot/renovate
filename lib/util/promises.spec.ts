import { ExternalHostError } from '../types/errors/external-host-error';
import * as p from './promises';

describe('util/promises', () => {
  describe('all', () => {
    it('works', async () => {
      const queue = p.all([
        () => Promise.resolve(1),
        () => Promise.resolve(2),
        () => Promise.resolve(3),
      ]);
      await expect(queue).resolves.toEqual([1, 2, 3]);
    });
  });

  describe('map', () => {
    it('works', async () => {
      const queue = p.map([1, 2, 3], (x) => Promise.resolve(x + 1));
      await expect(queue).resolves.toEqual([2, 3, 4]);
    });
  });

  describe('Error handling', () => {
    it('throws first ExternalHostError found', async () => {
      const unknownErr = new Error('fail');
      const hostErr = new ExternalHostError(unknownErr);
      let res: Error | string[] | null = null;
      try {
        res = await p.all([
          () => Promise.resolve('ok'),
          () => Promise.reject(unknownErr),
          () => Promise.reject(hostErr),
        ]);
      } catch (err) {
        res = err;
      }
      expect(res).toBe(hostErr);
    });

    it('throws first error if error messages are all the same', async () => {
      const err1 = new Error('some error');
      const err2 = new Error('some error');
      const err3 = new Error('some error');
      let res: Error | string[] | null = null;
      try {
        res = await p.all([
          () => Promise.reject(err1),
          () => Promise.reject(err2),
          () => Promise.reject(err3),
        ]);
      } catch (err) {
        res = err;
      }
      expect(res).toBe(err1);
    });

    it('throws aggregate error for different error messages', async () => {
      await expect(
        p.map([1, 2, 3], (x) => Promise.reject(new Error(`error ${x}`)))
      ).rejects.toHaveProperty('name', 'AggregateError');
    });

    it('re-throws when stopOnError=true', async () => {
      const unknownErr = new Error('fail');
      let res: Error | string[] | null = null;
      try {
        res = await p.all(
          [
            () => Promise.resolve('ok'),
            () => Promise.resolve('ok'),
            () => Promise.reject(unknownErr),
          ],
          { stopOnError: true }
        );
      } catch (err) {
        res = err;
      }
      expect(res).toBe(unknownErr);
    });
  });
});
