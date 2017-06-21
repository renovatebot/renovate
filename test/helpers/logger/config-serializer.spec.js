const configSerializer = require('../../../lib/helpers/logger/config-serializer');

describe('helpers/logger/config-serializer', () => {
  it('redacts sensitive fields', () => {
    const config = {
      token: 'a',
      nottoken: 'b',
      githubAppKey: 'c',
    };
    expect(configSerializer(config)).toMatchSnapshot();
  });
  it('replaces functions', () => {
    const config = {
      api: 'a',
      nottoken: 'b',
      logger: {},
    };
    expect(configSerializer(config)).toMatchSnapshot();
  });
});
