// Should b go before a?
function pinDependenciesFirst(a, b) {
  // Put dependencies first for group naming reasons
  if (b.type === 'pin' && b.depType === 'dependencies') {
    return true;
  }
  // Put b first unless a is a pin
  return a.type !== 'pin';
}

module.exports = {
  pinDependenciesFirst,
};
