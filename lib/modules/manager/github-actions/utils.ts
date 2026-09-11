import { regEx } from '../../../util/regex.ts';

export function actionUsesRegex(action: string): RegExp {
  return regEx(`(?:https?://[^/]+/)?${RegExp.escape(action)}(?:@.+)?$`);
}

/**
 * Whether a `uses:` value refers to the given `owner/repo` action, allowing
 * for an optional `https://<host>/` prefix (e.g. a self-hosted Forgejo/Gitea
 * instance, or GitHub Enterprise Server).
 */
export function matchesAction(
  uses: string | null | undefined,
  action: string,
): boolean {
  return !!uses && actionUsesRegex(action).test(uses);
}
