import { HOST_BLOCKED, HOST_DISABLED } from '../../constants/error-messages.ts';
import { copyResponse, refusedHostMessage } from './util.ts';

describe('util/http/util', () => {
  describe('copyResponse', () => {
    it('copies a binary body into its own memory', () => {
      const body = Buffer.from('abc');

      const res = copyResponse({ statusCode: 200, headers: {}, body }, true);
      body[0] = 0x78;

      expect(res.body).toEqual(Buffer.from('abc'));
    });
  });

  describe('refusedHostMessage', () => {
    it('distinguishes a blocked host from a disabled one', () => {
      expect(refusedHostMessage(new Error(HOST_BLOCKED))).toBe('Host blocked');
      expect(refusedHostMessage(new Error(HOST_DISABLED))).toBe(
        'Host disabled',
      );
    });
  });
});
