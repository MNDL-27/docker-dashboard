const https = require('https');
const config = require('../config/defaults');

function portainerRequest(path, method = 'GET') {
	return new Promise((resolve, reject) => {
		let url;
		try {
			url = new URL(config.PORTAINER_URL);
		} catch {
			return reject(new Error('Invalid PORTAINER_URL'));
		}
		const options = {
			hostname: url.hostname,
			port: url.port || 443,
			path: `/api/endpoints/${config.PORTAINER_ENDPOINT_ID}/docker${path}`,
			method,
			headers: {
				'X-API-Key': config.PORTAINER_API_KEY,
			},
			rejectUnauthorized: false,
			timeout: 10000,
		};
		const req = https.request(options, res => {
			const chunks = [];
			res.on('data', chunk => chunks.push(chunk));
			res.on('end', () => {
				const data = Buffer.concat(chunks).toString();
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
			reject(new Error('Portainer request timed out'));
		});
		req.end();
	});
}

module.exports = { portainerRequest };
