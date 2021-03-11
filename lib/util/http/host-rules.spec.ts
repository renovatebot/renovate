import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import {
  PLATFORM_TYPE_GITEA,
  PLATFORM_TYPE_GITHUB,
} from '../../constants/platforms';
import { bootstrap } from '../../proxy';
import * as hostRules from '../host-rules';
import { applyHostRules } from './host-rules';

const url = 'https://github.com';

jest.mock('global-agent');

describe(getName(__filename), () => {
  const options = {
    hostType: PLATFORM_TYPE_GITHUB,
  };
  beforeEach(() => {
    // reset module
    jest.resetAllMocks();

    delete process.env.HTTP_PROXY;

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

    hostRules.add({
      hostType: 'npm',
      authType: 'Basic',
      token: 'XXX',
    });

    httpMock.reset();
    httpMock.setup();
  });

  afterEach(() => {
    delete process.env.HTTP_PROXY;
    httpMock.reset();
  });

  it('adds token', () => {
    expect(applyHostRules(url, { ...options })).toMatchInlineSnapshot(`
      Object {
        "context": Object {
          "authType": undefined,
        },
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

  it('adds custom auth', () => {
    expect(applyHostRules(url, { hostType: 'npm' })).toMatchInlineSnapshot(`
      Object {
        "context": Object {
          "authType": "Basic",
        },
        "hostType": "npm",
        "token": "XXX",
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

  it('uses http2', () => {
    hostRules.add({ enableHttp2: true });
    expect(applyHostRules(url, { ...options, token: 'xxx' }))
      .toMatchInlineSnapshot(`
      Object {
        "hostType": "github",
        "http2": true,
        "token": "xxx",
      }
    `);
  });

  it('disables http2', () => {
    process.env.HTTP_PROXY = 'http://proxy';
    bootstrap();
    hostRules.add({ enableHttp2: true });
    expect(applyHostRules(url, { ...options, token: 'xxx' }))
      .toMatchInlineSnapshot(`
      Object {
        "hostType": "github",
        "token": "xxx",
      }
    `);
  });
});
