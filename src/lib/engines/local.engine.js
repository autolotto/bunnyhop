const _ = require('lodash');

/*
 * This engine simply calls the locally saved function reference.
 *
 * You set what function to call with listen or subscribe.  You call functions with send or publish.
 *
 * Useful for testing bunnyhop APIs
 */
function LocalEngine (pluginAPI) {
  const log = pluginAPI.getPluginLogger();
  log.info('Using LocalEngine');

  const listeners = {};
  const subscriptions = {};

  return {
    send:
      async (routingKey, message, options = {}) => {
        if ((/[*#]/g).test(routingKey)) {
          throw new TypeError('Routing key cannot contain * or # for "send".');
        }
        if (listeners[routingKey] && listeners[routingKey].length) {
          // Take the first listener, to round robin them
          const listenFn = listeners[routingKey].shift();
          if (listenFn) {
            log.info(`  [<] calling test listener for ${routingKey}`);
            const result = listenFn({ content: message });
            // place the first one at the end of the list and continue
            listeners[routingKey].push(listenFn);
            return result;
          }
        }
      },

    listen:
      (routingKey, listenFn, options = {}) => {
        if ((/[*#]/g).test(routingKey)) {
          throw new TypeError('Routing key cannot contain * or # for "listen".');
        }
        if (!listeners[routingKey]) listeners[routingKey] = [];
        log.info(`  [>] setting up a test listener for ${routingKey}`);
        listeners[routingKey].push(listenFn);
        return { consumerTag: pluginAPI.getServiceName() };
      },

    publish:
      async (routingKey, message, options) => {
        // When publishing, publish to ALL subscribers
        if (subscriptions[routingKey] && subscriptions[routingKey].length) {
          subscriptions[routingKey].forEach(listenFn => {
            if (listenFn) {
              log.info(`  [<] calling test subscriber for ${routingKey}`);
              return listenFn({ content: message });
            }
          });
        }
      },

    subscribe:
      (routingKey, listenFn, options) => {
        if (!subscriptions[routingKey]) subscriptions[routingKey] = [];
        log.info(`[>] setting up a test subscriber for ${routingKey}`);
        subscriptions[routingKey].push(listenFn);
        return { consumerTag: pluginAPI.getServiceName() };
      }
  };
}

async function ConnectionManager() {
  return {
    connection: null,
    channel: null
  }
}

LocalEngine.ConnectionManager = ConnectionManager;

module.exports = LocalEngine;