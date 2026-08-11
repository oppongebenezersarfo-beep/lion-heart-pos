import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    fullName: string;
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      fullName: decoded.fullName,
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token.' });
  }
};
