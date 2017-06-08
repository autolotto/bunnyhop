/**
 * Created by balmasi on 2017-06-03.
 */
const amqp = require('amqplib');
const debug = require('debug');
const ON_DEATH = require('death');

const log = {
  info: debug('bunnyhop:info')
};

/**
 * Connection function to AMQP host
 *
 * @param {string} amqpUrl
 * @return {Promise.<{connection: *, channel: *}>}
 */
module.exports = async function connect (amqpUrl) {
  let connection;
  let channel;

  connection = await amqp.connect(amqpUrl)
    .then(connection => {
      log.info(`Connected to amqp host on ${amqpUrl}. Creating channel.`);
      return connection;
    })
    .catch(err => {
      throw new Error(`Could not connect to AMQP host on ${amqpUrl}. Reason: ${err.message}`);
    });

  channel = await connection.createChannel()
    .then(channel => {
      log.info(`AMQP channel open.`);
      return channel;
    })
    .catch(err => {
      throw new Error(`Could not create channel. Reason: ${err.message}`);
    });

  ON_DEATH(function (signal, error) {
    const message = `Stopping all AMQP connections due to ${signal ? `${signal} signal` : 'error'}.`;
    log.info(message);
    if (connection) {
      connection.close();
    }
    if (channel) {
      connection.close();
    }
  });


  return {
    connection,
    channel
  }
};