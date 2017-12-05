const { getRejectedPromiseIfTimedOut } = require('./timeout.plugin.helper');


/**
 * The middleware pipeline function following the plugin specification
 * @param {function} next - next function in the pipeline
 * @return {function}
 */
const timeoutMiddleware = next => (routingKey, message, options) => {
  const originalCallPromise = next(routingKey, message, options);
  const shouldRaceTimeout = options && options.sync && options.timeoutMs;
  // If timeout option is set we want to race the rpc promise resolution with timeout rejection
  return shouldRaceTimeout ?
    Promise.race([originalCallPromise, getRejectedPromiseIfTimedOut(options.timeoutMs)]) :
    originalCallPromise;
};

module.exports = function (pluginAPI) {
  const log = pluginAPI.getPluginLogger();
  log.info('Using Timeout Plugin.');
  return {
    send:  timeoutMiddleware,
  };
};