import { formatCell } from '../utils.ts';

describe('tools/docs/test/utils', () => {
  it('parents row header should be a td block', () => {
    const parentsRowHeader = formatCell(
      ['parents', '.,package,test,ansible'],
      0,
    );
    expect(parentsRowHeader).toEqual('<td>parents</td>');
  });

  it('parents content should be multiple code blocks, and . be display with "(the root document)"', () => {
    const parents = formatCell(['parents', '.,packageRules,argocd,ansible'], 1);
    expect(parents).toEqual(
      '<td class="parents"><span><code>(the root document)</code></span><span><code>ansible</code></span><span><code>argocd</code></span><span><code>packageRules</code></span></td>',
    );
  });

  it('parent named ".foo" should be not display with ".foo (the root document)"', () => {
    const parents = formatCell(
      ['parents', '.foo,packageRules,argocd,ansible'],
      1,
    );
    expect(parents).toEqual(
      '<td class="parents"><span><code>.foo</code></span><span><code>ansible</code></span><span><code>argocd</code></span><span><code>packageRules</code></span></td>',
    );
  });
});
