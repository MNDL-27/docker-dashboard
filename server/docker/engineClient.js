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
