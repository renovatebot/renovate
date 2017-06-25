const npm = require('../../lib/api/npm');
const got = require('got');
const registryUrl = require('registry-url');
const registryAuthToken = require('registry-auth-token');
const logger = require('../_fixtures/logger');

jest.mock('registry-url');
jest.mock('registry-auth-token');
jest.mock('got');

const npmResponse = {
  body: {
    versions: {
      '0.0.1': {
        foo: 1,
      },
    },
  },
};

describe('api/npm', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    npm.resetCache();
  });
  it('should fetch package info from npm', async () => {
    registryUrl.mockImplementation(() => 'https://npm.mycustomregistry.com/');
    got.mockImplementation(() => Promise.resolve(npmResponse));
    const res = await npm.getDependency('foobar', logger);
    expect(res).toMatchSnapshot();
    const call = got.mock.calls[0];
    expect(call).toMatchSnapshot();
  });
  it('should cache package info from npm', async () => {
    registryUrl.mockImplementation(() => 'https://npm.mycustomregistry.com/');
    got.mockImplementation(() => Promise.resolve(npmResponse));
    const res1 = await npm.getDependency('foobar', logger);
    const res2 = await npm.getDependency('foobar', logger);
    expect(res1).toEqual(res2);
    expect(got.mock.calls.length).toEqual(1);
  });
  it('should return null if lookup fails', async () => {
    registryUrl.mockImplementation(() => 'https://npm.mycustomregistry.com/');
    got.mockImplementation(() => {
      throw new Error('not found');
    });
    const res = await npm.getDependency('foobar', logger);
    expect(res).toBeNull();
  });
  it('should send an authorization header if provided', async () => {
    registryUrl.mockImplementation(() => 'https://npm.mycustomregistry.com/');
    registryAuthToken.mockImplementation(() => ({
      type: 'Basic',
      token: '1234',
    }));
    got.mockImplementation(() => Promise.resolve(npmResponse));
    const res = await npm.getDependency('foobar', logger);
    expect(res).toMatchSnapshot();
    const call = got.mock.calls[0];
    expect(call).toMatchSnapshot();
  });
  it('sets .npmrc', () => {
    npm.setNpmrc('input');
  });
});
