module.exports = cmdSerializer;

// istanbul ignore next
function cmdSerializer(cmd) {
  return cmd.replace(/https:\/\/[^@]*@/g, 'https://**redacted**@');
}
