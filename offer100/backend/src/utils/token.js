const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'offer100-secret-key';

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '8h' });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = {
  signToken,
  verifyToken
};
