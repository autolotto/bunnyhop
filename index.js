/**
 * Created by balmasi on 2017-05-30.
 */


const _ = require('lodash');
const debug = require('debug');

const Plugins = require('./lib/plugin');
const DefaultEngine = require('./lib/engines/default.engine');
const DefaultConnectionManager = require('./lib/connectionManager');
const JsonSerialization = require('./lib/serialization/json');


const log = {
  info: debug('bunnyhop:info'),
  error: debug('bunnyhop:error'),
  debug: debug('bunnyhop:debug')
};


module.exports = function BunnyHop (serviceName, options = {}) {
  if (!_.isString(serviceName)) {
    throw new TypeError('serviceName argument is required');
  }

  /* Configure default options
      Note: you can pass in custom options which get exposed through the middleware API
  */
  _.defaults(options, {
    url: 'amqp://localhost',
    serialization: JsonSerialization,
    connectionManager: DefaultConnectionManager
  });

  let pluginManager;
  let hasCustomEngine = false;
  let registeredPlugins = [
    DefaultEngine
  ];

  const connectedPromise = options.connectionManager(options.url)
      .then(({ channel, connection }) => {
        pluginManager = Plugins({ channel, connection, options, serviceName });
        pluginManager.initalizePlugins(registeredPlugins);
      });

  return {
    engine (engine) {
      if (!hasCustomEngine && _.first(registeredPlugins) === DefaultEngine) {
        registeredPlugins = [engine, ...registeredPlugins.slice(1)];
        hasCustomEngine = true;
      }
      return this;
    },

    use (plugin) {
      registeredPlugins.push(plugin);
      return this;
    },

    async send (routingKey, message, options) {
      await connectedPromise;
      return pluginManager
        .send(routingKey, message, options)
        .catch(err => {
          log.error(`${routingKey} via send failed with: %j`, err);
          return Promise.reject(err);
        });
    },

    async listen (routingKey, listenFn, options) {
      await connectedPromise;
      return pluginManager
        .listen(routingKey, listenFn, options)
        .catch( err => {
          log.error(`Failed to consume ${routingKey} via listen.`);
          log.error(err);
        });
    },


    async publish (routingKey, message, options) {
      await connectedPromise;
      return pluginManager
        .publish(routingKey, message, options)
        .catch( err => {
          log.error(`Failed to publish ${routingKey} via publish.`);
          log.error(err);
        });
    },


    async subscribe (routingKey, listenFn, options) {
      await connectedPromise;
      return pluginManager
        .subscribe(routingKey, listenFn, options)
        .catch( err => {
          log.error(`Failed to consume ${routingKey} via subscribe.`);
          log.error(err);
        });
    }
  };
};