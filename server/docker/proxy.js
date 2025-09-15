const config = require('../config/defaults');
const engine = require('./engineClient');
const portainer = require('./portainerClient');

function requestDockerAPI(path, method = 'GET') {
	if (String(config.USE_PORTAINER).toLowerCase() === 'true') {
		return portainer.portainerRequest(path, method);
	}
	return engine.dockerRequest(path, method);
}

module.exports = { requestDockerAPI };
