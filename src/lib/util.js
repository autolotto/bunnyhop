/**
 * Created by balmasi on 2017-05-31.
 */
const { snakeCase, isFunction } = require('lodash');

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
 * @returns {function(...[*]): Promise.<*>}
 */
function getRejectedPromiseIfTimedOut (timeoutMs) {
  return new Promise((resolve, reject) =>
    setTimeout(() => reject(new TimeoutError('Operation Timed Out.')), timeoutMs)
  );
}

/**
 * Wraps an onSuccess and onError handler around a function
 * @param {function} orignalFn
 * @param {function} [onError]
 * @param {function} [onSuccess]
 * @return {*} - returns whatever the original function would have returned
 */
const wrapCompletedHandlers = (orignalFn, onError, onSuccess) => (...args) => {
  let returnVal;
  const callOnSuccess = (returnVal) => {
    if (isFunction(onSuccess)) {
      onSuccess(returnVal, args);
    }
  };
  const callOnError = (error) => {
    if (isFunction(onError)) {
      onError(error);
    }
  };

  try {
    returnVal = orignalFn(...args);
  } catch (err) {
    // Call error handler on synchronous errors too
    callOnError(err);
    throw err;
  }

  // Is returned value Promise-like?
  if (returnVal && isFunction(returnVal.then)) {
    returnVal.then(result => {
      callOnSuccess(result)
    })
    .catch(err => {
      callOnError(err);
    });
  } else {
    // Just call synchronous success handler
    callOnSuccess(returnVal);
  }

  return returnVal;
};

module.exports = {
  toKeymap,
  getRejectedPromiseIfTimedOut,
  wrapCompletedHandlers,
  TimeoutError
};