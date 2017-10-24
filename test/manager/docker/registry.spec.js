const docker = require('../../../lib/manager/docker/registry');
const got = require('got');
const logger = require('../../_fixtures/logger');

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
  describe('getTags', () => {
    it('returns null if no token', async () => {
      got.mockReturnValueOnce({ body: {} });
      const res = await docker.getTags('node', logger);
      expect(res).toBe(null);
    });
    it('returns tags', async () => {
      const tags = ['a', 'b'];
      got.mockReturnValueOnce({ body: { token: 'some-token ' } });
      got.mockReturnValueOnce({ body: { tags } });
      const res = await docker.getTags('my/node', logger);
      expect(res).toBe(tags);
    });
    it('returns null on error', async () => {
      got.mockReturnValueOnce({});
      const res = await docker.getTags('node', logger);
      expect(res).toBe(null);
    });
  });
});
