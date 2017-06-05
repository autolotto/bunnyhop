/**
 * Created by balmasi on 2017-06-05.
 */
const jsonSerializer = require('../serialization/json');

/**
 * Decorates outgoing messages with dateIssued, type, and data
 * where data is the payload, dateIssued is the time we're sending the message, and
 * type is the routing key
 *
 * @param {object} message
 * @param {string} routingKey - where the message is going
 * @return {{dateCreated: string, data: object, type: string}}
 */
function packageOutgoingMessage (message, routingKey) {
  return {
    dateCreated: (new Date()).toUTCString(),
    data: message,
    type: routingKey
  };
}

/**
 * Adds a date the event was observed by the listening system to the payload
 * This is useful for identifying and optimizing performance issueus
 * @param {body} message - the amqp message
 * @return {object} - the amqp message with its content decorated
 */
function packageIncomingMessage (message) {
  message.content =  Object.assign(
    { dateProcessed: (new Date()).toUTCString() },
    message.content
  );
  return message;
}

function incomingMiddleware (next) {
  return (routingKey, listenOrSubscribeFn, options) => {
    function decoratedListenOrSubscribeFn (msg) {
      return listenOrSubscribeFn(packageIncomingMessage(msg));
    }
    return next(routingKey, decoratedListenOrSubscribeFn, options);
  }
}

function outgoingMiddleware (next) {
  return (routingKey, message, options) =>
    next(routingKey, packageOutgoingMessage(message, routingKey), options);
}

/**
 * @return {Plugin}
 */
module.exports = function (pluginAPI) {
  const log = pluginAPI.getPluginLogger();
  const { serialization } = pluginAPI.getInitialOptions();
  log.info('Using Package Plugin.')
  if (serialization !== jsonSerializer) {
    throw new TypeError('Package plugin is only compatible with JSON serialization.');
  }

  return {
    send: outgoingMiddleware,
    listen: incomingMiddleware,
    publish: outgoingMiddleware,
    subscribe: incomingMiddleware
  };
};