function validateEnv(config) {
	const errors = [];
	if (!config.PORT) errors.push('PORT is required');
	if (config.USE_PORTAINER === 'true') {
		if (!config.PORTAINER_URL) errors.push('PORTAINER_URL is required');
		if (!config.PORTAINER_ENDPOINT_ID) errors.push('PORTAINER_ENDPOINT_ID is required');
		if (!config.PORTAINER_API_KEY) errors.push('PORTAINER_API_KEY is required');
	} else {
		if (!config.DOCKER_SOCKET) errors.push('DOCKER_SOCKET is required');
	}
	if (errors.length) throw new Error('Config validation error: ' + errors.join(', '));
}

module.exports = { validateEnv };
