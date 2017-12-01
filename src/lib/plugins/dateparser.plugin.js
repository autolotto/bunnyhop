/* eslint no-cond-assign: 0, no-empty: 0 */
const _ = require('lodash');
const moment = require('moment-timezone');

/*
   Parses JSON dates to be turned into Javascript Dates
   Taken from express body-parser (this acts the same way but for bunnyhop)
 */
const regexIso8601 = /^(\d{4}|\+\d{6})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})\.(\d{1,})(Z|([-+])(\d{2}):(\d{2}))?)?)?)?$/;

function parseDate(key, value) {
  try {
    let match;
    if (typeof value === 'string' && (match = value.match(regexIso8601))) {
      const m = moment.utc(value);
      if (m) return m.toDate();
    }
  } catch (err) {}
  return value;
}

function mapValuesDeep(v, callback, k) {
  return _.isObjectLike(v)
    ? _.mapValues(v, (val, key) => mapValuesDeep(val, callback, key))
    : callback(v, k);
}

/*
    Parses dates in the bunnyhop payload from JSON strings into date objects.
 */
function DateParserPlugin(pluginAPI) {
  const log = pluginAPI.getPluginLogger();
  log.info('Using DateParser Plugin');
  return {
    send: next =>
      (routingKey, message, options) => next(routingKey, message, options),

    listen: next =>
      async (routingKey, listenFn, options) => {
        function parseDates (msg) {
          const payload = _.get(msg, 'content.data');
          if (payload) {
            msg.content.data = mapValuesDeep(payload, (v, k) => parseDate(k, v));
          }
          return listenFn(msg);
        }
        return next(routingKey, parseDates, options);
      },

    publish: next =>
      (routingKey, message, options) => next(routingKey, message, options),

    subscribe: next =>
      (routingKey, subscribeFn, options) => next(routingKey, subscribeFn, options)
  };
}

module.exports = DateParserPlugin;