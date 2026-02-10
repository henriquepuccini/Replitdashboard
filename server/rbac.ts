import { Request, Response, NextFunction } from "express";
import { type User, type UserRole, USER_ROLES } from "@shared/schema";
import { storage } from "./storage";

declare global {
  namespace Express {
    interface Request {
      currentUser?: User;
      currentUserSchools?: { schoolId: string; role: string }[];
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.currentUser) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (!req.currentUser.isActive) {
    return res.status(403).json({ message: "Account is deactivated" });
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.currentUser) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (!req.currentUser.isActive) {
      return res.status(403).json({ message: "Account is deactivated" });
    }
    if (!roles.includes(req.currentUser.role as UserRole)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

export function isAdmin(req: Request): boolean {
  return req.currentUser?.role === "admin" && req.currentUser?.isActive === true;
}

export function hasElevatedRole(req: Request): boolean {
  const elevatedRoles: UserRole[] = [
    "admin",
    "director",
    "finance",
    "ops",
    "exec",
  ];
  return (
    req.currentUser?.isActive === true &&
    elevatedRoles.includes(req.currentUser?.role as UserRole)
  );
}

export async function isDirectorOfSchool(
  req: Request,
  schoolId: string
): Promise<boolean> {
  if (!req.currentUser) return false;
  const userSchools = await storage.getUserSchoolsByUserId(req.currentUser.id);
  return userSchools.some(
    (us) => us.schoolId === schoolId && us.role === "director"
  );
}

export async function loadCurrentUser(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const userId = req.headers["x-user-id"] as string | undefined;

  if (userId) {
    try {
      const user = await storage.getUser(userId);
      if (user && user.isActive) {
        req.currentUser = user;
        const userSchools = await storage.getUserSchoolsByUserId(user.id);
        req.currentUserSchools = userSchools.map((us) => ({
          schoolId: us.schoolId,
          role: us.role,
        }));
      }
    } catch {
      // silently continue without user context
    }
  }

  next();
}

export const MUTABLE_USER_FIELDS_SELF = [
  "fullName",
  "avatarUrl",
  "preferredLanguage",
] as const;

export function filterUserUpdateFields(
  data: Record<string, any>,
  isSelf: boolean,
  isAdminUser: boolean
): Record<string, any> {
  if (isAdminUser) {
    return data;
  }

  if (isSelf) {
    const filtered: Record<string, any> = {};
    for (const key of MUTABLE_USER_FIELDS_SELF) {
      if (key in data) {
        filtered[key] = data[key];
      }
    }
    return filtered;
  }

  return {};
}
