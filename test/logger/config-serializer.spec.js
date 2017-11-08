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
  it('squashes templates', () => {
    const config = {
      nottoken: 'b',
      prBody: 'foo',
    };
    expect(configSerializer(config)).toMatchSnapshot();
  });
  it('suppresses content', () => {
    const config = {
      content: {},
    };
    expect(configSerializer(config)).toMatchSnapshot();
  });
});
