/**
 * Created by balmasi on 2017-06-02.
 */

function LoggingPlugin (pluginAPI) {
  const log = pluginAPI.getPluginLogger();
  log.info('Using Logging Plugin');

  return {
    send: next =>
      (routingKey, message, options) => {
        log.info(`  [>] sending %j to ${routingKey}.`, message);
        return next(routingKey, message, options);
      },
    listen: next =>
      async (routingKey, listenFn, options) => {
        function logPassThrough (msg) {
          const ret = listenFn(msg);
          // We have to place this log after listenFn cause it contains our deserialization logic
          log.info(`  [<] received %j on ${routingKey} via listen.`, msg.content);
          return ret;
        }

        const consumeReturnVal = await next(routingKey, logPassThrough, options);
        log.info(`Consumer ${consumeReturnVal.consumerTag} waiting for commands on routing key ${routingKey}.`);
        return consumeReturnVal;
      },
    publish: next =>
      (routingKey, message, options) => {
        log.info(`  [>] pubulishing %j to ${routingKey}.`, message);
        return next(routingKey, message, options);
      },
    subscribe: next =>
      (routingKey, subscribeFn, options) => {
        function logPassThrough (msg) {
          const ret = subscribeFn(msg);
          // We have to place this log after subscribeFn cause it contains our deserialization logic
          log.info(`  [<] %j on ${routingKey} via subscribe.`, msg.content);
          return ret;
        }
        return next(routingKey, logPassThrough, options);
      }
  }
}

module.exports = LoggingPlugin;