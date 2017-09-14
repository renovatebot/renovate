const docker = require('../../lib/api/docker');
const got = require('got');
const logger = require('../_fixtures/logger');

jest.mock('got');

describe('api/docker', () => {
  describe('getDigest', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it('returns null if no token', async () => {
      got.mockReturnValueOnce({ body: {} });
      const res = await docker.getDigest('some-name', undefined, logger);
      expect(res).toBe(null);
    });
    it('returns null if errored', async () => {
      got.mockReturnValueOnce({ body: { token: 'some-token' } });
      const res = await docker.getDigest('some-name', undefined, logger);
      expect(res).toBe(null);
    });
    it('returns digest', async () => {
      got.mockReturnValueOnce({ body: { token: 'some-token' } });
      got.mockReturnValueOnce({
        headers: { 'docker-content-digest': 'some-digest' },
      });
      const res = await docker.getDigest('some-name', undefined, logger);
      expect(res).toBe('some-digest');
    });
    it('supports scoped names', async () => {
      got.mockReturnValueOnce({ body: { token: 'some-token' } });
      got.mockReturnValueOnce({
        headers: { 'docker-content-digest': 'some-digest' },
      });
      const res = await docker.getDigest('some/name', undefined, logger);
      expect(res).toBe('some-digest');
    });
  });
});
