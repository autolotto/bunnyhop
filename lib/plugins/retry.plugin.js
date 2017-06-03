/**
 * Created by balmasi on 2017-06-03.
 */

const ackRejectDecorator = (listenFn, log, channel) => msg => {
  msg.ack  = () => {
    log.debug('Message acknowledged.');
    channel.ack(msg);
  };

  msg.reject  = () => {
    log.debug('Message rejected.');
    channel.reject(msg);
  };

  return listenFn(msg);
};

function RetryPlugin (middlewareApi) {
  const log = middlewareApi.getLogger();
  const ch = middlewareApi.getChannel();
  log.debug('Using RetryPlugin');

  return {
    send: next =>
      async (routingKey, message, options) => {
        const modifiedOptions = Object.assign({}, options, { persistent: true })
        return next(routingKey, message, modifiedOptions);
      },

    listen: next =>
      async (routingKey, listenFn, options) => {
        return next(
          routingKey,
          ackRejectDecorator(listenFn, log, ch),
          Object.assign({}, options, { noAck: false })
        );
      }
  };
}

module.exports = RetryPlugin;