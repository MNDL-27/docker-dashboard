const express = require('express');
const router = express.Router();
const proxy = require('../docker/proxy');

router.get('/', async (req, res) => {
	try {
		const result = await proxy.requestDockerAPI('/containers/json');
		if (typeof result.data === 'string') {
			try {
				res.json(JSON.parse(result.data));
			} catch {
				res.status(500).json({ error: 'Invalid container data' });
			}
		} else {
			res.json(result.data);
		}
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;
