import configSerializer from './config-serializer';

describe('logger/config-serializer', () => {
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
