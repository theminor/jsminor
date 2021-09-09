import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import WebSocket, { WebSocketServer } from 'ws';

/**
 * Log a message, optionally as an error
 * @param {Error || String} errOrMsg - an error Object or a message to log
 * @param {String} [level="info"] - the log level ("log", "info", "error", "debug", "warn", etc.)
 * @param {boolean} [logStack=false] - if true, the complete call stack will be logged to the console; by default only the message will be logged
 * @param {Object} [ws] - if supplied, the error message will also be sent over the given websocket
 */
export function logMsg(errOrMsg, level, logStack, ws) {
	const color = { error: '\x1b[31m', warn: '\x1b[33m', log: '\x1b[33m', info: '\x1b[36m', reset: '\x1b[0m' }  // red, yellow, green, cyan, reset
	if (!level) level = (typeof errOrMsg === 'string') ? 'info' : 'error';
	if (typeof errOrMsg === 'string' && level === 'error') errOrMsg = new Error(errOrMsg);
	console[level]('[' + new Date().toLocaleString() + '] ' + color[level] + (errOrMsg ? errOrMsg.toString() : '') + color.reset);   // '\x1b[0m' = reset
	if (logStack && errOrMsg.stack && (errOrMsg.stack.trim() !== '')) console[level](errOrMsg.stack);
	if (ws) wsSend(ws, '[' + new Date().toLocaleString() + '] ' + (errOrMsg ? errOrMsg.toString() : ''));
}


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

/**
 * Perform an API Request from a supplied API Object
 * @param {ApiData} apiData - the apiData Object containing data from this API
 * @param {string} path - the path to the API endpoint for this request -- for example "/v1/contacts" 
 * @param {string} [method="GET"] - the HTTP method to use, e.g. 'GET', 'POST', 'PUT', 'DELETE' -- defaults to 'GET' unless data is supplied, in which case it defaults to 'POST'
 * @param {string} [data] - the data to submit with the request (for example POST data)
 * @param {Object} [headers] - the headers object to send with the request -- see the nodejs https.request documentation for more details
 * @param {string} [auth] - data to compute a basic Authorization header (i.e. "user:password")
 * @returns {Promise<Object>} Resolves to the Response to the API request, in the form {headers: {...}, statusCode: 200, statusMessage: "OK", method: "GET", dta: {...}} -- dta will be converted into a javascript object (or a string, if not JSON data, or null if it failed)
 */
 function apiRequest(apiData, path, method, data, headers) { return new Promise((resolve, reject) => {
	let options = { "method": (method || (data ? 'POST' : 'GET')) };
	if (headers) options.headers = headers;
	if (auth) options.auth = auth;
	let htp = http;
	if (apiData.baseUrl.startsWith('https')) htp = https;
	const req = htp.request(apiData.baseUrl + path, options, res => {
		let resDta = {dta: ''};
		if (res.statusCode && (res.statusCode >= 300)) reject(`API ${options.method} request to ${apiData.baseUrl + path} - response failed; returned Status Code: ${res.statusCode}`);
		res.on('error', err => reject(`API ${options.method} request to ${apiData.baseUrl + path} - response error: ${err}`));
		res.on('data', d => resDta.dta += d);
		res.on('end', () => {
			resDta.headers = res.headers;
			resDta.statusCode = res.statusCode;
			resDta.statusMessage = res.statusMessage;
			resDta.method = res.method;
			resDta.url = res.url;
			try {
				resDta.dta = JSON.parse(resDta.dta);
			} catch (err) { }
			resolve(resDta);
		});
	});
	req.on('error', err => reject(`API ${options.method} request to ${apiData.baseUrl + path} - response error: ${err}`));
	if (data) req.write(data);
	req.end();
}); }

/**
 * Attempt to refresh an Authentication Token from an API or, if there is no refresh token, obtain a new token
 * @param {ApiData} apiData - the apiData Object containing data from this API
 * @returns {ApiData} the apiData, which includes the newly obtained authentication Token as {token: {...}}
 */
 async function getToken(ApiData) {
	if (apiData.token && apiData.token.refresh_token) {
		try {
			let rfshPostData;
			if (apiData.refreshContentType === 'application/x-www-form-urlencoded') rfshPostData = `grant_type=refresh_token&refresh_token=${apiData.token.refresh_token}&client_id=${apiData.clientID}&client_secret=${apiData.clientSecret}&redirect_uri=${apiData.redirectUri}`;
			else if (apiData.refreshContentType === 'application/json') rfshPostData = JSON.stringify({"grant_type": 'refresh_token', "refresh_token": apiData.token.refresh_token, "client_id": apiData.clientID, "client_secret": apiData.clientSecret, "redirect_uri": apiData.redirectUri});
			let response = await apiRequest(apiData, apiData.refreshTokenPath, 'POST', rfshPostData, {'Content-Type': apiData.refreshContentType});
			apiData.token = response.dta;
			return apiData;  // success, so stop here; no need to appy for a new token, below
		}
		catch (err) { logMsg(`Problem refreshing Authentication Token from ${apiData.baseUrl + apiData.refreshTokenPath}: ${err}. Attempting to get a new Token...`); }
	}
	try {  // no refresh token or there was a problem using the refresh token, so obtain a new token
		let authPostData;
		if (apiData.authGrantType === 'password') {
			if (apiData.authContentType === 'application/x-www-form-urlencoded') authPostData = `grant_type=password&username=${apiData.authUserName}&password=${apiData.authSecret}&redirect_uri=${apiData.redirectUri}`;
			else if (apiData.authContentType === 'application/json') authPostData = JSON.stringify({"grant_type": 'password', "username": apiData.authUserName, "password": apiData.authSecret, "redirect_uri": apiData.redirectUri});
		} else if (apiData.authGrantType === 'authorization_code') {
			if (apiData.authContentType === 'application/x-www-form-urlencoded') authPostData = `grant_type=authorization_code&code=${apiData.authSecret}&client_id=${apiData.clientID}&client_secret=${apiData.clientSecret}&redirect_uri=${apiData.redirectUri}`;
			else if (apiData.authContentType === 'application/json') authPostData = JSON.stringify({"grant_type": 'authorization_code', "code": apiData.authSecret, "client_id": apiData.clientID, "client_secret": apiData.clientSecret, "redirect_uri": apiData.redirectUri});
		}
		let response = await apiRequest(apiData, apiData.authTokenPath, 'POST', authPostData, {'Content-Type': apiData.authContentType});
		apiData.token = response.dta;
	}
	catch (err) { logMsg(`Problem obtaining Authentication Token from ${apiData.baseUrl + apiData.authTokenPath}: ${err}.`); }
	return apiData;
}

/**
 * Send a data on the given websocket
 * @param {Object} [ws] - the websocket object. If not specified, nothing is sent
 * @param {Object} dta - the data to send. If this is an Object, it will be stringified before sending
 */
export function wsSend(ws, dta) {
	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.send(
			(typeof dta === "string" || dta instanceof String) ? dta : JSON.stringify(dta),
			err => err ? logMsg(err) : false
		);
	} else {
		logMsg(`Websocket not ready for message "${dta}"`, 'error');
		return false;
	}
}

/**
 * parse a filename and return a head object with the content type
 * @param {String} fileName - the filename to parse 
 * @returns {Object} the head object in the form {"Content-Type": "text/plain"} 
 */
function fileToContentType(fileName) {
	const ext = path.extname(fileName).toLowerCase().slice(1);
	let cType = 'text/' + (ext || 'plain'); // covers text/html, text/css, text/csv, text/xml, etc.
	if (ext === 'js') cType = 'application/javascript';
	else if (ext === 'txt') cType = 'text/plain';
	else if (ext === 'gif') cType = 'image/gif';
	else if (ext === 'jpg' || ext === 'jpeg') cType = 'image/jpeg';
	else if (ext === 'png') cType = 'image/png';
	else if (ext === 'pdf') cType = 'application/pdf';
	else if (ext === 'zip') cType = 'application/zip';
	else if (ext === 'mp3') cType = 'audio/mpeg';
	else if (ext === 'wav') cType = 'audio/x-wav';
	return { "Content-Type": cType };
}

/**
 * Start a server and open a websocket
 * @param {Object} [config] - the server configuration in the form {serverName: "LocalServer", https: false, serverPort: 12345, serverAddress: "localhost", pingSecs: 10, staticDir: "./static/"}
 * @param {function(string, Object)} [onWebsocketMessage] - a callback function called when a message is received on the websocket, i.e. func(msg, ws)
 * @returns {Object} the server object
 */
export function startServer(config, onWebsocketMessage) {
	const serverName = config?.serverName || process.env.SERVERNAME || 'LocalServer';
	const htp = (config?.https || process.env.HTTPS) ? https : http;
	const serverPort = config?.serverPort || process.env.PORT || 12345;
	const serverAddress = config?.serverAddress || process.env.SERVERADDRESS || 'localhost';
	const pingInterval = (config?.pingSecs || process.env.PINGSECONDS || 10) * 1000;
	const staticDir = config?.staticDir || process.env.STATICDIR || './static/';
	const server = htp.createServer();
	server.filesCache = {}; // cache of static files
	for (const file of fs.readdirSync(staticDir)) {
		server.filesCache[file] = fs.readFileSync(staticDir + file);
	}
	server.on('request', (request, response) => {
		try {
			let fileName = path.basename(request.url);
			if (request.url.endsWith('/') || fileName === '' || fileName === 'index.html' || fileName === 'index.htm') fileName = 'index.html';
			if (server.filesCache[fileName]) {
				response.writeHead(200, fileToContentType(fileName));
				response.end(server.filesCache[fileName]);
			} else {
				logMsg('Client requested a file not in server.filesCache: "' + request.url + '" (parsed to filename: ' + fileName + ')');
				response.writeHead(404, {"Content-Type": "text/plain"});
				response.end('404 Not Found\n');	
			}
		} catch(err) { logMsg(err); }
	});
	server.listen(serverPort, err => {
		if (err) return logMsg(err);
		else {
			const wss = new WebSocketServer({server});
			wss.on('connection', ws => {
				function closeWs(ws, err) {
					if (err && !err.message.includes('CLOSED')) logMsg(err);
					clearInterval(ws.pingTimer);
					return ws.terminate();
				}
				ws.isAlive = true;
				ws.on('message', msg => {
					try {
						onWebsocketMessage(JSON.parse(msg), ws);
					} catch(e) {
						onWebsocketMessage(msg, ws);
					}
				});
				ws.on('pong', () => ws.isAlive = true);
				ws.pingTimer = setInterval(() => {
					if (ws.isAlive === false) return closeWs(ws);
					ws.isAlive = false;
					ws.ping(err => { if (err) return closeWs(ws, err); });
				}, pingInterval);
			});
			logMsg(`Server ${serverName} is listening on port ${serverPort} (http${(config?.https || process.env.HTTPS) ? 's' : ''}://${serverAddress}:${serverPort})`);
		}
	});
	return server;
}