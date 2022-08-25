import * as hostRules from '../../util/host-rules';
import { repoFingerprint } from './util';

describe('modules/platform/util', () => {
  beforeEach(() => hostRules.clear());

  describe('repoFingerprint', () => {
    it.each`
      repoId       | endpoint                | fingerprint
      ${'some-id'} | ${null}                 | ${'361b1bf27a0c0ef8fa5d270f588aa5747ba9497b16de64a44f186253295bc80a3891ecfee768f5c88734a6a738eacca69ccca7e50b16529cfc50dca77226a760'}
      ${'some-id'} | ${'https://github.com'} | ${'423e527a4f88a1b6aae8b70e72a4ae80b44fe83f11b90851f5bc654f39a3272c76b57d7ad30cabd727c04c254a3e7ea16109d05e398a228701ac805460344815'}
    `(
      '("$repoId", "$endpoint") === $fingerprint',
      ({ repoId, endpoint, fingerprint }) => {
        expect(repoFingerprint(repoId, endpoint)).toBe(fingerprint);
      }
    );
  });
});
