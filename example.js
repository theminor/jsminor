import {startServer, logMsg, wsSend}  from './jsminor.mjs';

logMsg('Starting server');
startServer(null, (msg, ws) => {
	wsSend(ws, 'Server recieved the following message: ' + msg);
});
