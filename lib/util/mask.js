function maskToken(str) {
  return str
    ? [
        str.substring(0, 2),
        new Array(str.length - 3).join('*'),
        str.slice(-2),
      ].join('')
    : str;
}

module.exports = {
  maskToken,
};
