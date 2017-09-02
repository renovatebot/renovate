const npm = require('../../lib/api/npm');
const got = require('got');
const registryAuthToken = require('registry-auth-token');
const logger = require('../_fixtures/logger');

jest.mock('registry-auth-token');
jest.mock('got');

const npmResponse = {
  body: {
    versions: {
      '0.0.1': {
        foo: 1,
      },
    },
    repository: {
      type: 'git',
      url: 'git://github.com/renovateapp/dummy.git',
    },
    'dist-tags': {
      latest: '0.0.1',
    },
    time: {
      '0.0.1': '',
    },
  },
};

describe('api/npm', () => {
  delete process.env.NPM_TOKEN;
  beforeEach(() => {
    jest.resetAllMocks();
    npm.resetCache();
  });
  it('should fetch package info from npm', async () => {
    got.mockImplementation(() => Promise.resolve(npmResponse));
    const res = await npm.getDependency('foobar', logger);
    expect(res).toMatchSnapshot();
    const call = got.mock.calls[0];
    expect(call).toMatchSnapshot();
  });
  it('should use homepage', async () => {
    const npmResponseHomepage = { ...npmResponse };
    npmResponseHomepage.body.repository.url = '';
    npmResponseHomepage.body.homepage = 'https://google.com';
    got.mockImplementationOnce(() => Promise.resolve(npmResponseHomepage));
    const res = await npm.getDependency('foobarhome', logger);
    expect(res).toMatchSnapshot();
    const call = got.mock.calls[0];
    expect(call).toMatchSnapshot();
  });
  it('should cache package info from npm', async () => {
    got.mockImplementation(() => Promise.resolve(npmResponse));
    const res1 = await npm.getDependency('foobar', logger);
    const res2 = await npm.getDependency('foobar', logger);
    expect(res1).toEqual(res2);
    expect(got.mock.calls.length).toEqual(1);
  });
  it('should return null if lookup fails', async () => {
    got.mockImplementation(() => {
      throw new Error('not found');
    });
    const res = await npm.getDependency('foobar', logger);
    expect(res).toBeNull();
  });
  it('should send an authorization header if provided', async () => {
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
  it('should use NPM_TOKEN if provided', async () => {
    got.mockImplementation(() => Promise.resolve(npmResponse));
    const oldToken = process.env.NPM_TOKEN;
    process.env.NPM_TOKEN = 'some-token';
    const res = await npm.getDependency('foobar', logger);
    process.env.NPM_TOKEN = oldToken;
    expect(res).toMatchSnapshot();
    const call = got.mock.calls[0];
    expect(call).toMatchSnapshot();
  });
  it('should fetch package info from custom registry', async () => {
    got.mockImplementation(() => Promise.resolve(npmResponse));
    npm.setNpmrc('registry=https://npm.mycustomregistry.com/');
    const res = await npm.getDependency('foobar', logger);
    expect(res).toMatchSnapshot();
    const call = got.mock.calls[0];
    expect(call).toMatchSnapshot();
  });
  it('should use default registry if missing from npmrc', async () => {
    got.mockImplementation(() => Promise.resolve(npmResponse));
    npm.setNpmrc('foo=bar');
    const res = await npm.getDependency('foobar', logger);
    expect(res).toMatchSnapshot();
    const call = got.mock.calls[0];
    expect(call).toMatchSnapshot();
  });
});
