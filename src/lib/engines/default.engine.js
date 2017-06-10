/**
 * Created by balmasi on 2017-06-02.
 */
const _ = require('lodash');
const debug = require('debug');
const uuid = require('uuid');
const { EventEmitter } = require('events');

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
    topicExchangeName: 'amq.topic',
    directExchangeName: 'amq.direct',
    rpcReplyQueue: `${serviceName}_replies`
  };

  const engineOptions = _.defaults(
    _.clone(initialOptions),
    defaults
  );

  const { deserialize, serialize } = engineOptions.serialization;

  const directExchange = engineOptions.directExchangeName;
  log.debug(`Asserting ${EXCHANGE_TYPE.DIRECT} exchange "${directExchange}"`);
  ch.assertExchange(directExchange, EXCHANGE_TYPE.DIRECT);


  const REPLY_QUEUE = engineOptions.rpcReplyQueue;
  ch.responseEmitter = new EventEmitter();
  ch.responseEmitter.setMaxListeners(0);
  log.debug(`Asserting durable queue "${REPLY_QUEUE}" for RPC calls.`);
  ch.assertQueue(REPLY_QUEUE, { durable: true });
  ch.consume(REPLY_QUEUE,
    msg => {
      ch.responseEmitter.emit(
        msg.properties.correlationId,
        msg.content
      )
    }
    ,{ noAck: true }
  );

  return {
    send:
      async (routingKey, message, options = {}) => {
        const msgBuffer = new Buffer(JSON.stringify(message));

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

        const sendWithOptions = (opt = {}) =>
          ch.publish(directExchange, routingKey, msgBuffer, _.merge(commonOptions, opt));

        // Response Listen queue
        if (options.sync) {
          return new Promise(async (resolve, reject) => {
            const uid = options.correlationId || uuid.v4();
            const handleResponsePromise = (msgContent) => {
              const { result, error } = deserialize(msgContent);
              return !_.isUndefined(error) ? reject(error) : resolve(result);
            };
            // listen for the content emitted on the correlationId event
            ch.responseEmitter.once(uid, handleResponsePromise);
            sendWithOptions({
              replyTo: REPLY_QUEUE,
              correlationId: uid
            });
          })
        }

        sendWithOptions();

      },

    listen:
      async (routingKey, listenFn, options = {}) => {
        if ((/[*#]/g).test(routingKey)) {
          throw new TypeError('Routing key cannot contain * or # for "listen".');
        }
        const listenOptions = _.merge(
          { appId: serviceName, autoAck: true },
          options,
          { noAck: false }
        );
        // This creates a queue per every listen pattern
        const qName = routingKey;
        const directExchange = engineOptions.directExchangeName;
        log.debug(`Listen: Asserting ${EXCHANGE_TYPE.DIRECT} exchange "${directExchange}"`);
        await ch.assertExchange(directExchange, EXCHANGE_TYPE.DIRECT);
        log.debug(`Listen: Asserting durable queue "${qName}"`);
        await ch.assertQueue(qName, { durable: true });
        log.debug(`Listen: Binding queue "${qName}" to exchange "${directExchange}" with ${routingKey}`);
        await ch.bindQueue(qName, directExchange, routingKey);
        log.debug(`Listen: Setting prefetch to 1`);
        await ch.prefetch(1);

        async function getResponse(reqMsg) {
          let result;
          let error;
          const isRpc = _.get(reqMsg, 'properties.headers["x-isRpc"]', false);

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

          const listenerReturn = listenFn(reqMsg);
          if (isRpc) {
            try {
              result = await listenerReturn;
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

        }

        return ch.consume(
          qName,
          getResponse,
          listenOptions
        );
      },

    publish:
      async (routingKey, message, options) => {
        const topicExchange = engineOptions.topicExchangeName;
        await ch.assertExchange(topicExchange, EXCHANGE_TYPE.TOPIC);
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
        const subscribeOptions =  _.merge(
          { appId: serviceName, autoAck: true },
          options,
          { noAck: false }
        );
        await ch.assertExchange(topicExchange, EXCHANGE_TYPE.TOPIC);
        const qName = `${serviceName}_subscribe`;
        // durable == exclusive to this process + doesn't survive restarts
        await ch.assertQueue(qName, { durable: true });
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