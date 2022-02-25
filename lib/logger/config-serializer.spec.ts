import configSerializer from './config-serializer';

describe('logger/config-serializer', () => {
  it('squashes templates', () => {
    const config = {
      nottoken: 'b',
      prBody: 'foo',
    };

    // TODO: fix types (#9610)
    expect(configSerializer(config)).toMatchSnapshot({
      prBody: '[Template]',
    } as never);
  });
  it('suppresses content', () => {
    const config = {
      content: {},
    };

    // TODO: fix types (#9610)
    expect(configSerializer(config)).toMatchSnapshot({
      content: '[content]',
    } as never);
  });
});
