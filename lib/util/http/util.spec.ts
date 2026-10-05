import { HOST_BLOCKED, HOST_DISABLED } from '../../constants/error-messages.ts';
import { copyResponse, refusedHostMessage } from './util.ts';

describe('util/http/util', () => {
  describe('copyResponse', () => {
    it('deep copies a Uint8Array body', () => {
      const body = new Uint8Array([1, 2, 3]);
      const res = copyResponse(
        { statusCode: 200, headers: {}, body, cached: true },
        true,
      );

      body[0] = 9;

      expect(res.body).toEqual(new Uint8Array([1, 2, 3]));
      expect(res.cached).toBeTrue();
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
