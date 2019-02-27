module.exports = {
  getRangeStrategy,
};

/*
 * The getRangeStrategy() function is optional and can be removed if not applicable.
 * It is used when the user configures rangeStrategy=auto.
 *
 * For example in npm, when rangeStrategy is auto we:
 *  - Always pin "devDependencies"
 *  - Pin "dependencies" only if we detect that it's probably an app not a library
 *  - Always widen "peerDependencies"
 *
 * If this function is not present then the default 'replace' value will be used.
 *
 */

function getRangeStrategy() {
  return 'replace';
}
