const os = require('os');
const net = require('net');
const env = require('../config/env');

let cachedLanIp = null;
let lastLanCheckTime = 0;
const LAN_CACHE_TTL_MS = 30000; // 30 seconds

/**
 * Normalizes an IP string:
 * - strips IPv6-mapped IPv4 prefix ("::ffff:192.168.1.25" -> "192.168.1.25")
 * - picks first address if comma-separated list
 * - strips brackets, port numbers, zone IDs (%eth0)
 * - trims to max 45 chars
 */
function normalizeIp(val) {
  if (!val || typeof val !== 'string') return '';
  let str = val.trim();

  // If list of IPs, take first (client IP)
  if (str.includes(',')) {
    str = str.split(',')[0].trim();
  }

  // Strip IPv6-mapped IPv4 prefix
  if (str.startsWith('::ffff:')) {
    str = str.slice(7);
  }

  // Strip IPv6 brackets and port [::1]:8080 -> ::1
  if (str.startsWith('[') && str.includes(']')) {
    str = str.slice(1, str.indexOf(']'));
  } else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(str)) {
    // IPv4 with port 192.168.1.1:8080 -> 192.168.1.1
    str = str.split(':')[0];
  }

  // Strip zone ID e.g. fe80::1%eth0 -> fe80::1
  if (str.includes('%')) {
    str = str.split('%')[0];
  }

  str = str.slice(0, 45).trim();
  return str;
}

/**
 * Checks whether an IP is a local loopback address
 */
function isLoopbackIp(ip) {
  if (!ip) return false;
  const normalized = normalizeIp(ip);
  return (
    normalized === '::1' ||
    normalized === '0:0:0:0:0:0:0:1' ||
    normalized === 'localhost' ||
    normalized.startsWith('127.')
  );
}

/**
 * Resolves the primary local LAN IPv4 address of the machine
 * Prioritizes active Wi-Fi / Ethernet non-internal adapters in private ranges:
 * (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
 * Falls back to 127.0.0.1 if completely offline
 */
function getLocalLanIp(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedLanIp && (now - lastLanCheckTime < LAN_CACHE_TTL_MS)) {
    return cachedLanIp;
  }

  try {
    const ifaces = os.networkInterfaces();
    const candidates = [];

    for (const [name, list] of Object.entries(ifaces)) {
      if (!list) continue;
      for (const iface of list) {
        if ((iface.family === 'IPv4' || iface.family === 4) && !iface.internal) {
          const addr = iface.address;
          let score = 0;

          // Prefer private IPv4 ranges
          if (addr.startsWith('192.168.')) score += 30;
          else if (addr.startsWith('10.')) score += 25;
          else if (/^172\.(1[6-9]|2\d|3[01])\./.test(addr)) score += 20;
          else score += 10;

          const lowerName = name.toLowerCase();
          // Boost standard physical network adapter names
          if (
            lowerName.includes('wi-fi') ||
            lowerName.includes('wifi') ||
            lowerName.includes('wireless') ||
            lowerName.includes('wlan') ||
            lowerName.includes('ethernet') ||
            lowerName.includes('eth') ||
            lowerName.includes('en0') ||
            lowerName.includes('wlan0')
          ) {
            score += 15;
          }

          // Penalize virtual / container / hypervisor adapters
          if (
            lowerName.includes('virtual') ||
            lowerName.includes('vbox') ||
            lowerName.includes('vmware') ||
            lowerName.includes('vethernet') ||
            lowerName.includes('docker')
          ) {
            score -= 20;
          }

          if (addr === '192.168.56.1') {
            score -= 15; // Common default VirtualBox Host-Only subnet
          }

          candidates.push({ name, addr, score });
        }
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length > 0 && candidates[0].score > 0) {
      cachedLanIp = candidates[0].addr;
    } else {
      cachedLanIp = '127.0.0.1';
    }
  } catch (err) {
    cachedLanIp = '127.0.0.1';
  }

  lastLanCheckTime = now;
  return cachedLanIp;
}

/**
 * Clears the cached LAN IP (useful for tests)
 */
function clearLanIpCache() {
  cachedLanIp = null;
  lastLanCheckTime = 0;
}

/**
 * Returns full IP details from an Express request:
 * {
 *   ip: string,         // Real normalized client IP (or resolved LAN IP if loopback)
 *   rawIp: string,      // Original IP string as seen by the server
 *   source: string      // 'direct' | 'proxy' | 'local-resolved' | 'unknown'
 * }
 */
function getClientIpDetails(req) {
  if (!req) {
    return {
      ip: '127.0.0.1',
      rawIp: 'internal',
      source: 'local-resolved'
    };
  }

  // Determine trust proxy setting from req.app or environment
  let isTrustProxyEnabled = false;
  if (req.app && typeof req.app.get === 'function') {
    const tp = req.app.get('trust proxy');
    isTrustProxyEnabled = tp !== false && tp !== undefined && tp !== 0;
  } else {
    isTrustProxyEnabled = !!(env.TRUST_PROXY !== false && env.TRUST_PROXY !== undefined && env.TRUST_PROXY !== 'false');
  }

  let rawIp = '';
  let candidate = '';
  let isViaProxy = false;

  if (isTrustProxyEnabled) {
    // When trust proxy is enabled, Express safely evaluates X-Forwarded-For based on trust proxy hops
    rawIp = req.headers?.['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || '';
    candidate = req.ip || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '';
    if (req.headers?.['x-forwarded-for'] || (req.ips && req.ips.length > 0)) {
      isViaProxy = true;
    }
  } else {
    // When trust proxy is disabled, NEVER trust client headers (X-Forwarded-For, X-Real-IP can be spoofed)
    // Only trust the direct TCP socket remoteAddress
    rawIp = req.socket?.remoteAddress || req.connection?.remoteAddress || req.ip || '';
    candidate = rawIp;
    isViaProxy = false;
  }

  const normalized = normalizeIp(candidate);

  // Check loopback case (request originating from same machine)
  if (isLoopbackIp(normalized)) {
    const lanIp = getLocalLanIp();
    return {
      ip: lanIp,
      rawIp: normalized || '::1',
      source: 'local-resolved'
    };
  }

  // Validate normalized IP with net.isIP
  const ipVersion = net.isIP(normalized);
  if (ipVersion === 4 || ipVersion === 6) {
    return {
      ip: normalized,
      rawIp: normalizeIp(rawIp) || normalized,
      source: isViaProxy ? 'proxy' : 'direct'
    };
  }

  return {
    ip: 'unknown',
    rawIp: String(rawIp || 'unknown').slice(0, 45),
    source: 'unknown'
  };
}

/**
 * Primary helper returning the sanitized client IP string
 */
function getClientIp(req) {
  return getClientIpDetails(req).ip;
}

module.exports = {
  getClientIp,
  getClientIpDetails,
  getLocalLanIp,
  clearLanIpCache,
  normalizeIp,
  isLoopbackIp
};

