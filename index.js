/**
 * Created by balmasi on 2017-05-30.
 */

const amqp = require('amqplib');
const _ = require('lodash');
const debug = require('debug');

const Plugins = require('./lib/plugin');

const log = {
  info: debug('bunnyhop:info'),
  error: debug('bunnyhop:error'),
  debug: debug('bunnyhop:debug')
};

const EXCHANGE_TYPE = {
  DIRECT: 'direct',
  FANOUT: 'fanout',
  DEFAULT: '',
  TOPIC: 'topic'
};

module.exports = function BunnyHop (serviceName, initialOptions = {}) {
  if (!_.isString(serviceName)) {
    throw new TypeError('serviceName argument is required');
  }

  _.defaults(initialOptions, {
    url: 'amqp://localhost',
    commandExchangeName: 'commands',
    eventExchangeName: 'events',
    subscriptionQueueName: `${serviceName}_subscription`,
    listenQueueName: `${serviceName}_listen`,
  });

  const channelPromise = amqp
    .connect(initialOptions.url)
    .catch(err => log.error(`Unable to create connection. ${err.message}`))
    .then(conn => {
      log.info(`Connected to amqp host on ${initialOptions.url}. Creating channel.`);
      return conn.createChannel()
    })
    .then(ch => {
      Plugins.init(ch);
      return ch;
    })
    .catch(err => log.error(`Could not connect to amqp url: ${err.message}`));


  return Object.create({
    use: function (middleware) {
      Plugins.register(middleware);
    },
    send: async function(routingKey, body) {
      try {
        const ch = await channelPromise;
        const exchange = initialOptions.commandExchangeName;
        await ch.assertExchange(exchange, EXCHANGE_TYPE.DIRECT);
        publish = Plugins.send(({ exchange, routingKey, msg, options }) =>
          ch.publish(
            exchange,
            routingKey,
            msg,
            options
          )
        );
        canSendMore = publish()
          log.debug(`Sent event ${routingKey} with body %s.`, msg);
      }
      const boundPublish = _.partial(publish, exchange, routingKey, msg);
      if (!canSendMore) {
        // Gotta respect the back pressure
        ch.once('drain', boundPublish);
      } else {
        boundPublish();
      }

        const msg = new Buffer(JSON.stringify(body));

      } catch (err) {
        log.error(`Failed to send command ${routingKey}`);
      }


    },

    listen: async function (routingKey, fn) {
      const ch = await channelPromise;
      const qName = initialOptions.listenQueueName;
      const exchange = initialOptions.commandExchangeName
      try {
        await ch.assertExchange(exchange, EXCHANGE_TYPE.DIRECT);
        await ch.assertQueue(qName, { durable: true });
        await ch.bindQueue(qName,exchange, routingKey);
        await ch.prefetch(1);

        async function listenDecorator (msg) {
          msg.ack  = () => {
            log.debug('Message acknowledged.');
            ch.ack(msg);
          };

          msg.reject  = () =>{
            log.debug('Message rejected.');
            ch.reject(msg);
          };

          await Plugins.preListen(ch, exchange, routingKey, msg, initialOptions);
          fn(msg);
          await Plugins.postListen(ch, exchange, routingKey, msg, initialOptions);
        }

        const { consumerTag } = await ch.consume(myQueue, listenDecorator, { noAck: false });

        log.info(`Consumer ${consumerTag} waiting for commands with topic ${routingKey}.`);
      } catch (err) {
        log.error(`Failed while processing event from ${routingKey}: ${err.message}`);
      }
    },


    publish: async function (routingKey, msg) {
      const ch = await channelPromise;
      const exchange = initialOptions.eventExchangeName;
      await ch.assertExchange(exchange , EXCHANGE_TYPE.TOPIC);
      await Plugins.prePublish(ch, exchange, routingKey, msg, initialOptions);
      await ch.publish(
        exchange,
        routingKey,
        new Buffer(JSON.stringify(msg))
      );
      await Plugins.postPublish(ch, exchange, routingKey, msg, initialOptions);
      log.debug(`Published event ${routingKey} with body %j.`, msg)
    },


    subscribe: async function (routingKey, fn) {
      const ch = await channelPromise;
      const qName = initialOptions.subscriptionQueueName;
      const exchange = initialOptions.eventExchangeName;

      async function subscriptionDecorator (msg) {
        await Plugins.preSubscribe(ch, exchange, routingKey, msg, initialOptions);
        fn(msg);
        await Plugins.postSubscribe(ch, exchange, routingKey, msg, initialOptions);
      }

      try {
        await ch.assertExchange(exchange , EXCHANGE_TYPE.TOPIC);
        await ch.assertQueue(qName);
        await ch.bindQueue(qName, exchange, routingKey);
        const { consumerTag } = await ch.consume(qName, subscriptionDecorator, { noAck: true });
        log.info(`Consumer ${consumerTag} subscribed on topic ${routingKey}.`);
      } catch (err) {
        log.error(`Failed while processing event from ${routingKey}: ${err.message}`);
      }
    }
  });
};


/*

command:   sendCommand('cream', 'cmd.cashout.create', {});
Exchange: default -> cream
cream []
   -> process reads (workers)


 */