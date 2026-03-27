const { verifyToken } = require('../utils/token');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: token missing' });
  }

  try {
    const payload = verifyToken(token);
    const activeIdentityHeader = req.headers['x-active-identity'];
    const identities = Array.isArray(payload.identities)
      ? payload.identities
      : ['recruiter', 'jobseeker'];
    const activeIdentity = identities.includes(activeIdentityHeader)
      ? activeIdentityHeader
      : identities[0];

    req.user = payload;
    req.user.identities = identities;
    req.user.activeIdentity = activeIdentity;
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
