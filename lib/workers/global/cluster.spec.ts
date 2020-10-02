import { initCluster } from './cluster';

describe('initCluster', () => {
  it('selects correct repositories', () => {
    const config = initCluster({
      repositories: [
        { repository: '1' },
        { repository: '2' },
        { repository: '3' },
        { repository: '4' },
        { repository: '5' },
        { repository: '6' },
        { repository: '7' },
        { repository: '8' },
      ],
      cluster: {
        nodeIndex: 1,
        numberOfNodes: 3,
      },
    });
    expect(config.repositories).toMatchSnapshot();
  });
});
