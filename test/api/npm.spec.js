const npm = require('../../lib/api/npm');
const got = require('got');
const registryUrl = require('registry-url');
const registryAuthToken = require('registry-auth-token');

jest.mock('registry-url');
jest.mock('registry-auth-token');
jest.mock('got');

describe('api/npm', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it('should fetch package info from npm', async () => {
    registryUrl.mockImplementation(() => 'https://npm.mycustomregistry.com/');
    got.mockImplementation(() => Promise.resolve({ body: { some: 'data' } }));
    const res = await npm.getDependency('foobar');
    expect(res).toMatchObject({ some: 'data' });
    const call = got.mock.calls[0];
    expect(call).toMatchObject([
      'https://npm.mycustomregistry.com/foobar',
      { json: true, headers: {} },
    ]);
  });
  it('should send an authorization header if provided', async () => {
    registryUrl.mockImplementation(() => 'https://npm.mycustomregistry.com/');
    registryAuthToken.mockImplementation(() => ({
      type: 'Basic',
      token: '1234',
    }));
    got.mockImplementation(() => Promise.resolve({ body: { some: 'data' } }));
    const res = await npm.getDependency('foobar');
    expect(res).toMatchObject({ some: 'data' });
    const call = got.mock.calls[0];
    expect(call).toMatchObject([
      'https://npm.mycustomregistry.com/foobar',
      {
        json: true,
        headers: {
          authorization: 'Basic 1234',
        },
      },
    ]);
  });
});
