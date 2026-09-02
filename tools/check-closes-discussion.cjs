// Co-authored-by: Claude Sonnet 4.5 (GitHub Copilot)

/**
 * @param {{ github: any, context: any, core: any }} params
 */
module.exports = async ({ github, context, core }) => {
  // Get all commits in this PR using the GitHub API
  const { data: commits } = await github.rest.pulls.listCommits({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: context.payload.pull_request.number,
  });

  // GitHub honours closing keywords in both commit messages and the
  // PR description. `#123` may refer to a Discussion rather than an
  // Issue - since Issues and Discussions are numbered independently
  // - and closing keywords must not auto-close a Discussion (see
  // #45439, which unintentionally closed discussion #40885).
  // Matches: closes #123, fixes #123, closes: #123, etc.
  const closingPattern =
    /(closes|fixes|resolves|fixed|closed|resolved):?\s+#(\d+)/gi;

  // Collect every closing-keyword reference, keeping one example
  // line per source for the error report.
  const references = new Map(); // number -> { source, line }
  /**
   * @param {string} text
   * @param {string} source
   */
  function collect(text, source) {
    for (const match of text.matchAll(closingPattern)) {
      const number = match[2];
      if (!references.has(number)) {
        const line = text.slice(0, match.index).split('\n').length;
        const lineText = text.split('\n')[line - 1].trim();
        references.set(number, { source, line: lineText });
      }
    }
  }

  for (const commit of commits) {
    const shortSha = commit.sha.substring(0, 7);
    collect(commit.commit.message, `commit ${shortSha}`);
  }
  collect(context.payload.pull_request.body ?? '', 'PR description');

  // Only fail for references that resolve to a Discussion - an
  // Issue reference is the intended, supported use of these
  // keywords (see the PR template).
  const violations = [];
  for (const [number, { source, line }] of references) {
    let isIssue = true;
    try {
      await github.rest.issues.get({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: parseInt(number, 10),
      });
    } catch (err) {
      if (err.status !== 404) {
        throw err;
      }
      isIssue = false;
    }
    if (isIssue) {
      continue;
    }

    const { repository } = await github.graphql(
      `query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          discussion(number: $number) { id }
        }
      }`,
      {
        owner: context.repo.owner,
        repo: context.repo.repo,
        number: parseInt(number, 10),
      },
    );
    if (repository.discussion) {
      violations.push({ source, line });
    }
  }

  // Report results
  if (violations.length > 0) {
    let errorMessage = `Found ${violations.length} closing keyword(s) referencing a Discussion:\n\n`;
    for (const violation of violations) {
      errorMessage += `- ${violation.source}: ${violation.line}\n`;
    }
    errorMessage += `\nClosing keywords (closes, fixes, resolves, etc.) must not reference a Discussion, as merging would auto-close it. Reference the discussion without a closing keyword instead, e.g. 'Related discussion: #123'.`;
    core.setFailed(errorMessage);
  } else {
    core.info('✓ No closing keywords referencing a Discussion found');
  }
};
