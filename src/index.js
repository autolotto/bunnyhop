/**
 * Created by balmasi on 2017-05-30.
 */


const _ = require('lodash');
const debug = require('debug');

const Plugins = require('./lib/plugin');
const { wrapCompletedHandlers } = require('./lib/util');
const JsonSerialization = require('./lib/serialization/json');
const BuiltInPlugins = require('./lib/plugins/index');
const BuiltInEngines = require('./lib/engines/index');

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
    engine: BuiltInEngines.DefaultEngine,
    url: 'amqp://localhost',
    serialization: JsonSerialization,
    connectionManager: BuiltInEngines.DefaultEngine.ConnectionManager
    /*
    onHandlerError: fn,
    onHandlerSuccess: fn
     */
  });

  let hasCustomEngine = options.engine !== BuiltInEngines.DefaultEngine;
  let registeredPlugins = [options.engine];

  const pluginManagerPromise = options.connectionManager(options.url)
    .then(({ channel, connection }) => {
      const pluginManager = Plugins({ channel, connection, options, serviceName });
      pluginManager.initalizePlugins(registeredPlugins);
      return pluginManager;
    });

  return {
    engine: function engine (engine) {
      registeredPlugins = [engine, ...registeredPlugins.slice(1)];
      hasCustomEngine = true;
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

    listen: async (routingKey, listenFn, listenOptions) => {
      const pm = await pluginManagerPromise;
      const handler = wrapCompletedHandlers(listenFn, options.onHandlerError, options.onHandlerSuccess);
      return pm.listen(routingKey, handler, listenOptions);
    },


    publish: async (routingKey, message, options) => {
      const pm = await pluginManagerPromise;
      return pm.publish(routingKey, message, options)
    },

    async subscribe (routingKey, subscribeFn, subscribeOptions) {
      const pm = await pluginManagerPromise;
      const handler = wrapCompletedHandlers(subscribeFn, options.onHandlerError, options.onHandlerSuccess);
      return pm.subscribe(routingKey, handler, subscribeOptions);
    }
  };
}

// Expose the built in plugins
BunnyHop.Plugins = BuiltInPlugins;
BunnyHop.Engines = BuiltInEngines;
module.exports = BunnyHop;