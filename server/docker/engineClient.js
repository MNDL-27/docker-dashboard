const http = require('http');
const config = require('../config/defaults');

function dockerRequest(path, method = 'GET') {
	return new Promise((resolve, reject) => {
		const options = {
			socketPath: config.DOCKER_SOCKET,
			path,
			method,
			timeout: 10000,
		};
		const req = http.request(options, res => {
			let data = '';
			res.on('data', chunk => data += chunk);
			res.on('end', () => {
				try {
					resolve({ status: res.statusCode, data: JSON.parse(data) });
				} catch {
					resolve({ status: res.statusCode, data });
				}
			});
		});
		req.on('error', reject);
		req.on('timeout', () => {
			req.destroy();
			reject(new Error('Docker request timed out'));
		});
		req.end();
	});
}

module.exports = { dockerRequest };

// Stream container logs: call onData for each chunk received, onEnd when connection closes, onError on errors
function streamContainerLogs(id, { onData, onEnd, onError } = {}) {
	const path = `/containers/${id}/logs?follow=1&stdout=1&stderr=1&tail=200`;
	try {
		const options = {
			socketPath: config.DOCKER_SOCKET,
			path,
			method: 'GET',
			timeout: 0, // allow long-lived connection
		};
		const req = http.request(options, res => {
			res.on('data', chunk => {
				if (onData) onData(chunk);
			});
			res.on('end', () => {
				if (onEnd) onEnd();
			});
			res.on('error', err => {
				if (onError) onError(err);
			});
		});
		req.on('error', err => { if (onError) onError(err); });
		req.end();
		return req; // caller can abort if needed
	} catch (err) {
		if (onError) onError(err);
		return null;
	}
}

module.exports = { dockerRequest, streamContainerLogs };
