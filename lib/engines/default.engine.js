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

  const defaults = {
    errorFormatter: error => _.pick(error, ['message', 'code', 'details']),
    serializer: content => new Buffer(JSON.stringify(content)),
    deserializer: buffer => JSON.parse(buffer.toString()),
    commandExchangeName: 'commands',
    eventExchangeName: 'events',
    subscriptionQueueName: `${serviceName}_subscription`,
    listenQueueName: `${serviceName}_listen`,
  };

  const engineOptions = _.defaults(
    _.clone(initialOptions),
    defaults
  );

  return {
    send: next =>
      async (routingKey, message, options) => {
        // Send request
        const exchange = engineOptions.commandExchangeName;
        const msgBuffer = new Buffer(JSON.stringify(message));
        await ch.assertExchange(exchange, EXCHANGE_TYPE.DIRECT);

        // Response Listen queue
        const { queue } = await ch.assertQueue('', { exclusive: true });
        return new Promise(async (resolve, reject) => {
          const uid = _.padStart(_.random(1, 9999999999), 10, '0');

          function maybeAnswer (msg) {
            if (msg.properties.correlationId === uid) {

              const { result, error } = engineOptions.deserializer(msg.content);
              return _.isUndefined(result) ? reject(error) : resolve(result);
            }
          }
          await ch.consume(queue, maybeAnswer, { noAck: true });
          const modifiedOptions = Object.assign({}, options, {
            replyTo: queue,
            correlationId: uid,
            persistent: true
          });
          next(exchange, routingKey, msgBuffer, modifiedOptions);
        });
      },

    listen: next =>
      async (routingKey, listenFn, options = {}) => {
        _.defaults(options, {
          autoAck: true
        });
        const qName = engineOptions.listenQueueName;
        const exchange = engineOptions.commandExchangeName;
        await ch.assertExchange(exchange, EXCHANGE_TYPE.DIRECT);
        await ch.assertQueue(qName, { durable: true });
        await ch.bindQueue(qName, exchange, routingKey);
        await ch.prefetch(1);



        async function getResponse(reqMsg) {
          let result;
          let error;

          if (options.autoAck) {
            log.debug('Message Auto-Acknowledged');
            ch.ack(reqMsg);
          } else  {
            reqMsg.ack  = () => {
              log.debug('Message acknowledged.');
              ch.ack(reqMsg);
            };

            reqMsg.reject  = () => {
              log.debug('Message rejected.');
              ch.reject(reqMsg);
            };
          }

          try {
            result = await listenFn(reqMsg);
          } catch (err) {
            error = engineOptions.errorFormatter(err);
          }

          const response = { result, error };
          const { replyTo, correlationId } = reqMsg.properties;

          await ch.sendToQueue(
            replyTo,
            engineOptions.serializer(response),
            { correlationId }
          );
        }

        return next(
          qName,
          getResponse,
          Object.assign({}, options, { noAck: false })
        );
      },

    publish: next =>
      async (routingKey, message, options) => {
        const exchange = engineOptions.eventExchangeName;
        await ch.assertExchange(exchange, EXCHANGE_TYPE.TOPIC);
        const msgBuffer = new Buffer(JSON.stringify(message));
        const modifiedOptions = Object.assign({}, options, { persistent: true });
        return next(exchange, routingKey, msgBuffer, modifiedOptions);
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