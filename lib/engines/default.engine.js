/**
 * Created by balmasi on 2017-06-02.
 */
const _ = require('lodash');
const { EXCHANGE_TYPE } = require('../amqp');
function DefaultEngine (middlewareApi) {
  const ch = middlewareApi.getChannel();
  const initialOptions = middlewareApi.getInitialOptions();
  const serviceName = middlewareApi.getServiceName();
  const log = middlewareApi.getLogger();
  const engineOptions = _.defaults(
    _.clone(initialOptions),
    {
      commandExchangeName: 'commands',
      eventExchangeName: 'events',
      subscriptionQueueName: `${serviceName}_subscription`,
      listenQueueName: `${serviceName}_listen`
    }
  );

  return {
    send: next =>
      async (routingKey, message, options) => {
        const exchange = engineOptions.commandExchangeName;
        await ch.assertExchange(exchange, EXCHANGE_TYPE.DIRECT);
        const msgBuffer = new Buffer(JSON.stringify(message));
        const modifiedOptions = Object.assign({}, options, { persistent: true });
        return next(exchange, routingKey, msgBuffer, modifiedOptions);
      },

    listen: next =>
      async (routingKey, listenFn, options) => {
        const qName = engineOptions.listenQueueName;
        const exchange = engineOptions.commandExchangeName;
        await ch.assertExchange(exchange, EXCHANGE_TYPE.DIRECT);
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
        const exchange = engineOptions.eventExchangeName;
        await ch.assertExchange(exchange, EXCHANGE_TYPE.TOPIC);
        const msgBuffer = new Buffer(JSON.stringify(message));
        return next(exchange, routingKey, msgBuffer, options);
      },

    subscribe: next =>
      async (routingKey, listenFn, options) => {
        const qName = engineOptions.subscriptionQueueName;
        const exchange = engineOptions.eventExchangeName;
        await ch.assertExchange(exchange, EXCHANGE_TYPE.TOPIC);
        await ch.assertQueue(qName);
        await ch.bindQueue(qName, exchange, routingKey);

        const returnVal = await next(
          qName,
          listenFn,
          Object.assign({}, options, { noAck: true })
        );

        return returnVal;
      },
  };
}

module.exports = DefaultEngine;