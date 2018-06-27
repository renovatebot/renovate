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
  it('simplifies releases', () => {
    const config = {
      releases: [
        {
          version: '1.0.0-rc.2',
          gitRef: 'f6fd3d463e4a1c70dd7c2b2e4ea8637ccb05f2c7',
          time: '2018-06-18T21:18:58.840Z',
          canBeUnpublished: false,
        },
        {
          version: '1.0.0-rc.3',
          gitRef: 'da10c705e55c03dbbeeefa7f30e86225b10a7b82',
          time: '2018-06-26T19:12:38.659Z',
          canBeUnpublished: true,
        },
      ],
    };
    expect(configSerializer(config)).toMatchSnapshot();
  });
});
