import { formatCell } from '../utils.ts';

describe('tools/docs/test/config', () => {
  it('parents row header should be a td block', () => {
    const parentsRowHeader = formatCell(
      ['parents', '.,package,test,ansible'],
      0,
    );
    expect(parentsRowHeader).toEqual('<td>parents</td>');
  });

  it('parents content should be multiple code blocks', () => {
    const parents = formatCell(['parents', '.,packageRules,argocd,ansible'], 1);
    expect(parents).toEqual(
      '<td class="parents"><span><code>.</code></span><span><code>ansible</code></span><span><code>argocd</code></span><span><code>packageRules</code></span></td>',
    );
  });
});
