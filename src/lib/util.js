/**
 * Created by balmasi on 2017-05-31.
 */
const { snakeCase } = require('lodash');

class TimeoutError extends Error {
  constructor(...args) {
    super(...args);
    Error.captureStackTrace(this, TimeoutError)
  }
}

/**
 * Converts arrays to keymaps
 *
 * @param array
 * @return {object}
 * @example
 * toKeymap(['sendCmd', 'be--Well'])
 * // returns { SEND_CMD: 'sendCmd', BE_WELL: 'be--Well' }
 *
 */
function toKeymap (array = []) {
  return array.reduce((acc = {}, key) =>
      Object.assign({ [snakeCase(key).toUpperCase()]: key }, acc)
  , {});
}

/**
 * adds timeout functionality to functions by
 * wrapping a given function with a promise which rejects if the function doesn't
 * return or resolve within timeoutMs milliseconds
 *
 * @param {number} timeoutMs - milliseconds to wait before rejecting calls
 * @param {function} fn - a function to add timeout behaviour to
 * @returns {function(...[*]): Promise.<*>}
 */
function getRejectedPromiseIfTimedOut (timeoutMs) {
  return new Promise((resolve, reject) =>
    setTimeout(() => reject(new TimeoutError('Operation Timed Out.')), timeoutMs)
  );
}

module.exports = {
  toKeymap,
  getRejectedPromiseIfTimedOut,
  TimeoutError
};