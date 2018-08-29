module.exports = {
  expandError,
};

function expandError(err) {
  return {
    err,
    message: err.message,
    body: err.response ? err.response.body : undefined,
  };
}
