/**
 * Created by balmasi on 2017-06-05.
 */
const uuid = require('uuid');

/**
 * Adds a correlationId on message if one isn't already defined
 * @param {object} option - a json you want to send across the wire
 * @return {object} - message with correlationId added as a property if not already defined
 */
function assertId (option) {
  return Object.assign(
    {},
    { correlationId: uuid.v4() },
    option
  );
}

/**
 * The middleware pipeline function following the plugin specification
 * @param {function} next - next function in the pipeline
 * @return {function}
 */
function assertIdMiddleware (next) {
  return (routingKey, message, options) => {
    const modifiedOptions = assertId(options);
    const publishResponse = next(routingKey, message, modifiedOptions);
    return publishResponse;
  }
}

module.exports = function () {
  return {
    send:  assertIdMiddleware,
    publish: assertIdMiddleware
  };
};