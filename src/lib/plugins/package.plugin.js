/**
 * Created by balmasi on 2017-06-05.
 */
const _ = require('lodash');

const jsonSerializer = require('../serialization/json');

/**
 * Decorates outgoing messages with dateIssued, type, and data
 * where data is the payload, dateIssued is the time we're sending the message, and
 * type is the routing key
 *
 * @param {object} message
 * @param {string} routingKey - where the message is going
 * @return {{dateIssued: string, data: object, type: string}}
 */
function packageOutgoingMessage (message, routingKey) {
  return {
    dateIssued: (new Date()).toISOString(),
    data: message,
    type: routingKey
  };
}

/**
 * Adds a date the event was observed by the listening system to the payload
 * This is useful for identifying and optimizing performance issueus
 * @param {object} message - the amqp message
 * @param {string} routingKey- the routingKey where the message is coming from
 * @return {object} - the amqp message with its content decorated
 */
function packageIncomingMessage (message, routingKey) {
  // Get the dateIssued in case it's already packaged on the other side
  const dateIssued = _.get(message, 'content.dateIssued');
  const isPrePackaged =
    _.get(message, 'content.data') &&
    _.get(message, 'content.dateIssued') &&
    _.get(message, 'content.type');

  const data = isPrePackaged ? message.content.data : message.content;

  // Return a copy of the incoming message with the content modified
  return Object.assign(
    {
      content: {
        dateProcessed: (new Date()).toISOString(),
        data: _.omit(data, ['type']),
        type: _.get(message, 'fields.routingKey'),
        dateIssued
      }
    },
    _.omit(message, ['content'])
  );
}

function incomingMiddleware (next) {
  return (routingKey, listenOrSubscribeFn, options) => {
    function decoratedListenOrSubscribeFn (msg) {
      return listenOrSubscribeFn(packageIncomingMessage(msg, routingKey));
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