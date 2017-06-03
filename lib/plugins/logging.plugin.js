/**
 * Created by balmasi on 2017-06-02.
 */

function LoggingPlugin (middlewareApi) {
  const log = middlewareApi.getPluginLogger();
  log.debug('Using LoggingPlugin');

  return {
    send: next =>
      (routingKey, message, options) => {
        const publishResponse = next(routingKey, message, options);
        log.info(`  [>] ${JSON.stringify(message)} to ${routingKey} via send`);
        return publishResponse;
      },
    listen: next =>
      async (routingKey, listenFn, options) => {
        function logPassThrough (msg) {
          const msgString = msg.content.toString();
          log.info(`  [<] ${msgString} on ${routingKey} via listen.`);
          return listenFn(msg);
        }

        const consumeReturnVal = await next(routingKey, logPassThrough, options);
        log.info(`Consumer ${consumeReturnVal.consumerTag} waiting for commands on routing key ${routingKey}.`);
        return consumeReturnVal;
      },
    publish: next =>
      (routingKey, message, options) => {
        const publishResponse = next(routingKey, message, options);
        log.info(`  [>] ${JSON.stringify(message)} to ${routingKey} via publish.`);
        return publishResponse;
      },
    subscribe: next =>
      (routingKey, subscribeFn, options) => {
        function logPassThrough (msg) {
          const msgString = msg.content.toString();
          log.info(`  [<] ${msgString} on ${routingKey} via subscribe.`);
          return subscribeFn(msg);
        }

        return next(routingKey, logPassThrough, options);
      }
  }
}

module.exports = LoggingPlugin;