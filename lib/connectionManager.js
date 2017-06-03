/**
 * Created by balmasi on 2017-06-03.
 */
const amqp = require('amqplib');
const debug = require('debug');

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
      log.info(`Connected to amqp host on ${amqpUrl}. Creating channel.`)
      return connection;
    })
    .catch(err => {
      console.error('Could not connect to AMQP host.', err);
      return err
    });

  channel = await connection.createChannel()
    .then(channel => {
      log.info(`AMQP channel open.`)
      return channel;
    })
    .catch(err => {
      console.error('Could not create channel.', err);
      return err
    });

  return {
    connection,
    channel
  }
};