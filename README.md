# jsminor

Minimal server framework to serve static webpages and open a websocket with clients.

## Server Usage

To use jsminor, install it with `npm install`, then import the `startServer` module with:
```
import startServer from 'jsminor'
```

Or import the specific functions you want with:
```
import {startServer, logMsg, wsSend}  from './jsminor.mjs';
```

Then you can use each function needed, for example:
```
logMsg('Starting server');
startServer(null, (msg, ws) => {
	wsSend(ws, 'Server recieved the following message: ' + msg);
});
```

The `startServer()` function takes an optional configuration object as well as a callback function that is called upon recieving a websocket message. The config object holds the folowing options (with default values specified below):
```
{
    serverName: "LocalServer",
    https: false,
    serverPort: 12345,
    serverAddress: "localhost",
    pingInterval: 10
}
```

These can also be set using environment variables:
```
SERVERNAME
HTTPS
PORT
SERVERADDRESS
PINGSECONDS
```

The websocket message callback function is called when a websocket message is recieved in the form `function(ws, dta)` where `ws` is a reference to the open websocket and `dta` is the message recieved. `dta` will be converted to an Object if it is valid JSON; otherwise, it will be a string.


## Client Usage

Files served under the `static` directory will be served to clients when requested.

To utilize websockets, open a new websocket with, for example:

```
const skt = new WebSocket(window.location.href.replace('http://', 'ws://').replace('https://', 'wss://'));
```

Then use `skt.onmessage` to specify a callback function to recieve messages, and `skt.send` to send messages. Here is a very simple page demonstrating sending and recieving websocket messages (put in the `static` directory):

```
<html>
<head>
	<title>Example</title>
	<script defer>
		const skt = new WebSocket(window.location.href.replace('http://', 'ws://').replace('https://', 'wss://'));
		skt.onmessage = function(event) {
            document.getElementById('status').innerText = 'Last Message: ' + event.data;
		}
		function sendBtnClick() {
			skt.send(document.getElementById('inpt').value);
		}
	</script>
</head>
<body>
	<p id="status">No Messages Recieved Yet</p>
	<input type="text" id="inpt">
	<button id="sendBtn" onclick="sendBtnClick()">Send</button>
</body>
</html>
```
