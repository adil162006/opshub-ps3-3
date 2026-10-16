import 'dotenv/config';
import jwt from 'jsonwebtoken';

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required to sign or verify tokens.');
  }

  return secret;
};

export const generateToken = (payload) =>
  jwt.sign(payload, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });

export const verifyToken = (token) => jwt.verify(token, getSecret());
