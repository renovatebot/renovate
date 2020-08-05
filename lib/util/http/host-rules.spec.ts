import * as httpMock from '../../../test/httpMock';
import { getName } from '../../../test/util';
import {
  PLATFORM_TYPE_GITEA,
  PLATFORM_TYPE_GITHUB,
} from '../../constants/platforms';
import * as hostRules from '../host-rules';
import { applyHostRules } from './host-rules';

const url = 'https://github.com';

describe(getName(__filename), () => {
  const options = {
    hostType: PLATFORM_TYPE_GITHUB,
  };
  beforeEach(() => {
    // reset module
    jest.resetAllMocks();

    // clean up hostRules
    hostRules.clear();
    hostRules.add({
      hostType: PLATFORM_TYPE_GITHUB,
      token: 'token',
    });
    hostRules.add({
      hostType: PLATFORM_TYPE_GITEA,
      password: 'password',
    });

    httpMock.reset();
    httpMock.setup();
  });

  it('adds token', () => {
    expect(applyHostRules(url, { ...options })).toMatchInlineSnapshot(`
      Object {
        "hostType": "github",
        "token": "token",
      }
    `);
  });

  it('adds auth', () => {
    expect(applyHostRules(url, { hostType: PLATFORM_TYPE_GITEA }))
      .toMatchInlineSnapshot(`
      Object {
        "hostType": "gitea",
        "password": "password",
        "username": undefined,
      }
    `);
  });

  it('skips', () => {
    expect(applyHostRules(url, { ...options, token: 'xxx' }))
      .toMatchInlineSnapshot(`
      Object {
        "hostType": "github",
        "token": "xxx",
      }
    `);
  });
});
