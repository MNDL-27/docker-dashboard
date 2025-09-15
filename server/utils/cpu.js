function calculateCPUPercent(stats) {
	if (!stats || !stats.cpu_stats || !stats.precpu_stats) return 0;
	const cpuDelta = (stats.cpu_stats.cpu_usage?.total_usage || 0) - (stats.precpu_stats.cpu_usage?.total_usage || 0);
	const systemDelta = (stats.cpu_stats.system_cpu_usage || 0) - (stats.precpu_stats.system_cpu_usage || 0);
	const onlineCPUs = stats.cpu_stats.online_cpus || 1;
	if (systemDelta > 0 && cpuDelta > 0) {
		return (cpuDelta / systemDelta) * onlineCPUs * 100.0;
	}
	return 0;
}

module.exports = { calculateCPUPercent };
