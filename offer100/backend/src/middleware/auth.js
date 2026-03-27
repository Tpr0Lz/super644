const { verifyToken } = require('../utils/token');
const { get } = require('../data/db');

function parseIdentities(raw) {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function normalizeIdentities(role, identities) {
  if (role === 'admin') {
    const set = new Set(['admin', 'recruiter', 'jobseeker']);
    identities.forEach((item) => {
      const value = String(item || '').trim();
      if (value) {
        set.add(value);
      }
    });
    return Array.from(set);
  }
  return identities.length > 0 ? identities : ['jobseeker'];
}

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: token missing' });
  }

  try {
    const payload = verifyToken(token);
    const userRow = await get(
      'SELECT username, role, identities, initial_identity FROM users WHERE id = ?',
      [payload.id]
    );

    if (!userRow) {
      return res.status(401).json({ message: 'Unauthorized: user not found' });
    }

    const activeIdentityHeader = req.headers['x-active-identity'];
    const identities = parseIdentities(userRow.identities);
    const normalizedIdentities = normalizeIdentities(userRow.role, identities);
    const activeIdentity = normalizedIdentities.includes(activeIdentityHeader)
      ? activeIdentityHeader
      : normalizedIdentities.includes(userRow.initial_identity)
        ? userRow.initial_identity
        : normalizedIdentities[0];

    req.user = {
      ...payload,
      username: userRow.username || payload.username,
      role: userRow.role || payload.role,
      identities: normalizedIdentities,
      initialIdentity: userRow.initial_identity || payload.initialIdentity,
      activeIdentity
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized: token invalid' });
  }
}

function authorize(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient permission' });
    }
    next();
  };
}

function requireIdentity(identities = []) {
  return (req, res, next) => {
    if (!req.user || !req.user.activeIdentity) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (identities.length > 0 && !identities.includes(req.user.activeIdentity)) {
      return res.status(403).json({ message: 'Forbidden: identity not allowed' });
    }
    next();
  };
}

module.exports = {
  authenticate,
  authorize,
  requireIdentity
};
