'use strict';

// Config (with defaults):
const ServerPort = process.env.PORT || 12345;
const PingInterval = (process.env.PINGSECONDS || 10) * 1000;
const ServerName = process.env.SERVERNAME || 'LocalServer';
const ServerAddress = process.env.SERVERADDRESS || 'localhost';
const http = process.env.HTTPS ? require('https') : require('http');

const fs = require('fs');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

/**
 * Log a message, optionally as an error
 * @param {Error || String} errOrMsg - an error Object or a message to log
 * @param {String} [level="info"] - the log level ("log", "info", "error", "debug", "warn", etc.)
 * @param {boolean} [logStack=false] - if true, the complete call stack will be logged to the console; by default only the message will be logged
 * @param {Object} [ws] - if supplied, the error message will also be sent over the given websocket
 */
function logMsg(errOrMsg, level, logStack, ws) {
	const color = { error: '\x1b[31m', warn: '\x1b[33m', log: '\x1b[33m', info: '\x1b[36m', reset: '\x1b[0m' }  // red, yellow, green, cyan, reset
	if (!level) level = (typeof errOrMsg === 'string') ? 'info' : 'error';
	if (typeof errOrMsg === 'string' && level === 'error') errOrMsg = new Error(errOrMsg);
	console[level]('[' + new Date().toLocaleString() + '] ' + color[level] + (errOrMsg ? errOrMsg.toString() : '') + color.reset);   // '\x1b[0m' = reset
	if (logStack && errOrMsg.stack && (errOrMsg.stack.trim() !== '')) console[level](errOrMsg.stack);
	if (ws) wsSend(ws, '[' + new Date().toLocaleString() + '] ' + (errOrMsg ? errOrMsg.toString() : ''));
}

/**
 * Send a data on the given websocket
 * @param {Object} [ws] - the websocket object. If not specified, nothing is sent
 * @param {Object} dta - the data to send. If this is an Object, it will be stringified before sending
 */
function wsSend(ws, dta) {
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
	let cType = 'text/' + (path.extname(fileName) || 'text/plain'); // covers text/html, text/css, text/csv, text/xml, etc.
	if (path.extname(fileName) === 'js') cType = 'application/javascript';
	else if (path.extname(fileName) === 'txt') cType = 'text/plain';
	else if (path.extname(fileName) === 'gif') cType = 'image/gif';
	else if (path.extname(fileName) === 'jpg' || path.extname(fileName) === 'jpeg') cType = 'image/jpeg';
	else if (path.extname(fileName) === 'png') cType = 'image/png';
	else if (path.extname(fileName) === 'pdf') cType = 'application/pdf';
	else if (path.extname(fileName) === 'zip') cType = 'application/zip';
	else if (path.extname(fileName) === 'mp3') cType = 'audio/mpeg';
	else if (path.extname(fileName) === 'wav') cType = 'audio/x-wav';
	return { "Content-Type": cType };
}

/**
 * Entry Point
 */
 const server = http.createServer();
 server.filesCache = {}; // cache of static files
for (let file in fs.readdirSync('./static/')) {
	server.filesCache[file] = fs.readFileSync('./static/' + file);
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
server.listen(ServerPort, err => {
	if (err) return logMsg(err);
	else {
		const wss = new WebSocket.Server({server});
		wss.on('connection', ws => {
			function closeWs(ws, err) {
				if (err && !err.message.includes('CLOSED')) logMsg(err);
				clearInterval(ws.pingTimer);
				return ws.terminate();
			}
			ws.isAlive = true;
			ws.on('message', msg => {
				msg = JSON.parse(msg);
				// TO DO - act on message, respond using wsSend()
			});
			ws.on('pong', () => ws.isAlive = true);
			ws.pingTimer = setInterval(() => {
				if (ws.isAlive === false) return closeWs(ws);
				ws.isAlive = false;
				ws.ping(err => { if (err) return closeWs(ws, err); });
			}, PingInterval);
		});
		console.log('Server ' + ServerName + ' is listening on port ' + ServerPort + ' (http' + (process.env.HTTPS ? 's://' : '://') + ServerAddress + ':' + ServerPort + ')');
	}
});