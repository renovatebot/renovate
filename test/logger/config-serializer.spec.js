const configSerializer = require('../../lib/logger/config-serializer');

describe('logger/config-serializer', () => {
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
  it('squashes templates', () => {
    const config = {
      api: 'a',
      nottoken: 'b',
      prBody: 'foo',
    };
    expect(configSerializer(config)).toMatchSnapshot();
  });
});
