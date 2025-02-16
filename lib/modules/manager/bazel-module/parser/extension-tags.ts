import { query as q } from 'good-enough-parser';
import { regEx } from '../../../../util/regex';
import type { Ctx } from '../context';
import { kvParams } from './common';

import { mavenExtensionPrefix, mavenExtensionTags } from './maven';
import { ociExtensionPrefix, ociExtensionTags } from './oci';

// In bazel modules an extension tag is (roughly) a "member function application".
// For example:
//
//     oci = use_extension("@rules_oci//oci:extensions.bzl", "oci")
//     ^^^ --> the extension definition (not parsed by this module)
//
//     oci.pull(<parameters>)
//         ^^^^ --> the extension tag
//
// The name of the extension (`oci` in the example above) technically arbitrary.
// However, in practice, there are conventions. We use this to simplify parsing
// by assuming the extension names start with well-known prefixes.

const supportedExtensionRegex = regEx(
  `^(${ociExtensionPrefix}|${mavenExtensionPrefix}).*$`,
);

const supportedExtensionTags = [...mavenExtensionTags, ...ociExtensionTags];

const supportedExtensionTagsRegex = regEx(
  `^(${supportedExtensionTags.join('|')})$`,
);

export const extensionTags = q
  .sym<Ctx>(supportedExtensionRegex, (ctx, token) => {
    const rawExtension = token.value;
    const match = rawExtension.match(supportedExtensionRegex)!;
    const extension = match[1];
    return ctx.prepareExtensionTag(extension, rawExtension);
  })
  .op('.')
  .sym(supportedExtensionTagsRegex, (ctx, token) => {
    return ctx.startExtensionTag(token.value);
  })
  .join(
    q.tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      search: kvParams,
      postHandler: (ctx) => ctx.endExtensionTag(),
    }),
  );
