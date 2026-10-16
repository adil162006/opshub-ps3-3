import bcrypt from 'bcryptjs';

const saltRounds = 12;

export const MIN_PASSWORD_LENGTH = 6;

export const hashPassword = (password) => bcrypt.hash(password, saltRounds);

export const comparePassword = (password, passwordHash) =>
  bcrypt.compare(password, passwordHash);
