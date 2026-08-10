/**
 * Flags a `shell` property set on an object literal (e.g. `ExecOptions`,
 * `CommandWithOptions`) passed to `lib/util/exec`. Enabling the child
 * process's shell reintroduces the injection risk that `exec()` is designed
 * to avoid by running commands as an argv array - see the warning on
 * `CommandWithOptions.shell` in `lib/util/exec/types.ts`.
 *
 * The implementation in `lib/util/exec/` itself is exempt, since it has to
 * accept and plumb the option through. Call sites with a genuine, reviewed
 * need for a shell (e.g. to run user-configured commands) should disable
 * this rule inline with a justification instead of being silently exempted.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
export default {
  meta: {
    type: 'problem',
    messages: {
      noExecShellOption:
        "Do not set 'shell' on exec options: it re-enables shell interpretation of the command, which can lead to command injection. Build the command as an argv array instead. If a shell is genuinely required, disable this rule inline with a justification.",
    },
  },
  create(context) {
    const filename = context.filename ?? context.physicalFilename ?? '';
    if (
      !filename.includes('/lib/') ||
      filename.endsWith('.spec.ts') ||
      filename.includes('/lib/util/exec/')
    ) {
      return {};
    }
    return {
      Property(node) {
        if (node.parent.type !== 'ObjectExpression') {
          return;
        }
        const { key } = node;
        let name;
        if (key.type === 'Identifier') {
          name = key.name;
        } else if (key.type === 'Literal' && typeof key.value === 'string') {
          name = key.value;
        }
        if (name === 'shell') {
          context.report({ node, messageId: 'noExecShellOption' });
        }
      },
    };
  },
};
