module.exports = {
  maskToken,
};

// istanbul ignore next
function maskToken(token) {
  // istanbul ignore if
  if (!token) {
    return token;
  }
  return `${token.substring(0, 2)}${new Array(token.length - 3).join(
    '*'
  )}${token.slice(-2)}`;
}
