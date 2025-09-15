function aggregateIO(stats) {
	const blkioArr = stats?.blkio_stats?.io_service_bytes_recursive || [];
	const blkio = blkioArr.reduce((acc, cur) => {
		acc[cur.op] = (acc[cur.op] || 0) + cur.value;
		return acc;
	}, {});
	const networksObj = stats?.networks || {};
	const networks = Object.values(networksObj).reduce((acc, cur) => {
		acc.rx_bytes += cur.rx_bytes || 0;
		acc.tx_bytes += cur.tx_bytes || 0;
		return acc;
	}, { rx_bytes: 0, tx_bytes: 0 });
	return { blkio, networks };
}

module.exports = { aggregateIO };
