/**
 * Created by balmasi on 2017-06-02.
 */

function DefaultPlugin (middlewareApi) {
  const ch = middlewareApi.getChannel();
  const initialOptions = middlewareApi.getInitialOptions();
  const log = middlewareApi.getLogger();

  return {
    send: next =>
      async (routingKey, message, options) => {

        const exchange = initialOptions.commandExchangeName;
        await ch.assertExchange(exchange, 'direct');
        const msgBuffer = new Buffer(JSON.stringify(message));
        const modifiedOptions = Object.assign({}, options, { persistent: true })
        return next(exchange, routingKey, msgBuffer, modifiedOptions);
      },

    listen: next =>
      async (routingKey, listenFn, options) => {
        const qName = initialOptions.listenQueueName;
        const exchange = initialOptions.commandExchangeName;
        await ch.assertExchange(exchange, 'direct');
        await ch.assertQueue(qName, { durable: true });
        await ch.bindQueue(qName, exchange, routingKey);
        await ch.prefetch(1);

        async function listenFnWithAckReject (msg) {
          msg.ack  = () => {
            log.debug('Message acknowledged.');
            ch.ack(msg);
          };

          msg.reject  = () => {
            log.debug('Message rejected.');
            ch.reject(msg);
          };

          listenFn(msg);
        }

        return next(
          qName,
          listenFnWithAckReject,
          Object.assign({}, options, { noAck: false })
        );
      },

    publish: next =>
      async (routingKey, message, options) => {
        const exchange = initialOptions.eventExchangeName;
        await ch.assertExchange(exchange, 'topic');
        const msgBuffer = new Buffer(JSON.stringify(message));
        return next(exchange, routingKey, msgBuffer, options);
      },

    subscribe: next =>
      async (routingKey, listenFn, options) => {
        const qName = initialOptions.subscriptionQueueName;
        const exchange = initialOptions.eventExchangeName;
        await ch.assertExchange(exchange, 'topic');
        await ch.assertQueue(qName);
        await ch.bindQueue(qName, exchange, routingKey);

        const returnVal = await next(
          qName,
          listenFn,
          Object.assign({}, options, { noAck: true })
        );

        // log.info(`Consumer ${returnVal.consumerTag} subscribed on topic ${routingKey}.`);
        return returnVal;
      },
  };
}

module.exports = DefaultPlugin;