import { getName, mocked } from '../../../test/util';
import { setAdminConfig } from '../../config/admin';
import * as _sanitize from '../../util/sanitize';
import { getNpmrc, setNpmrc } from './npmrc';

jest.mock('../../util/sanitize');

const sanitize = mocked(_sanitize);

describe(getName(__filename), () => {
  beforeEach(() => {
    setNpmrc('');
    setAdminConfig();
    jest.resetAllMocks();
  });

  it('sanitize _auth', () => {
    setNpmrc('_auth=test');
    expect(sanitize.add).toHaveBeenCalledWith('test');
    expect(sanitize.add).toHaveBeenCalledTimes(1);
  });

  it('sanitize _authtoken', () => {
    // eslint-disable-next-line no-template-curly-in-string
    setNpmrc('//registry.test.com:_authToken=test\n_authToken=${NPM_TOKEN}');
    expect(sanitize.add).toHaveBeenCalledWith('test');
    expect(sanitize.add).toHaveBeenCalledTimes(1);
  });

  it('sanitize _password', () => {
    setNpmrc(
      `registry=https://test.org\n//test.org/:username=test\n//test.org/:_password=dGVzdA==`
    );
    expect(sanitize.add).toHaveBeenNthCalledWith(1, 'dGVzdA==');
    expect(sanitize.add).toHaveBeenNthCalledWith(2, 'test');
    expect(sanitize.add).toHaveBeenNthCalledWith(3, 'dGVzdDp0ZXN0');
    expect(sanitize.add).toHaveBeenCalledTimes(3);
  });

  it('sanitize _authtoken with high trust', () => {
    setAdminConfig({ exposeAllEnv: true });
    process.env.TEST_TOKEN = 'test';
    setNpmrc(
      // eslint-disable-next-line no-template-curly-in-string
      '//registry.test.com:_authToken=${TEST_TOKEN}\n_authToken=\nregistry=http://localhost'
    );
    expect(sanitize.add).toHaveBeenCalledWith('test');
    expect(sanitize.add).toHaveBeenCalledTimes(1);
  });

  it('ignores localhost', () => {
    setNpmrc(`registry=http://localhost`);
    expect(sanitize.add).toHaveBeenCalledTimes(0);
    expect(getNpmrc()).toEqual({});
  });
});
