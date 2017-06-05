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
bus.publish('event.user.created', {
    username: 'goku'
});

// Tell a service listening on 'cmd.payment.create' to do something. `send` is typically only used for commands, and thus the targer service can reject your command, or send you back a response.
bus.send('cmd.payment.create', {
    card: '4111-1111-1111-111x'
}).catch((error) => {
    if (error.code === 'XYZ') {
        console.log('Card number is invalid');
    }
});
```

### Process 2
```javascript
const BunnyHop = require('bunnyhop');
// The service name will affect routing behaviour, so make sure it's unique in your system
const bus = BunnyHop('payment')

const { User, Payment}  = require('./path/to/libs');

// Notice you can't respond back to publisher.
bus.subscribe('event.user.created', async (message) => {
    // Payload is in 'content' property
    const { username } = message.content;
    const user = await User.findByUsername(username);
    if (username === 'goku') {
        user.raisePowerLevelBeyond(9000)
    }
});


bus.listen('cmd.payment.create', async (msg) => {
    // if error is thrown (or promise is rejected), the error gets sent back to the sender
    await Payment.create(msg.content);
    // If you return something, it will make its way back to the sender too
})
```

## Configuration

By default BunnyHop uses default options

| options | description | default |
|---------|-------------|---------|
| url | AMQP URL to connect to  | `'amqp://localhost'` |
| serialization | manager to use for serializing and deserializing messages | `require('./lib/serialization/json')` |
| connectionManager | manager to use for handling connection to AMQP server | `require('./lib/connectionManager')` |

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
For defining an engine other than the default engine, use `useEngine`

```javascript
const bus = BunnyHop('your_service')
    .use(Plugin1)
    .useEngine(CustomEngine)

// ORDER DOES NOT MATTER, YOU CAN ALSO DO

const bus = BunnyHop('your_service')
    .useEngine(CustomEngine)
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