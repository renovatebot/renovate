import nock from 'nock';
import { getName } from '../../../test/util';
import { PLATFORM_TYPE_GITHUB } from '../../constants/platforms';
import * as hostRules from '../host-rules';
import { GotJSONOptions } from './common';
import { api } from '.';

const baseUrl = 'https://api.github.com';

describe(getName(__filename), () => {
  beforeEach(() => {
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    hostRules.clear();
    nock.enableNetConnect();
  });

  async function got(opts?: Partial<GotJSONOptions>) {
    const { body, request } = (await api('some', {
      method: 'GET',
      baseUrl,
      json: true,
      ...opts,
    })) as any;
    return { body, options: request.gotOptions };
  }

  function mock(opts?: nock.Options, times = 1) {
    return nock(baseUrl, opts).get('/some').times(times).reply(200, {});
  }

  it('gets', async () => {
    const req = mock({})
      .head('/some')
      .reply(200, {})
      .get('/some')
      .replyWithError('not-found');

    expect(
      await got({
        hostType: PLATFORM_TYPE_GITHUB,
        useCache: false,
      })
    ).toMatchSnapshot();

    expect(
      await got({ hostType: PLATFORM_TYPE_GITHUB, method: 'HEAD' })
    ).toMatchSnapshot();

    await expect(got({ hostType: PLATFORM_TYPE_GITHUB })).rejects.toThrow(
      'not-found'
    );

    expect(req.isDone()).toBe(true);
  });
});
