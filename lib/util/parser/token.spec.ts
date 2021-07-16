import { Token as MooToken } from 'moo';
import { getName } from '../../../test/util';
import { TokenType, massageMooToken } from './token';

describe(getName(), () => {
  describe('massageMooToken', () => {
    it('handles token with pre-defined type', () => {
      const mooToken = {
        type: 'Symbol',
        value: 'foobar',
        offset: 0,
      } as MooToken;
      expect(massageMooToken(mooToken)).toMatchObject({
        type: TokenType.Symbol,
        ...mooToken,
      });
    });

    it('handles token with missing type', () => {
      const mooToken = { value: 'foobar', offset: 0 } as MooToken;
      expect(massageMooToken(mooToken)).toMatchObject({
        type: TokenType.Unknown,
        ...mooToken,
      });
    });
  });
});
