/**
 * Created by balmasi on 2017-05-31.
 */
const _ = require('lodash');
const { toKeymap } = require('./util');
const debug = require('debug');

const log = {
  info: debug('bunnyhop:info:plugin'),
  error: debug('bunnyhop:error:plugin'),
  debug: debug('bunnyhop:debug:plugin')
};
const HOOKS = ['send', 'listen', 'publish', 'subscribe'];
const HOOK_MAP = toKeymap(HOOKS);

function validatedPlugin (pluginExports = {})  {
  // Does the middleware have at least one of the hooks defined?
  const hasHooks = _.difference(HOOKS, Object.keys(pluginExports)).length < HOOKS.length;
  if (!hasHooks) {
    throw new TypeError(`BunnyHop middleware must have at least one hook defined. Valid hooks are ${HOOKS.join(', ')}`);
  }
  const invalidHooks = HOOKS
    .filter(hook => !(_.isUndefined(pluginExports[hook]) || _.isFunction(pluginExports[hook])));
  if (invalidHooks.length) {
    throw new TypeError(`Invalid hooks ${invalidHooks.join(', ')} for middleware. Hooks be either a undefined, or a function. Valid hooks are ${HOOKS.join(', ')}`);
  }

  return pluginExports;
}


function getpluginAPI (bunnyHopOptions) {
  const { channel, options, connection, serviceName } = bunnyHopOptions;
  return {
    getChannel () { return channel; },
    getConnection () { return connection },
    getInitialOptions () { return options; },
    getServiceName () { return serviceName },
    getPluginLogger () { return log; }
  };
}

/**
 *
 * @param {{ channel, connection, initialOptions, serviceName }} bunnyHopOptions
 * @return {object} Plugin interface
 */
function  Plugin (bunnyHopOptions) {
  const pluginAPI = getpluginAPI(bunnyHopOptions);
  let initializedPlugins;

  function runPipeline (hookName, ...args) {
    const hookPipeline = initializedPlugins
      // Only keep the plugins that have the hook we're interested in
      .filter(plugin => _.isFunction(plugin[hookName]))
      // get the hook function from the plugin
      .map(plugin => plugin[hookName]);

    const [ engine, ...pipeline]= hookPipeline;
    const fullPipeline = _.flow(pipeline)(engine);
    return fullPipeline(...args);
  }


  return {
    initalizePlugins: (plugins = []) => {
      // Provide the bunny hop options for plugins to initialize themselves and return hooks
      initializedPlugins = plugins.map(pluginInitializer => {
        return validatedPlugin(
          pluginInitializer(pluginAPI)
        );
      });
    },
    send: (...args) => runPipeline(HOOK_MAP.SEND, ...args),
    publish: ( ...args) => runPipeline(HOOK_MAP.PUBLISH, ...args),
    listen: (...args) => runPipeline(HOOK_MAP.LISTEN, ...args),
    subscribe: (...args) => runPipeline(HOOK_MAP.SUBSCRIBE, ...args)
  }
}


module.exports = Plugin;