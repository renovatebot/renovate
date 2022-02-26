import { mocked } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import * as _sanitize from '../../util/sanitize';
import { getNpmrc, setNpmrc } from './npmrc';

jest.mock('../../util/sanitize');

const sanitize = mocked(_sanitize);

describe('datasource/npm/npmrc', () => {
  beforeEach(() => {
    setNpmrc('');
    GlobalConfig.reset();
    jest.resetAllMocks();
  });

  it('sanitize _auth', () => {
    setNpmrc('_auth=test');
    expect(sanitize.addSecretForSanitizing).toHaveBeenCalledWith('test');
    expect(sanitize.addSecretForSanitizing).toHaveBeenCalledTimes(1);
  });

  it('sanitize _authtoken', () => {
    setNpmrc('//registry.test.com:_authToken=test\n_authToken=${NPM_TOKEN}');
    expect(sanitize.addSecretForSanitizing).toHaveBeenCalledWith('test');
    expect(sanitize.addSecretForSanitizing).toHaveBeenCalledTimes(1);
  });

  it('sanitize _password', () => {
    setNpmrc(
      `registry=https://test.org\n//test.org/:username=test\n//test.org/:_password=dGVzdA==`
    );
    expect(sanitize.addSecretForSanitizing).toHaveBeenNthCalledWith(1, 'test');
    expect(sanitize.addSecretForSanitizing).toHaveBeenNthCalledWith(
      2,
      'dGVzdDp0ZXN0'
    );
    expect(sanitize.addSecretForSanitizing).toHaveBeenCalledTimes(2);
  });

  it('sanitize _authtoken with high trust', () => {
    GlobalConfig.set({ exposeAllEnv: true });
    process.env.TEST_TOKEN = 'test';
    setNpmrc(
      '//registry.test.com:_authToken=${TEST_TOKEN}\n_authToken=\nregistry=http://localhost'
    );
    expect(sanitize.addSecretForSanitizing).toHaveBeenCalledWith('test');
    expect(sanitize.addSecretForSanitizing).toHaveBeenCalledTimes(1);
  });

  it('ignores localhost', () => {
    setNpmrc(`registry=http://localhost`);
    expect(sanitize.addSecretForSanitizing).toHaveBeenCalledTimes(0);
    expect(getNpmrc()).toBeEmptyObject();
  });
});
