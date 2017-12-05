/**
 * Created by balmasi on 2017-05-31.
 */
const { snakeCase, isFunction } = require('lodash');


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
 * Wraps an onSuccess and onError handler around a function
 * @param {function} orignalFn
 * @param {function} [onError]
 * @param {function} [onSuccess]
 * @return {*} - returns whatever the original function would have returned
 */
const wrapCompletedHandlers = (orignalFn, onError, onSuccess) => (...args) => {
  const callOnSuccess = (returnValue) => {
    if (isFunction(onSuccess)) {
      onSuccess(returnValue, ...args);
    }
    return returnValue;
  };
  const callOnError = (error) => {
    if (isFunction(onError)) {
      onError(error);
    } else {
      throw error;
    }
  };

  let returnVal;
  // Catch synchronous errors
  try {
    returnVal = orignalFn(...args);
  } catch (err) {
    // Call error handler on synchronous errors too
    callOnError(err);
  }

  // Is returned value Promise-like?
  if (returnVal && isFunction(returnVal.then)) {
    // Run success handler side effects
    // Make sure to capture and consume the error message on returned value
    return returnVal.then(callOnSuccess).catch(callOnError);
  }

  // Must be Synchronous - Just call synchronous success handler
  callOnSuccess(returnVal);
  return returnVal
};

module.exports = {
  toKeymap,
  wrapCompletedHandlers
};