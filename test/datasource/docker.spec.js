const got = require('got');
const docker = require('../../lib/datasource/docker');

jest.mock('got');

describe('api/docker', () => {
  describe('getDigest', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it('returns null if no token', async () => {
      got.mockReturnValueOnce({ body: {} });
      const res = await docker.getDigest(
        { depName: 'some-dep' },
        'some-new-value'
      );
      expect(res).toBe(null);
    });
    it('returns null if errored', async () => {
      got.mockReturnValueOnce({ body: { token: 'some-token' } });
      const res = await docker.getDigest(
        { depName: 'some-dep' },
        'some-new-value'
      );
      expect(res).toBe(null);
    });
    it('returns digest', async () => {
      got.mockReturnValueOnce({ 
        headers: { 'www-authenticate': 'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:samalba/my-app:pull  "' } 
      });
      got.mockReturnValueOnce({ body: { token: 'some-token' } });
      got.mockReturnValueOnce({
        headers: { 'docker-content-digest': 'some-digest' },
      });
      const res = await docker.getDigest(
        { depName: 'some-dep' },
        'some-new-value'
      );
      expect(res).toBe('some-digest');
    });
    it('supports scoped names', async () => {
      got.mockReturnValueOnce({ 
        headers: { 'www-authenticate': 'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:samalba/my-app:pull  "' } 
      });
      got.mockReturnValueOnce({ body: { token: 'some-token' } });
      got.mockReturnValueOnce({
        headers: { 'docker-content-digest': 'some-digest' },
      });
      const res = await docker.getDigest(
        { depName: 'some-dep', tagSuffix: 'alpine' },
        '8.0.0'
      );
      expect(res).toBe('some-digest');
    });
  });
  describe('getDependency', () => {
    it('returns null if no token', async () => {
      got.mockReturnValueOnce({ body: {} });
      const res = await docker.getDependency({
        fullname: 'node',
        qualifiers: {},
      });
      expect(res).toBe(null);
    });
    it('returns tags with no suffix', async () => {
      const tags = ['a', 'b', '1.0.0', '1.1.0', '1.1.0-alpine'];
      got.mockReturnValueOnce({ 
        headers: { 'www-authenticate': 'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:samalba/my-app:pull  "' } 
      });
      got.mockReturnValueOnce({ headers: {}, body: { token: 'some-token ' } });
      got.mockReturnValueOnce({ headers: {}, body: { tags } });
      const res = await docker.getDependency({
        fullname: 'my/node',
        qualifiers: {},
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(3);
    });
    it('returns tags with suffix', async () => {
      const tags = ['a', 'b', '1.0.0', '1.1.0-alpine'];
      got.mockReturnValueOnce({ 
        headers: { 'www-authenticate': 'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:samalba/my-app:pull  "' } 
      });
      got.mockReturnValueOnce({ headers: {}, body: { token: 'some-token ' } });
      got.mockReturnValueOnce({ headers: {}, body: { tags } });
      const res = await docker.getDependency({
        fullname: 'my/node',
        qualifiers: { suffix: 'alpine' },
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(1);
    });
    it('returns null on error', async () => {
      got.mockReturnValueOnce({});
      const res = await docker.getDependency({
        fullname: 'my/node',
        qualifiers: {},
      });
      expect(res).toBe(null);
    });
  });
});
