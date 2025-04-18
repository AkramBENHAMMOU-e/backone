import { User } from "@shared/schema";
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    guestCart?: Record<string, number>;
  }
}

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      isAdmin: boolean;
    }
  }
}
