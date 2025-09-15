module.exports = {
	PORT: process.env.PORT || 8088,
	USE_PORTAINER: process.env.USE_PORTAINER || 'false',
	DOCKER_SOCKET: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
	PORTAINER_URL: process.env.PORTAINER_URL || '',
	PORTAINER_ENDPOINT_ID: process.env.PORTAINER_ENDPOINT_ID || '',
	PORTAINER_API_KEY: process.env.PORTAINER_API_KEY || '',
};
