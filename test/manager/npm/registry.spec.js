const npm = require('../../../lib/manager/npm/registry');
const registryAuthToken = require('registry-auth-token');
const nock = require('nock');

jest.mock('registry-auth-token');

const npmResponse = {
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
};

describe('api/npm', () => {
  delete process.env.NPM_TOKEN;
  beforeEach(() => {
    jest.resetAllMocks();
    npm.resetCache();
  });
  it('should fetch package info from npm', async () => {
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, npmResponse);
    const res = await npm.getDependency('foobar');
    expect(res).toMatchSnapshot();
  });
  it('should use homepage', async () => {
    const npmResponseHomepage = { ...npmResponse };
    npmResponseHomepage.repository.url = '';
    npmResponseHomepage.homepage = 'https://google.com';
    nock('https://registry.npmjs.org')
      .get('/foobarhome')
      .reply(200, npmResponseHomepage);
    const res = await npm.getDependency('foobarhome');
    expect(res).toMatchSnapshot();
  });
  it('should return null if lookup fails', async () => {
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(404);
    const res = await npm.getDependency('foobar');
    expect(res).toBeNull();
  });
  it('should send an authorization header if provided', async () => {
    registryAuthToken.mockImplementation(() => ({
      type: 'Basic',
      token: '1234',
    }));
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, npmResponse);
    const res = await npm.getDependency('foobar');
    expect(res).toMatchSnapshot();
  });
  it('should use NPM_TOKEN if provided', async () => {
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, npmResponse);
    const oldToken = process.env.NPM_TOKEN;
    process.env.NPM_TOKEN = 'some-token';
    const res = await npm.getDependency('foobar');
    process.env.NPM_TOKEN = oldToken;
    expect(res).toMatchSnapshot();
  });
  it('should fetch package info from custom registry', async () => {
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, npmResponse);
    npm.setNpmrc('registry=https://npm.mycustomregistry.com/');
    const res = await npm.getDependency('foobar');
    expect(res).toMatchSnapshot();
  });
  it('should use default registry if missing from npmrc', async () => {
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, npmResponse);
    npm.setNpmrc('foo=bar');
    const res = await npm.getDependency('foobar');
    expect(res).toMatchSnapshot();
  });
  it('should use dummy time if missing', async () => {
    const noTimeResponse = { ...npmResponse };
    delete noTimeResponse.time;
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, noTimeResponse);
    const res = await npm.getDependency('foobar');
    expect(res).toMatchSnapshot();
  });
  it('should cache package info from npm', async () => {
    nock('https://registry.npmjs.org')
      .get('/foobar')
      .reply(200, npmResponse);
    const res1 = await npm.getDependency('foobar');
    const res2 = await npm.getDependency('foobar');
    expect(res1).not.toBe(null);
    expect(res1).toEqual(res2);
  });
});
