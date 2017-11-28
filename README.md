# ![BunnyHop Logo](logo.png) BunnyHop 
#### A pluggable microservice messaging framework built on top of amqp.
This package allows for send/receive and publish/subscribe pattern messaging over RabbitMQ.



## Quickstart
Let's say we're building 2 services.

### Process 1
```javascript
const BunnyHop = require('bunnyhop');

/* Give your service a name. This step is required.
Here we are not passing in options so it uses the defaults.
Notice there is no new keyword.
*/
const bus = BunnyHop('user')
// This goes out to every service subscribed to 'event.user.created'.
// If service has multiple processes or instances, only one of the instances picks the message up (round robin)
bus.publish('event.User.Created', {
    username: 'goku'
});

// Tell a service listening on 'cmd.payment.create' to do something. `send` is 
// typically only used for commands, and thus the targer service can reject your command, 
// or send you back a response.
bus.send('cmd.Payment.Create', {
    card: '4111-1111-1111-111x'
});

/* OR you can make RPC calls with the sync: true option, which return a promise */
async function sampleRPC () {
    try {
        const returnValueFromRemote = await bus.send('cmd.Domain.DoSomething', { sampleData: 1 }, { sync: true })
    catch (err) {
        console.error(`${err.message} is an actual error`);
    }
}



/*
In order to do a timeout with an RPC call, use the timeoutMs option along with { sync: true }
NOTE: Timeouts only work for sync calls and will be ignored otherwise
*/

async sampleTimeoutRPC () {
  // Timeout if DoSomething doesn't reply within 10 milliseconds
  try {
    await bus.send('cmd.Domain.DoSomething', { sampleData: 1}, { sync: true, timeoutMs: 10 })
  } catch (err) {
   assert(err.name === 'TimeoutError');
   assert(err.message === 'Operation Timed Out.');
  }
}
```

### Process 2
```javascript
const BunnyHop = require('bunnyhop');
// The service name will affect routing behaviour, so make sure it's unique in your system
const bus = BunnyHop('payment')

const { User, Payment}  = require('./path/to/libs');

// Notice you can't respond back to publisher.
bus.subscribe('event.User.Created', async (message) => {
    // Payload is in 'content' property
    const { username } = message.content;
    const user = await User.findByUsername(username);
    if (username === 'goku') {
        user.raisePowerLevelBeyond(9000)
    }
});

/* OR Subscribe to a pattern (Only works for subscribe) */
bus.subscribe('Event.User.*', () => {}); // Gets 'Event.User.Created' and 'Event.User.Deleted' ...
bus.subscribe('Event.#', () => {}); // Gets all Events (see Topic Tutorial: https://www.rabbitmq.com/tutorials/tutorial-five-javascript.html)


bus.listen('cmd.Payment.Create', async (msg) => {
    // if error is thrown (or promise is rejected), the error gets sent back to the sender
    await Payment.create(msg.content);
    // If you return something, it will make its way back to the sender too
})

/*
Or turn OFF auto acknowledgement and manually tell the sender you've received the message.
autoAck: false adds the `ack()` and `reject()` handles on the message
*/
bus.listen('A.B.C', (msg) => {
    if (something) {
        // Tell bus you've received the message was successfully processed. Don't Resend.
        msg.ack();
    } else {
        // Delivery wasn't processed but still should be deleted anyway. Maybe validation failed or something.
       msg.reject()
    }
}, { autoAck: false })

// same goes for subscribe
bus.subscribe('A.*.C', () => {}, { autoAck: false });
```

## Configuration

Top-level options exposed by BunnyHop

| options | description | default |
|---------|-------------|---------|
| url | AMQP URL to connect to  | `'amqp://localhost'` |
| serialization | manager to use for serializing and deserializing messages | `require('./lib/serialization/json')` |
| connectionManager | manager to use for handling connection to AMQP server | `require('./lib/connectionManager')` |

Top-level options exposed by the [Default Engine](#plugins-and-engines):

| options | description | default |
|---------|-------------|---------|
| errorFormatter | function to format `Error` into JSON | `error => _.pick(error, ['message', 'code', 'details']` |
| topicExchange | The exchange name to use for `publish` | `'amq.topic'` |
| directExchange | The exchange name to use for `send` | `'amq.direct'` |
| rpcReplyQueue | The queue to reply to when doing RPC calls via send's `sync: true` option | `'rpcReplyQueue'` |
| subscriptionQueue | The queue name subscribers of one service share | `${serviceName}_subscription`| 

You can provide custom options when initializing BunnyHop.

```javascript
BunnyHop('service_name', { url: 'amqp://cloud-amqp-provider:1234', customOption: 1 }
```

## Plugins and Engines

The interface to  `send`/`listen`/`publish`/`subscribe` is fixed.
In order to provide some flexibility to the developer, BunnyHop models a pipeline of functions that are run after calling those function.

These functions can be either a `plugin` or an `engine`.  An `engine` is simply the last plugin in the pipeline.

**Given the following desired behaviour:**

*add correlation id to message* **>**  *add date to message* **>** *log message* **>** **publish message**

**You can use a pipline like:**

*CorrelationPlugin* **>** *DatePlugin* **>** *LogPlugin* **>** **DefaultEngine**

### Configuring Plugins and Engines

Plugins are defined similar to `connect` or `express` middleware. You can simply use `use` when initializing:

```javascript
const bus = BunnyHop('my_service')
    .use(Plugin1)
    .use(Plugin2)
    .use(Plugin3);
```

For defining an engine other than the default engine, use `engine`

```javascript

const bus = BunnyHop('your_service')
    .use(Plugin1)
    .engine(CustomEngine)

// ORDER DOES NOT MATTER, YOU CAN ALSO DO

const bus = BunnyHop('your_service')
    .engine(CustomEngine)
    .use(Plugin1)
```
 

### Included Plugins
##### Correlator

Correlate simply adds a random `.properties.correlationId` (Correlation Identity) property to any outgoing message that do not already have one. This is useful for following messages in logs across services.

#### Logger

Logger ensures that incoming and outgoing messages are logged to stdout via the debug module. (Use this in non-high throughput scenarios, otherwise you'll have some very quickly growing logs)

#### Package

Package repackages  messages, encapsulating the original message as a `.data` property and adding additional properties for information like message type and time message was issued and observed by our system
```javascript
// bus.publish('event.domain.somethingHappened', { my: 'event' });
{ my: 'event' }
// BECOMES
{
    data: { my: 'event' },
    dateIssued:"2017-06-05T19:10:01.945Z",
    type:"event.domain.sometingHappened"
};


// bus.listen or bus.subscribe('event.domain.somethingHappened', ...)
{ my: 'event' }
// BECOMES
{
    // date processed is the date the message was observed by the receiving system
    dateProcessed: "2017-06-05T19:10:01.945Z",
    data: { my: 'event' } 
    type: 'event.domain.somethingHappened'
};
/**
Notice How on the receive side, if the message doesn't already have a `dateIssued`, we do not generate one. We do, however, add a `dateProcessed` property.
If you use package on the send AND receive side, the receive side will assume the message is prepackaged if it has `data`, `dateIssued` and `type` in `message.content` and  `message.content.data` as the data payload.
Otherwise, it will use `message.content` as the payload.
**/
```

####  A Note on Plugin Ordering
The plugin ordering when using `use` matters. Given
```javascript
const bus = BunnyHop('my_service')
    .use(Plugin1)
    .use(Plugin2)
    .use(Plugin3);
```
Assuming all plugins have pre-engine and post-engine behaviour,
the given setup will behave as follows:


```
Plugin 3
  Plugin 2
    Plugin 1
       Engine
    Plugin 1
  Plugin 2
Plugin 3
```

If it looks like a call stack, it's because it is. The pipeline is functionally composed and 
plugins have a `next` function to hand off control to the next function in the pipeline 
(see Custom Plugins) below

### Writing a Custom Plugin
It is easy to write a custom plugin. just define a file with the following signature

```javascript
function MyPlugin (pluginAPI) {
  const log = pluginAPI.getPluginLogger();
  // This is pretty useful for debuggin, so make sure to put it in. 
  log.info('Using My Plugin');

  return {
    send: next =>
      (routingKey, message, options) => {
        // DO SOMETHING BEFORE ONLY
        return next(routingKey, message, options);
      },
    listen: next =>
      async (routingKey, listenFn, options) => {
        const returnVal = await next(routingKey, listenFn, options);
        // DO SOMETHING AFTER ONLY
        // Use returnVal or fire and forget (no await)
        return returnVal 
      },
    publish: next =>
      (routingKey, message, options) => {
        // DO SOMETHING BEFORE
        next(routingKey, message, options);
        // DO SOMETHING AFTER
      }
      
    /* subscribe <- Only define the hooks you need! */ 
  }
}

module.exports = MyPlugin;
```
#### The Plugin API
You may have notice the plugin gets a `pluginAPI` as the first argument. Every plugin gets that and
can use it to modify its own behaviour. Valid API functions are

```javascript 1.8
getChannel();  // Gets the open channel to the AMQP server
getConnection (); // Gets the open connection to AMQP server
getInitialOptions (); // Gives you access to the options provided at the top level to bunnyhop
getServiceName (); // Simply returns the service name bunnyhop was initialized with
getPluginLogger (); // Gets the logger with `info`, `error`, and `debug` defined
```

To configure your custom plugin, you can read custom options from the bunnyhop intiialization options 
using `getInitialOptions ()` just wrap your plugin in another function which configures it like so:

```javascript
function CatPluginInitializer (pluginOptions = { cat: 'white' }) {
  return function CatPlugin(pluginAPI) {
    const log = pluginAPI.getPluginLogger();
     return {
       send: next =>
         (routingKey, message, options) => {
           if (pluginOptions.cat === 'white') {
             log.info('Using white cat mode');
           }
           return next(routingKey, message,options);
         }
       // ... 
     } 
  }
}
```

And now when you're instantiating BunnyHop you can call the customizer
 
```javascript
const bus = BunnyHop('my_service')
    .use(Plugin1)
    .use(CatPlugin({ cat: 'green' }))
````

### Writing a Custom Engine
If you choose to write a custom engine, you must do everything required to communicate to the AMQP server.

The engine is the last plugin in the chain, so there is no `next` function.


Some things to consider for your engine:

* serialization and deserialization
* Error formatting
* Options to read (expose) from global BunnyHop options
* Asserting Channels, Queues, and Exchanges

For More details, see the default engine in `./lib/engines/default.engine.js`


### Structured Handler Registration
You probably don't want to write your bunnyhop listen and subscribe handlers file for every project, so I've made a helper package to provide some structure and convention around how you define `listen` and `subscribe` handlers.

Check out https://github.com/autolotto/bunnyhop-handler for more details.
