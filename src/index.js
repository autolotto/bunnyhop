/**
 * Created by balmasi on 2017-05-30.
 */


const _ = require('lodash');
const debug = require('debug');

const Plugins = require('./lib/plugin');
const DefaultEngine = require('./lib/engines/default.engine.js');
const DefaultConnectionManager = require('./lib/connectionManager');
const JsonSerialization = require('./lib/serialization/json');
const BuiltInPlugins = require('./lib/plugins/index');


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
      return pm.send(routingKey, message, options)
    },

    listen: async (routingKey, listenFn, options) => {
      const pm = await pluginManagerPromise;
      return pm.listen(routingKey, listenFn, options);
    },


    publish: async (routingKey, message, options) => {
      const pm = await pluginManagerPromise;
      return pm.publish(routingKey, message, options)
    },


    async subscribe (routingKey, listenFn, options) {
      const pm = await pluginManagerPromise;
      return pm.subscribe(routingKey, listenFn, options);
    }
  };
}

// Expose the built in plugins
BunnyHop.Plugins = BuiltInPlugins;
module.exports = BunnyHop;