# jsminor

Minimal server framework to serve static webpages and open a websocket with clients.

## Installation and Usage

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

## Starting a Server

Start a webserver with the `startServer()` function. The `startServer()` function takes an optional configuration object as well as a callback function that is called upon recieving a websocket message. The config object holds the folowing options (with default values specified below):
```
{
	serverName: "LocalServer",
	https: false,
	serverPort: 12345,
	serverAddress: "localhost",
	pingSecs: 10
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

Files served under the `static` directory will be served to clients when requested.

## Using Websockets

### Recieving Websocket messages on the Server 

The websocket message callback function (passed to `startServer()`) is called when a websocket message is recieved on the server. The function takes two parameters, `ws` and `dta`.  `ws` is a reference to the open websocket. `dta` is the message recieved. `dta` will be converted to an Object if it is valid JSON; otherwise, it will be a string.

#### Client Websocket Usage

To utilize websockets on the client, open a new websocket with, for example:

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

## Accessing APIs

The server can access external APIs using the `apiRequest()` function. For APIs that require authentication, a `getToken()` function is also included. Both of these functions require an `ApiData` object, that stores settings for the API:


**TO DO:** ADD details below:

```
/**
 * @typedef {Object} ApiData
 * @property {string} baseUrl - the root url of the api (i.e. "https://api.example.com")
 * @property {string} [authTokenPath] - the url path to exchange a code or password for an access token, excluding the baseUrl (i.e. "/oauth2/token")
 * @property {string} [authGrantType] - the grant type to use to obtain an access token (i.e. "authorization_code" or "password")
 * @property {string} [authUserName] - the username to use when obtaining an access token (typically used only if the access token grant type is "password")
 * @property {string} [authSecret] - the access code or password to use when obtaining an access token (typically as password if grant type "password"; or an access code if using grant type "authorization_code")
 * @property {string} [authContentType] - the content type to use when exchanging a code or password for an access token (i.e. "application/json")
 * @property {string} [clientID] - the client ID to use when obtaining an access token (typically if using grant type "authorization_code")
 * @property {string} [clientSecret] - the client secret to use when obtaining an access token (typically if using grant type "authorization_code")
 * @property {string} [refreshTokenPath] - the url path to exchange a refresh token for an access token, excluding the baseUrl (i.e. "/oauth2/token")
 * @property {string} [refreshContentType] - the content type to use when exchanging a refresh token for an access token (i.e. "application/x-www-form-urlencoded")
 * @property {string} [redirectUri] - the URI sent to the authentication server to which the user will be redirected upon authentication (i.e. "urn:ietf:wg:oauth:2.0:oob" for the internal redirect uri)
 * @property {Object} [token] - the access token, typically in the form {access_token: "12345", token_type: "bearer", expires_in: 7200, refresh_token: "12345", "scope": "public"}
 */
```


example API calling flow:

```
async function postReq(apiData, data) {
	let reqType = 'GET';
	let headers = {"Content-Type": 'application/json'};
	headers['Authorization'] = 'Bearer ' + apiData.token.access_token;
	let response;
	try { response = await apiRequest(apiData, '/v1/example', 'POST', JSON.stringify(data), headers); }
	catch (err) { logMsg('Problem with POST request: ' + err + '. Will try refreshing (or obtaining) Authentication Token...'); }
	if (!response) {
		apiData = await getToken(apiData);
		try { response = await apiRequest(apiData, '/v1/example', 'POST', JSON.stringify(data), headers); }
		catch (err) { logMsg('Problem with POST request after attempting to get Auth Token: ' + err); }
	}
	return response;
*/
```
