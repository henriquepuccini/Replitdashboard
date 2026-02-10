import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertUserSchema,
  insertSchoolSchema,
  insertUserSchoolSchema,
  type SyncOperation,
} from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import {
  requireAuth,
  requireRole,
  isAdmin,
  hasElevatedRole,
  isDirectorOfSchool,
  loadCurrentUser,
  filterUserUpdateFields,
} from "./rbac";

function handleZodError(error: unknown) {
  if (error instanceof ZodError) {
    return fromZodError(error).toString();
  }
  return error instanceof Error ? error.message : "Unknown error";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use("/api", loadCurrentUser);

  // =========================================================================
  // AUTH SESSION
  // =========================================================================

  app.get("/api/auth/me", (req, res) => {
    if (!req.currentUser) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.currentUser);
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      if (!user.isActive) {
        return res.status(403).json({ message: "Account is deactivated" });
      }

      req.session.userId = user.id;
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/dev-users", async (_req, res) => {
    try {
      const allUsers = await storage.getUsers();
      const minimal = allUsers
        .filter((u) => u.isActive)
        .map((u) => ({
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          role: u.role,
        }));
      res.json(minimal);
    } catch {
      res.status(500).json({ message: "Failed to fetch dev users" });
    }
  });

  // =========================================================================
  // USERS
  // =========================================================================

  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      if (isAdmin(req)) {
        const allUsers = await storage.getUsers();
        return res.json(allUsers);
      }
      if (req.currentUser) {
        return res.json([req.currentUser]);
      }
      res.json([]);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const targetId = req.params.id as string;
      if (!isAdmin(req) && req.currentUser?.id !== targetId) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const user = await storage.getUser(targetId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post(
    "/api/users",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const data = insertUserSchema.parse(req.body);
        const existing = await storage.getUserByEmail(data.email);
        if (existing) {
          return res.status(409).json({ message: "Email already in use" });
        }
        const user = await storage.createUser(data);
        res.status(201).json(user);
      } catch (error) {
        res.status(400).json({ message: handleZodError(error) });
      }
    }
  );

  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const targetId = req.params.id as string;
      const isSelf = req.currentUser?.id === targetId;
      const isAdminUser = isAdmin(req);

      if (!isSelf && !isAdminUser) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const rawData = insertUserSchema.partial().parse(req.body);
      const filteredData = filterUserUpdateFields(rawData, isSelf, isAdminUser);

      if (Object.keys(filteredData).length === 0) {
        return res
          .status(403)
          .json({ message: "No permitted fields to update" });
      }

      const user = await storage.updateUser(targetId, filteredData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(400).json({ message: handleZodError(error) });
    }
  });

  app.delete(
    "/api/users/:id",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const deleted = await storage.deleteUser(req.params.id as string);
        if (!deleted) {
          return res.status(404).json({ message: "User not found" });
        }
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ message: "Failed to delete user" });
      }
    }
  );

  // =========================================================================
  // SCHOOLS
  // =========================================================================

  app.get("/api/schools", requireAuth, async (req, res) => {
    try {
      const allSchools = await storage.getSchools();
      if (hasElevatedRole(req)) {
        return res.json(allSchools);
      }
      const minimal = allSchools.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
      }));
      res.json(minimal);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schools" });
    }
  });

  app.get("/api/schools/:id", requireAuth, async (req, res) => {
    try {
      const school = await storage.getSchool(req.params.id as string);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }
      if (hasElevatedRole(req)) {
        return res.json(school);
      }
      res.json({ id: school.id, name: school.name, code: school.code });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch school" });
    }
  });

  app.post(
    "/api/schools",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const data = insertSchoolSchema.parse(req.body);
        const existing = await storage.getSchoolByCode(data.code);
        if (existing) {
          return res
            .status(409)
            .json({ message: "School code already in use" });
        }
        const school = await storage.createSchool(data);
        res.status(201).json(school);
      } catch (error) {
        res.status(400).json({ message: handleZodError(error) });
      }
    }
  );

  app.patch(
    "/api/schools/:id",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const data = insertSchoolSchema.partial().parse(req.body);
        const school = await storage.updateSchool(req.params.id as string, data);
        if (!school) {
          return res.status(404).json({ message: "School not found" });
        }
        res.json(school);
      } catch (error) {
        res.status(400).json({ message: handleZodError(error) });
      }
    }
  );

  app.delete(
    "/api/schools/:id",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const deleted = await storage.deleteSchool(req.params.id as string);
        if (!deleted) {
          return res.status(404).json({ message: "School not found" });
        }
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ message: "Failed to delete school" });
      }
    }
  );

  // =========================================================================
  // USER-SCHOOLS
  // =========================================================================

  app.get("/api/user-schools/user/:userId", requireAuth, async (req, res) => {
    try {
      const targetUserId = req.params.userId as string;
      const isSelf = req.currentUser?.id === targetUserId;

      if (!isSelf && !isAdmin(req)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const userSchools = await storage.getUserSchoolsByUserId(targetUserId);
      res.json(userSchools);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to fetch user-school mappings" });
    }
  });

  app.get(
    "/api/user-schools/school/:schoolId",
    requireAuth,
    async (req, res) => {
      try {
        const schoolId = req.params.schoolId as string;
        const isAdminUser = isAdmin(req);
        const isDirector = await isDirectorOfSchool(req, schoolId);

        if (!isAdminUser && !isDirector) {
          return res.status(403).json({ message: "Insufficient permissions" });
        }

        const userSchools =
          await storage.getUserSchoolsBySchoolId(schoolId);
        res.json(userSchools);
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to fetch user-school mappings" });
      }
    }
  );

  app.post(
    "/api/user-schools",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const data = insertUserSchoolSchema.parse(req.body);
        const userSchool = await storage.createUserSchool(data);
        res.status(201).json(userSchool);
      } catch (error) {
        res.status(400).json({ message: handleZodError(error) });
      }
    }
  );

  app.delete(
    "/api/user-schools/:id",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const deleted = await storage.deleteUserSchool(req.params.id as string);
        if (!deleted) {
          return res
            .status(404)
            .json({ message: "User-school mapping not found" });
        }
        res.status(204).send();
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to delete user-school mapping" });
      }
    }
  );

  // =========================================================================
  // AUTH SYNC WEBHOOK
  // =========================================================================
  // Receives Supabase Auth webhook events and syncs to public.users.
  // Protected by service role key or webhook secret — NOT by session auth.
  // Supabase webhook payload format:
  //   { type: "INSERT"|"UPDATE"|"DELETE", table: "users", schema: "auth",
  //     record: { id, email, raw_user_meta_data: { full_name, avatar_url } },
  //     old_record: { ... } }

  app.post("/api/auth/sync", async (req, res) => {
    try {
      const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      const authHeader = req.headers["authorization"] as string | undefined;
      const webhookHeader = req.headers["x-supabase-webhook-secret"] as
        | string
        | undefined;

      let authenticated = false;

      if (webhookSecret && webhookHeader === webhookSecret) {
        authenticated = true;
      } else if (
        serviceRoleKey &&
        authHeader === `Bearer ${serviceRoleKey}`
      ) {
        authenticated = true;
      }

      if (!webhookSecret && !serviceRoleKey) {
        console.error(
          "AUTH SYNC: No SUPABASE_WEBHOOK_SECRET or SUPABASE_SERVICE_ROLE_KEY configured. " +
            "Rejecting webhook request — configure at least one secret."
        );
        return res.status(503).json({
          message: "Auth sync endpoint not configured. Set SUPABASE_WEBHOOK_SECRET or SUPABASE_SERVICE_ROLE_KEY.",
        });
      }

      if (!authenticated) {
        return res.status(401).json({ message: "Invalid webhook credentials" });
      }

      const { type, record, old_record } = req.body;

      if (!type || !["INSERT", "UPDATE", "DELETE"].includes(type)) {
        return res
          .status(400)
          .json({ message: "Invalid or missing 'type' field" });
      }

      const operation = type as SyncOperation;

      if (operation === "INSERT" || operation === "UPDATE") {
        if (!record?.id || !record?.email) {
          return res
            .status(400)
            .json({ message: "Missing record.id or record.email" });
        }

        const metadata = record.raw_user_meta_data || {};
        const fullName = metadata.full_name || null;
        const avatarUrl = metadata.avatar_url || null;

        const user = await storage.upsertUserFromAuth(
          record.id,
          record.email,
          fullName,
          avatarUrl
        );

        await storage.createSyncLog({
          userId: record.id,
          operation,
          payload: JSON.stringify({
            email: record.email,
            full_name: fullName,
            avatar_url: avatarUrl,
            ...(operation === "UPDATE" && old_record
              ? { old_email: old_record.email }
              : {}),
          }),
        });

        return res
          .status(200)
          .json({
            message: `User ${operation === "INSERT" ? "inserted" : "updated"} successfully`,
            user,
          });
      }

      if (operation === "DELETE") {
        const targetId = old_record?.id || record?.id;
        if (!targetId) {
          return res
            .status(400)
            .json({ message: "Missing user ID for delete operation" });
        }

        const user = await storage.softDeleteUser(targetId);

        await storage.createSyncLog({
          userId: targetId,
          operation: "DELETE",
          payload: JSON.stringify({
            email: old_record?.email || record?.email,
            soft_deleted: true,
          }),
        });

        return res
          .status(200)
          .json({ message: "User soft-deleted successfully", user });
      }

      return res.status(400).json({ message: "Unhandled operation type" });
    } catch (error) {
      console.error("AUTH SYNC ERROR:", error);
      res.status(500).json({
        message: "Auth sync failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Admin endpoint to view sync logs for a user
  app.get(
    "/api/auth/sync-logs/:userId",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const logs = await storage.getSyncLogsByUserId(req.params.userId);
        res.json(logs);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch sync logs" });
      }
    }
  );

  return httpServer;
}
