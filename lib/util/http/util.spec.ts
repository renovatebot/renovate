import { HOST_BLOCKED, HOST_DISABLED } from '../../constants/error-messages.ts';
import { refusedHostMessage } from './util.ts';

describe('util/http/util', () => {
  describe('refusedHostMessage', () => {
    it('distinguishes a blocked host from a disabled one', () => {
      expect(refusedHostMessage(new Error(HOST_BLOCKED))).toBe('Host blocked');
      expect(refusedHostMessage(new Error(HOST_DISABLED))).toBe(
        'Host disabled',
      );
    });
  });
});
