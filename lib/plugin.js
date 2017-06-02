/**
 * Created by balmasi on 2017-05-31.
 */
const _ = require('lodash');

const HOOKS = ['send', 'listen', 'publish', 'subscribe'];



function validatePlugin (middleware = {})  {
  // Does the middleware have at least one of the hooks defined?
  const hasHooks = _.difference(HOOKS, Object.keys(middleware)).length < HOOKS.length;
  if (!hasHooks) {
    throw new TypeError(`BunnyHop middleware must have at least one hook defined. Valid hooks are ${HOOKS.join(', ')}`);
  }
  const invalidHooks = HOOKS
    .filter(hook => !(_.isUndefined(middleware[hook]) || _.isFunction(middleware[hook])));
  if (invalidHooks.length) {
    throw new TypeError(`Invalid hooks ${invalidHooks.join(', ')} for middleware. Hooks be either a undefined, or a function. Valid hooks are ${HOOKS.join(', ')}`);
  }
}

const registeredPlugins = [];
let channel;
let globalOptions;

const toExport = {
  init: function (ch, options) {
    channel = ch;
    globalOptions = options;
  },
  register: function (plugin) {
    validatePlugin(plugin)
    registeredPlugins.push(plugin);
  }
};

/**
 * Add on the plugin handlers
 * @example
 * Plugin.preSend(channel, exchange, routingKey, msg, options = {})
 */
HOOKS.forEach(hook => {
  toExport[hook] = function (channel, exchange, routingKey, msg, options = {}) {
    return executeHook(
      hook,
      [exchange, routingKey, msg, options]
    );
  }
});

module.exports = toExport;




function publish ({ queue, exchange, routingKey, message, options }) {
  console.log('publish arguments', arguments[0]);
  console.log(`publish(${exchange}, ${routingKey}, ${JSON.stringify(message)}, ${options})`);
  return 'MAIN DEAL';
}


// { channel, queue, exchange, routingKey, message, options }
function applyMiddleware (...middlewares) {
  return (fn) =>
    (rabbitOptions = {}) => {
      const middlewareAPI = {
        getChannel () { return rabbitOptions.channel; },
        getConnection () { return rabbitOptions.connection },
        getOriginalInvocationParameters () {
          return _.pick(rabbitOptions, ['queue', 'exchange', 'routingKey', 'message', 'options']);
        }
      };

      const chain = middlewares.map(middleware => middleware(middlewareAPI));
      console.log('Middleware Chain:', chain);
      const appliedFn = _.flow(chain)(fn);
      return appliedFn(middlewareAPI.getOriginalInvocationParameters())
    }
}


/*
Plugin Idea

 async function publish (exchange, routingKey, msg) {
 canSendMore =
 log.debug(`Sent event ${routingKey} with body %s.`, msg);
 }
 const boundPublish = _.partial(publish, exchange, routingKey, msg);
 if (!canSendMore) {
 // Gotta respect the back pressure
 ch.once('drain', boundPublish);
 } else {
 boundPublish();
 }
 */

// // const something = applyMiddleware(logMiddle, doubleOperation)
// const configuredPublish = applyMiddleware(logMiddle, addBornaMiddle, publish);
// configuredPublish({ channel, queue, exchange, routingKey, message, options });

const logger = middlewareAPI  => {
  console.log('logger middlewareAPI is', middlewareAPI);
  return next =>
    invocationParams => {
      console.log('before 1 invocationParams: ', invocationParams);
      const returnVal = next(invocationParams);
      console.log('after 1 return ', returnVal);
      return 'wow!';
  }
};

const logger2 = middlewareAPI  => {
  console.log('logger2 middlewareAPI is', middlewareAPI);
  return next =>
    invocationParams => {
      console.log('before 2 invocationParams: ', invocationParams);
      const returnVal = next(invocationParams);
      console.log('after 2 returnVal', returnVal);
      return 'COOL!';
    }
};

const masterPublish = applyMiddleware(logger, logger2)(publish);
const final = masterPublish({
  channel: 'chan', queue: 'q', exchange: 'ex', routingKey: 'rk', message: 'hi', options: {}
});

console.log('final return value is ', final);

// const main2 = _.flowRight([logger, logger2])(main)
// console.log(main2('borna'));