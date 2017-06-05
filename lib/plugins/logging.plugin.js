/**
 * Created by balmasi on 2017-06-02.
 */

function LoggingPlugin (pluginAPI) {
  const log = pluginAPI.getPluginLogger();
  const bunnyOptions = pluginAPI.getInitialOptions();
  log.debug('Using LoggingPlugin');

  return {
    send: next =>
      (routingKey, message, options) => {
        const publishResponse = next(routingKey, message, options);
        log.info(`  [>] %j to ${routingKey} via send.`, message);
        return publishResponse;
      },
    listen: next =>
      async (routingKey, listenFn, options) => {
        function logPassThrough (msg) {
          log.info(`  [<] %j on ${routingKey} via listen.`, msg.content);
          return listenFn(msg);
        }

        const consumeReturnVal = await next(routingKey, logPassThrough, options);
        log.info(`Consumer ${consumeReturnVal.consumerTag} waiting for commands on routing key ${routingKey}.`);
        return consumeReturnVal;
      },
    publish: next =>
      (routingKey, message, options) => {
        const publishResponse = next(routingKey, message, options);
        log.info(`  [>] %j to ${routingKey} via publish.`, message);
        return publishResponse;
      },
    subscribe: next =>
      (routingKey, subscribeFn, options) => {
        function logPassThrough (msg) {
          log.info(`  [<] %j on ${routingKey} via subscribe.`, msg.content);
          return subscribeFn(msg);
        }

        return next(routingKey, logPassThrough, options);
      }
  }
}

module.exports = LoggingPlugin;