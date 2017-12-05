/**
 * adds timeout functionality to functions by
 * wrapping a given function with a promise which rejects if the function doesn't
 * return or resolve within timeoutMs milliseconds
 *
 * @param {number} timeoutMs - milliseconds to wait before rejecting calls
 * @returns {function(...[*]): Promise.<*>}
 */
function getRejectedPromiseIfTimedOut (timeoutMs) {
  return new Promise((resolve, reject) =>
    setTimeout(() => reject(new TimeoutError('Operation Timed Out.')), timeoutMs)
  );
}


class TimeoutError extends Error {
  constructor(...args) {
    super(...args);
    Error.captureStackTrace(this, TimeoutError)
  }
}

module.exports = {
  TimeoutError,
  getRejectedPromiseIfTimedOut
};