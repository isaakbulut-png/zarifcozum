function redisOptions(connectionUrl) {
  let url;
  try {
    url = new URL(connectionUrl);
  } catch {
    throw new TypeError('REDIS_URL geçerli bir Redis bağlantı adresi olmalıdır.');
  }

  if (!['redis:', 'rediss:'].includes(url.protocol)) {
    throw new TypeError('REDIS_URL redis:// veya rediss:// ile başlamalıdır.');
  }

  const isUpstash = url.hostname.toLowerCase().endsWith('.upstash.io');
  const useTls = url.protocol === 'rediss:' || isUpstash;
  return {
    url: isUpstash && url.protocol === 'redis:'
      ? connectionUrl.replace(/^redis:/i, 'rediss:')
      : connectionUrl,
    socket: useTls ? { connectTimeout: 3000, tls: true } : { connectTimeout: 3000 }
  };
}

module.exports = { redisOptions };
