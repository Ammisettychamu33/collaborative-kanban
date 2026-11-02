import jwt from 'jsonwebtoken';
import { prisma } from '../database/db.js';
import config from '../config/index.js';
import { AppError } from './errorHandler.js';

export async function authenticate(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      throw new AppError('Authentication token required', 401, 'AUTH_REQUIRED');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError('Session expired. Please log in again.', 401, 'TOKEN_EXPIRED');
      }
      throw new AppError('Invalid authentication token', 401, 'INVALID_TOKEN');
    }

    // Verify user still exists in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        memberships: {
          include: {
            organization: true,
            tenant: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User account not found', 401, 'USER_NOT_FOUND');
    }

    // Attach to request
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
    };
    req.memberships = user.memberships;

    next();
  } catch (err) {
    next(err);
  }
}
