/**
 * Created by balmasi on 2017-05-30.
 */


const _ = require('lodash');
const debug = require('debug');

const Plugins = require('./src/lib/plugin');
const DefaultEngine = require('./src/lib/engines/default.engine');
const DefaultConnectionManager = require('./src/lib/connectionManager');
const JsonSerialization = require('./src/lib/serialization/json');
const BuiltInPlugins = require('./src/lib/plugins');


const log = {
  info: debug('bunnyhop:info'),
  error: debug('bunnyhop:error'),
  debug: debug('bunnyhop:debug')
};


function BunnyHop (serviceName, options = {}) {
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


  let hasCustomEngine = false;
  let registeredPlugins = [
    DefaultEngine
  ];

  const pluginManagerPromise = options.connectionManager(options.url)
      .then(({ channel, connection }) => {
        const pluginManager = Plugins({ channel, connection, options, serviceName });
        pluginManager.initalizePlugins(registeredPlugins);
        return pluginManager;
      });

  return {
    engine: function engine (engine) {
      if (!hasCustomEngine && _.first(registeredPlugins) === DefaultEngine) {
        registeredPlugins = [engine, ...registeredPlugins.slice(1)];
        hasCustomEngine = true;
      }
      return this;
    },

    use: function use (plugin) {
      registeredPlugins.push(plugin);
      return this;
    },

    send: async (routingKey, message, options) => {
      const pm = await pluginManagerPromise;
      return pm
        .send(routingKey, message, options)
        .catch(err => {
          log.error(`${routingKey} via send failed with: %j`, err);
          return Promise.reject(err);
        });
    },

    listen: async (routingKey, listenFn, options) => {
      const pm = await pluginManagerPromise;
      return pm
        .listen(routingKey, listenFn, options)
        .catch( err => {
          log.error(`Failed to consume ${routingKey} via listen.`);
          log.error(err);
        });
    },


    publish: async (routingKey, message, options) => {
      const pm = await pluginManagerPromise;
      return pm
        .publish(routingKey, message, options)
        .catch( err => {
          log.error(`Failed to publish ${routingKey} via publish.`);
          log.error(err);
        });
    },


    async subscribe (routingKey, listenFn, options) {
      const pm = await pluginManagerPromise;
      return pm
        .subscribe(routingKey, listenFn, options)
        .catch( err => {
          log.error(`Failed to consume ${routingKey} via subscribe.`);
          log.error(err);
        });
    }
  };
}

// Expose the built in plugins
BunnyHop.Plugins = BuiltInPlugins;
module.exports = BunnyHop;