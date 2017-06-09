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
    topicExchangeName: 'topic_exchange',
    fanoutExchangeName: 'fanout_exchange'
  };

  const engineOptions = _.defaults(
    _.clone(initialOptions),
    defaults
  );

  const { deserialize, serialize } = engineOptions.serialization;

  return {
    send:
      async (routingKey, message, options = {}) => {
        const exchange = engineOptions.topicExchangeName;
        const msgBuffer = new Buffer(JSON.stringify(message));
        await ch.assertExchange(exchange, EXCHANGE_TYPE.TOPIC);
        // Generate custom publish options here (like custom headers)
        const commonOptions = _.merge(
          { appId: serviceName },
          options,
          {
            persistent: true,
            headers: {
              'x-isRpc': Boolean(options.sync)
            }
          }
        );

        // Send request
        const publishWithOptions = opts => ch.publish(exchange, routingKey, msgBuffer, opts);

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
        const fanoutExchange = engineOptions.fanoutExchangeName;
        const topicExchange = engineOptions.topicExchangeName;
        await ch.assertExchange(topicExchange, EXCHANGE_TYPE.TOPIC);
        await ch.assertExchange(fanoutExchange, EXCHANGE_TYPE.FANOUT);
        const publishOptions = _.merge(
          { appId: serviceName },
          options,
          { persistent: true, noAck: false  }
        );

        const msgBuffer = serialize(message);
        return ch.publish(topicExchange, routingKey, msgBuffer, publishOptions);
      },

    subscribe:
      async (routingKey, listenFn, options) => {
        const topicExchange = engineOptions.topicExchangeName;
        const fanoutExchange = engineOptions.fanoutExchangeName;
        const subscribeOptions =  _.merge(
          { appId: serviceName, autoAck: true },
          options,
          { noAck: false }
        );
        await ch.assertExchange(topicExchange, EXCHANGE_TYPE.TOPIC);
        await ch.assertExchange(fanoutExchange, EXCHANGE_TYPE.FANOUT);
        // destination, source, pattern
        await ch.bindExchange(fanoutExchange, topicExchange, routingKey);
        // This creates a queue per every listen pattern
        const qPrefix = serviceName !== subscribeOptions.appId ?
          `${serviceName}_${appId}` :
          serviceName;
        const qName = `${qPrefix}_subscribe:${uuid.v4()}`;
        // durable == exclusive to this process + doesn't survive restarts
        await ch.assertQueue(qName, { durable: false });
        await ch.bindQueue(qName, topicExchange, routingKey);

        function transformMessage (msg) {
          if (subscribeOptions.autoAck) {
            log.debug('Message Auto-Acknowledged');
            ch.ack(msg);
          } else  {
            msg.ack  = () => {
              log.debug('Message acknowledged.');
              ch.ack(msg);
            };

            msg.reject  = () => {
              log.debug('Message rejected.');
              ch.reject(msg);
            };
          }
          msg.content = deserialize(msg.content);
          return listenFn(msg);
        }

        return ch.consume(
          qName,
          transformMessage,
          subscribeOptions
        );
      },
  };
}

module.exports = DefaultEngine;