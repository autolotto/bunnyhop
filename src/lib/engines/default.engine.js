/**
 * Created by balmasi on 2017-06-02.
 */
const _ = require('lodash');
const debug = require('debug');
const uuid = require('uuid');

const { EXCHANGE_TYPE } = require('../amqp');

const log = {
  info: debug('bunnyhop:info:engine'),
  error: debug('bunnyhop:error:engine'),
  debug: debug('bunnyhop:debug:engine')
};

function DefaultEngine (pluginAPI) {
  const ch = pluginAPI.getChannel();
  const initialOptions = pluginAPI.getInitialOptions();
  const serviceName = pluginAPI.getServiceName();

  const defaults = {
    errorFormatter: error => _.pick(error, ['message', 'code', 'details']),
    topicExchangeName: 'amqp.topic',
    fanoutExchangeName: 'amqp.fanout'
  };

  const engineOptions = _.defaults(
    _.clone(initialOptions),
    defaults
  );

  const { deserialize, serialize } = engineOptions.serialization;

  return {
    send:
      async (routingKey, message, options = {}) => {
        // Send request
        const publishWithOptions = opts => ch.publish(exchange, routingKey, msgBuffer, opts);
        const exchange = engineOptions.topicExchangeName;
        const msgBuffer = new Buffer(JSON.stringify(message));
        await ch.assertExchange(exchange, EXCHANGE_TYPE.TOPIC);
        // Generate custom publish options here (like custom headers)
        const commonOptions = _.merge(
          { appId: serviceName },
          options,
          {
            headers: {
              'x-isRpc': Boolean(options.sync)
            }
          }
        );

        // Response Listen queue
        if (options.sync) {
          const { queue } = await ch.assertQueue('', { exclusive: true });
          return new Promise(async (resolve, reject) => {
            const uid = options.correlationId || uuid.v4();

            function maybeAnswer (msg) {
              if (msg.properties.correlationId === uid) {

                const { result, error } = deserialize(msg.content);
                return _.isUndefined(result) ? reject(error) : resolve(result);
              }
            }
            await ch.consume(queue, maybeAnswer, { noAck: true });
            const modifiedOptions = Object.assign({}, commonOptions, {
              replyTo: queue,
              correlationId: uid,
              persistent: true
            });
            publishWithOptions(modifiedOptions);
          });
        } else {
          publishWithOptions(commonOptions)
        }
      },

    listen:
      async (routingKey, listenFn, options = {}) => {
        const listenOptions = _.merge(
          { appId: serviceName, autoAck: true },
          options,
          { noAck: false }
        );
        // This creates a queue per every listen pattern
        const qPrefix = serviceName !== listenOptions.appId ?
          `${serviceName}_${appId}` :
          serviceName;
        const qName = `${qPrefix}_listen:${routingKey}`;
        const topicExchange = engineOptions.topicExchangeName;
        await ch.assertExchange(topicExchange, EXCHANGE_TYPE.TOPIC);
        await ch.assertQueue(qName, { durable: true });
        await ch.bindQueue(qName, topicExchange, routingKey);
        await ch.prefetch(1);

        async function getResponse(reqMsg) {
          let result;
          let error;
          if (listenOptions.autoAck) {
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

          reqMsg.content = deserialize(reqMsg.content);

          try {
            result = await listenFn(reqMsg);
          } catch (err) {
            error = engineOptions.errorFormatter(err);
          }

          const response = { result, error };
          const { replyTo, correlationId } = reqMsg.properties;

          await ch.sendToQueue(
            replyTo,
            serialize(response),
            { correlationId }
          );
        }

        return ch.consume(
          qName,
          getResponse,
          listenOptions
        );
      },

    publish:
      async (routingKey, message, options) => {
        const exchange = engineOptions.eventExchangeName;
        await ch.assertExchange(exchange, EXCHANGE_TYPE.TOPIC);
        const msgBuffer = serialize(message);
        const modifiedOptions = Object.assign(
          { appId: serviceName },
          options,
          { persistent: true }
        );
        return ch.publish(exchange, routingKey, msgBuffer, modifiedOptions);
      },

    subscribe:
      async (routingKey, listenFn, options) => {
        const qName = engineOptions.subscriptionQueueName;
        const exchange = engineOptions.eventExchangeName;
        await ch.assertExchange(exchange, EXCHANGE_TYPE.TOPIC);
        await ch.assertQueue(qName);
        await ch.bindQueue(qName, exchange, routingKey);

        function deserializeMessage (msg) {
          msg.content = deserialize(msg.content);
          return listenFn(msg);
        }

        return ch.consume(
          qName,
          deserializeMessage,
          Object.assign({}, options, { noAck: true })
        );
      },
  };
}

module.exports = DefaultEngine;