import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      cookies: Record<string, string>;
    }
  }
}

// Lightweight cookie-parser middleware (zero external dependencies)
export function cookieParser() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const cookies: Record<string, string> = {};
    const header = req.headers.cookie;

    if (header) {
      for (const pair of header.split(';')) {
        const idx = pair.indexOf('=');
        if (idx > 0) {
          const key = pair.slice(0, idx).trim();
          const val = pair.slice(idx + 1).trim();
          try {
            cookies[key] = decodeURIComponent(val);
          } catch {
            cookies[key] = val;
          }
        }
      }
    }

    req.cookies = cookies;
    next();
  };
}
