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

  /* Configure default options
      Note: you can pass in custom options which get exposed through the middleware API
  */
  _.defaults(initialOptions, {
    url: 'amqp://localhost',
    commandExchangeName: 'commands',
    eventExchangeName: 'events',
    subscriptionQueueName: `${serviceName}_subscription`,
    listenQueueName: `${serviceName}_listen`,
  });

  let plugins;
  const channelPromise = amqp
    .connect(initialOptions.url)
    .catch(err => log.error(`Unable to create connection. ${err.message}`))
    .then(connection => {
      log.info(`Connected to amqp host on ${initialOptions.url}. Creating channel.`);
      return connection.createChannel().then(channel => {
        plugins = new Plugins({ channel, connection, initialOptions, serviceName });
        return channel;
      });
    })
    .catch(err => log.error(`Could not open channel on amqp url. Error: ${err.message}`));

  return {
    use: function (plugin) {
      Plugins.register(plugin);
      return this;
    },
    send: async function (routingKey, message, options) {
      const ch = await channelPromise;
      return plugins
        .send(
          ch.publish.bind(ch),
          routingKey, message, options
        )
        .catch(err => {
          log.error(`Failed to send command ${routingKey}`);
          log.error(err);
        });
    },

    listen: async function (routingKey, listenFn, options) {
      const ch = await channelPromise;
      return plugins
        .listen(
          ch.consume.bind(ch),
          routingKey, listenFn, options
        )
        .catch( err => {
          log.error(`Failed while consuming event (via listen) from ${routingKey}`);
          log.error(err);
        });
    },


    publish: async function (routingKey, message, options) {
      const ch = await channelPromise;
      return plugins
        .publish(
          ch.publish.bind(ch),
          routingKey, message, options
        )
        .catch( err => {
          log.error(`Failed while publishing event (via publish) from ${routingKey}`);
          log.error(err);
        });
    },


    subscribe: async function (routingKey, listenFn, options) {
      const ch = await channelPromise;
      return plugins
        .subscribe(
          ch.consume.bind(ch),
          routingKey, listenFn, options
        )
        .catch( err => {
          log.error(`Failed while consuming event (via subscribe) from ${routingKey}`);
          log.error(err);
        });
    }
  };
};


/*

command:   sendCommand('cream', 'cmd.cashout.create', {});
Exchange: default -> cream
cream []
   -> process reads (workers)


 */