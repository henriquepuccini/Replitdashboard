import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertUserSchema,
  insertSchoolSchema,
  insertUserSchoolSchema,
  insertConnectorSchema,
  insertConnectorMappingSchema,
  insertSyncRunSchema,
  insertRawIngestFileSchema,
  type SyncOperation,
} from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import {
  requireAuth,
  requireRole,
  isAdmin,
  isOps,
  isExec,
  hasElevatedRole,
  isDirectorOfSchool,
  isConnectorOwner,
  getUserSchoolIds,
  canViewNormalizedData,
  loadCurrentUser,
  filterUserUpdateFields,
} from "./rbac";
import { runConnector } from "./connectors/sync-engine";
import {
  computeKpi,
  computeKpiForAllSchools,
  computeRollup,
} from "./kpis/compute";
import { listSnippets } from "./kpis/js-snippets";
import {
  insertKpiDefinitionSchema,
  insertKpiGoalSchema,
  insertConnectorSlaSchema,
  insertIntegrationAlertSchema,
} from "@shared/schema";

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
        const logs = await storage.getSyncLogsByUserId(req.params.userId as string);
        res.json(logs);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch sync logs" });
      }
    }
  );

  // =========================================================================
  // CONNECTORS
  // =========================================================================

  app.get("/api/connectors", requireAuth, async (req, res) => {
    try {
      const allConnectors = await storage.getConnectors();
      if (isAdmin(req) || isOps(req)) {
        return res.json(allConnectors);
      }
      const owned = allConnectors.filter(
        (c) => c.ownerId === req.currentUser!.id
      );
      res.json(owned);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch connectors" });
    }
  });

  app.get("/api/connectors/:id", requireAuth, async (req, res) => {
    try {
      const connector = await storage.getConnector(req.params.id as string);
      if (!connector) {
        return res.status(404).json({ message: "Connector not found" });
      }
      if (
        !isAdmin(req) &&
        !isOps(req) &&
        connector.ownerId !== req.currentUser!.id
      ) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      res.json(connector);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch connector" });
    }
  });

  app.post(
    "/api/connectors",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const data = insertConnectorSchema.parse({
          ...req.body,
          ownerId: req.body.ownerId || req.currentUser!.id,
        });
        const connector = await storage.createConnector(data);
        res.status(201).json(connector);
      } catch (error) {
        res.status(400).json({ message: handleZodError(error) });
      }
    }
  );

  app.patch("/api/connectors/:id", requireAuth, async (req, res) => {
    try {
      const connectorId = req.params.id as string;
      if (
        !isAdmin(req) &&
        !(await isConnectorOwner(req, connectorId))
      ) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const data = insertConnectorSchema.partial().parse(req.body);
      const connector = await storage.updateConnector(connectorId, data);
      if (!connector) {
        return res.status(404).json({ message: "Connector not found" });
      }
      res.json(connector);
    } catch (error) {
      res.status(400).json({ message: handleZodError(error) });
    }
  });

  app.delete(
    "/api/connectors/:id",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const deleted = await storage.deleteConnector(req.params.id as string);
        if (!deleted) {
          return res.status(404).json({ message: "Connector not found" });
        }
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ message: "Failed to delete connector" });
      }
    }
  );

  // =========================================================================
  // RUN CONNECTOR SYNC
  // =========================================================================

  app.post(
    "/api/connectors/:connectorId/run",
    requireAuth,
    requireRole("admin", "ops"),
    async (req, res) => {
      try {
        const connectorId = req.params.connectorId as string;
        const connector = await storage.getConnector(connectorId);
        if (!connector) {
          return res.status(404).json({ message: "Connector not found" });
        }

        const options = {
          runId: req.body.runId as string | undefined,
          batchSize: req.body.batchSize as number | undefined,
          maxPages: req.body.maxPages as number | undefined,
          dryRun: req.body.dryRun as boolean | undefined,
        };

        const result = await runConnector(connectorId, options);
        res.json(result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Sync failed";
        res.status(500).json({ message });
      }
    }
  );

  // =========================================================================
  // CONNECTOR MAPPINGS
  // =========================================================================

  app.get(
    "/api/connectors/:connectorId/mappings",
    requireAuth,
    async (req, res) => {
      try {
        const connectorId = req.params.connectorId as string;
        if (
          !isAdmin(req) &&
          !(await isConnectorOwner(req, connectorId))
        ) {
          return res.status(403).json({ message: "Insufficient permissions" });
        }
        const mappings = await storage.getConnectorMappings(connectorId);
        res.json(mappings);
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to fetch connector mappings" });
      }
    }
  );

  app.post(
    "/api/connectors/:connectorId/mappings",
    requireAuth,
    async (req, res) => {
      try {
        const connectorId = req.params.connectorId as string;
        if (
          !isAdmin(req) &&
          !(await isConnectorOwner(req, connectorId))
        ) {
          return res.status(403).json({ message: "Insufficient permissions" });
        }
        const data = insertConnectorMappingSchema.parse({
          ...req.body,
          connectorId,
        });
        const mapping = await storage.createConnectorMapping(data);
        res.status(201).json(mapping);
      } catch (error) {
        res.status(400).json({ message: handleZodError(error) });
      }
    }
  );

  app.patch(
    "/api/connector-mappings/:id",
    requireAuth,
    async (req, res) => {
      try {
        const mapping = await storage.getConnectorMapping(req.params.id as string);
        if (!mapping) {
          return res.status(404).json({ message: "Mapping not found" });
        }
        if (
          !isAdmin(req) &&
          !(await isConnectorOwner(req, mapping.connectorId))
        ) {
          return res.status(403).json({ message: "Insufficient permissions" });
        }
        const data = insertConnectorMappingSchema.partial().parse(req.body);
        const updated = await storage.updateConnectorMapping(
          req.params.id as string,
          data
        );
        if (!updated) {
          return res.status(404).json({ message: "Mapping not found" });
        }
        res.json(updated);
      } catch (error) {
        res.status(400).json({ message: handleZodError(error) });
      }
    }
  );

  app.delete(
    "/api/connector-mappings/:id",
    requireAuth,
    async (req, res) => {
      try {
        const mapping = await storage.getConnectorMapping(req.params.id as string);
        if (!mapping) {
          return res.status(404).json({ message: "Mapping not found" });
        }
        if (
          !isAdmin(req) &&
          !(await isConnectorOwner(req, mapping.connectorId))
        ) {
          return res.status(403).json({ message: "Insufficient permissions" });
        }
        const deleted = await storage.deleteConnectorMapping(req.params.id as string);
        if (!deleted) {
          return res.status(404).json({ message: "Mapping not found" });
        }
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ message: "Failed to delete mapping" });
      }
    }
  );

  // =========================================================================
  // INTEGRATION MONITORING & ALERTS
  // =========================================================================

  app.get(
    "/api/monitoring/metrics/:connectorId",
    requireAuth,
    async (req, res) => {
      try {
        const connectorId = req.params.connectorId as string;
        if (!isAdmin(req) && !isOps(req) && !isExec(req) && !(await isConnectorOwner(req, connectorId))) {
          return res.status(403).json({ message: "Insufficient permissions" });
        }
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
        const metrics = await storage.getConnectorMetrics(connectorId, limit);
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch connector metrics" });
      }
    }
  );

  app.get(
    "/api/monitoring/slas",
    requireAuth,
    requireRole("admin", "ops"),
    async (req, res) => {
      try {
        const slas = await storage.getConnectorSlas();
        res.json(slas);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch SLAs" });
      }
    }
  );

  app.patch(
    "/api/monitoring/slas/:connectorId",
    requireAuth,
    requireRole("admin", "ops"),
    async (req, res) => {
      try {
        const connectorId = req.params.connectorId as string;
        const data = insertConnectorSlaSchema.parse({
          ...req.body,
          connectorId,
        });
        const sla = await storage.upsertConnectorSla(data);
        res.json(sla);
      } catch (error) {
        res.status(400).json({ message: handleZodError(error) });
      }
    }
  );

  app.get(
    "/api/monitoring/alerts",
    requireAuth,
    async (req, res) => {
      try {
        if (!isAdmin(req) && !isOps(req) && !isExec(req)) {
          return res.status(403).json({ message: "Insufficient permissions" });
        }
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 200;
        const alerts = await storage.getIntegrationAlerts(limit);
        res.json(alerts);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch integration alerts" });
      }
    }
  );

  app.patch(
    "/api/monitoring/alerts/:id",
    requireAuth,
    requireRole("admin", "ops"),
    async (req, res) => {
      try {
        const id = req.params.id as string;
        const data = insertIntegrationAlertSchema.partial().parse(req.body);
        const alert = await storage.updateIntegrationAlert(id, data);
        if (!alert) {
          return res.status(404).json({ message: "Alert not found" });
        }
        res.json(alert);
      } catch (error) {
        res.status(400).json({ message: handleZodError(error) });
      }
    }
  );

  // =========================================================================
  // SYNC RUNS (append-only log for auditability)
  // =========================================================================

  app.get(
    "/api/connectors/:connectorId/sync-runs",
    requireAuth,
    async (req, res) => {
      try {
        const connectorId = req.params.connectorId as string;
        if (
          !isAdmin(req) &&
          !isOps(req) &&
          !(await isConnectorOwner(req, connectorId))
        ) {
          return res.status(403).json({ message: "Insufficient permissions" });
        }
        const runs = await storage.getSyncRuns(connectorId);
        res.json(runs);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch sync runs" });
      }
    }
  );

  app.post(
    "/api/connectors/:connectorId/sync-runs",
    requireAuth,
    requireRole("admin", "ops"),
    async (req, res) => {
      try {
        const connectorId = req.params.connectorId as string;
        const data = insertSyncRunSchema.parse({
          ...req.body,
          connectorId,
        });
        const run = await storage.createSyncRun(data);
        res.status(201).json(run);
      } catch (error) {
        res.status(400).json({ message: handleZodError(error) });
      }
    }
  );

  app.patch(
    "/api/sync-runs/:id",
    requireAuth,
    requireRole("admin", "ops"),
    async (req, res) => {
      try {
        const data = insertSyncRunSchema.partial().parse(req.body);
        const run = await storage.updateSyncRun(req.params.id as string, data);
        if (!run) {
          return res.status(404).json({ message: "Sync run not found" });
        }
        res.json(run);
      } catch (error) {
        res.status(400).json({ message: handleZodError(error) });
      }
    }
  );

  // =========================================================================
  // RAW INGEST FILES (append-only log for auditability)
  // =========================================================================

  app.get(
    "/api/connectors/:connectorId/files",
    requireAuth,
    async (req, res) => {
      try {
        const connectorId = req.params.connectorId as string;
        if (
          !isAdmin(req) &&
          !isOps(req) &&
          !(await isConnectorOwner(req, connectorId))
        ) {
          return res.status(403).json({ message: "Insufficient permissions" });
        }
        const files = await storage.getRawIngestFiles(connectorId);
        res.json(files);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch ingest files" });
      }
    }
  );

  app.post(
    "/api/connectors/:connectorId/files",
    requireAuth,
    requireRole("admin", "ops"),
    async (req, res) => {
      try {
        const connectorId = req.params.connectorId as string;
        const data = insertRawIngestFileSchema.parse({
          ...req.body,
          connectorId,
        });
        const file = await storage.createRawIngestFile(data);
        res.status(201).json(file);
      } catch (error) {
        res.status(400).json({ message: handleZodError(error) });
      }
    }
  );

  // =========================================================================
  // NORMALIZED DATA (leads, payments, enrollments)
  // School-scoped access: sellers see their schools, directors/finance see
  // their school scope, admin/exec/ops see all
  // =========================================================================

  app.get("/api/leads", requireAuth, async (req, res) => {
    try {
      if (!canViewNormalizedData(req)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      let allLeads = await storage.getLeads();

      const userRole = req.currentUser!.role;
      if (userRole === "seller") {
        allLeads = allLeads.filter((l) => l.sellerId === req.currentUser!.id);
      } else if (!(isAdmin(req) || isExec(req) || isOps(req))) {
        const schoolIds = getUserSchoolIds(req);
        allLeads = allLeads.filter(
          (l) => l.schoolId && schoolIds.includes(l.schoolId)
        );
      }

      const { stage, status, seller_id, school_id, source, search, period_start, period_end } = req.query;
      if (stage) allLeads = allLeads.filter((l) => l.stage === stage);
      if (status) allLeads = allLeads.filter((l) => l.status === status);
      if (seller_id) allLeads = allLeads.filter((l) => l.sellerId === seller_id);
      if (school_id) allLeads = allLeads.filter((l) => l.schoolId === school_id);
      if (source) allLeads = allLeads.filter((l) => l.sourceConnectorId === source);
      if (period_start) {
        const start = new Date(period_start as string);
        allLeads = allLeads.filter((l) => new Date(l.createdAt) >= start);
      }
      if (period_end) {
        const end = new Date(period_end as string);
        allLeads = allLeads.filter((l) => new Date(l.createdAt) <= end);
      }
      if (search) {
        const q = (search as string).toLowerCase();
        allLeads = allLeads.filter((l) => {
          const p = l.payload as Record<string, unknown>;
          const name = String(p.name || p.nome || "").toLowerCase();
          const email = String(p.email || "").toLowerCase();
          const phone = String(p.phone || p.telefone || "").toLowerCase();
          return name.includes(q) || email.includes(q) || phone.includes(q) || l.sourceId.toLowerCase().includes(q);
        });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const total = allLeads.length;
      const paginated = allLeads.slice((page - 1) * limit, page * limit);

      res.json({ data: paginated, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.get("/api/leads/:id", requireAuth, async (req, res) => {
    try {
      if (!canViewNormalizedData(req)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const leadId = req.params.id as string;
      const lead = await storage.getLead(leadId);
      if (!lead) return res.status(404).json({ message: "Lead not found" });

      const userRole = req.currentUser!.role;
      if (userRole === "seller" && lead.sellerId !== req.currentUser!.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (!["admin", "exec", "ops"].includes(userRole)) {
        const schoolIds = getUserSchoolIds(req);
        if (lead.schoolId && !schoolIds.includes(lead.schoolId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      res.json(lead);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch lead" });
    }
  });

  app.patch("/api/leads/:id", requireAuth, async (req, res) => {
    try {
      const leadId = req.params.id as string;
      const userRole = req.currentUser!.role;
      const lead = await storage.getLead(leadId);
      if (!lead) return res.status(404).json({ message: "Lead not found" });

      if (userRole === "seller") {
        if (lead.sellerId !== req.currentUser!.id) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (!isAdmin(req) && !isOps(req)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const allowedFields = ["stage", "status", "lastInteraction", "sellerId", "schoolId", "payload"];
      const updateData: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (field in req.body) updateData[field] = req.body[field];
      }

      const updated = await storage.updateLead(leadId, updateData as any);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update lead" });
    }
  });

  app.get("/api/payments", requireAuth, async (req, res) => {
    try {
      if (!canViewNormalizedData(req)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const allPayments = await storage.getPayments();
      if (isAdmin(req) || isExec(req) || isOps(req)) {
        return res.json(allPayments);
      }
      const schoolIds = getUserSchoolIds(req);
      const scoped = allPayments.filter(
        (p) => p.schoolId && schoolIds.includes(p.schoolId)
      );
      res.json(scoped);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.get("/api/enrollments", requireAuth, async (req, res) => {
    try {
      if (!canViewNormalizedData(req)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const allEnrollments = await storage.getEnrollments();
      if (isAdmin(req) || isExec(req) || isOps(req)) {
        return res.json(allEnrollments);
      }
      const schoolIds = getUserSchoolIds(req);
      const scoped = allEnrollments.filter(
        (e) => e.schoolId && schoolIds.includes(e.schoolId)
      );
      res.json(scoped);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch enrollments" });
    }
  });

  // =========================================================================
  // KPI DEFINITIONS
  // =========================================================================

  app.get("/api/kpis", requireAuth, async (req, res) => {
    try {
      if (!hasElevatedRole(req)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const activeOnly = req.query.active === "true";
      const definitions = await storage.getKpiDefinitions(activeOnly);
      res.json(definitions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch KPI definitions" });
    }
  });

  app.get("/api/kpis/:id", requireAuth, async (req, res) => {
    try {
      if (!hasElevatedRole(req)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const def = await storage.getKpiDefinition(req.params.id as string);
      if (!def) {
        return res.status(404).json({ message: "KPI definition not found" });
      }
      res.json(def);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch KPI definition" });
    }
  });

  app.post("/api/kpis", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const validated = insertKpiDefinitionSchema.parse(req.body);
      const created = await storage.createKpiDefinition(validated);
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: handleZodError(error) });
      }
      res.status(500).json({ message: "Failed to create KPI definition" });
    }
  });

  app.patch("/api/kpis/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const updated = await storage.updateKpiDefinition(req.params.id as string, req.body);
      if (!updated) {
        return res.status(404).json({ message: "KPI definition not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update KPI definition" });
    }
  });

  // =========================================================================
  // KPI GOALS
  // =========================================================================

  app.get("/api/kpis/:kpiId/goals", requireAuth, async (req, res) => {
    try {
      if (!hasElevatedRole(req)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const schoolId = req.query.school_id as string | undefined;
      const goals = await storage.getKpiGoals(
        req.params.kpiId as string,
        schoolId === "null" ? null : schoolId
      );
      res.json(goals);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch KPI goals" });
    }
  });

  app.post("/api/kpis/:kpiId/goals", requireAuth, async (req, res) => {
    try {
      if (!isAdmin(req) && !isDirectorOfSchool(req, req.body.schoolId)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const validated = insertKpiGoalSchema.parse({
        ...req.body,
        kpiId: req.params.kpiId,
        createdBy: req.currentUser?.id,
      });
      const created = await storage.createKpiGoal(validated);
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: handleZodError(error) });
      }
      res.status(500).json({ message: "Failed to create KPI goal" });
    }
  });

  app.patch("/api/kpis/:kpiId/goals/:goalId", requireAuth, async (req, res) => {
    try {
      if (!isAdmin(req) && !isDirectorOfSchool(req, req.body.schoolId)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const updated = await storage.updateKpiGoal(req.params.goalId as string, req.body);
      if (!updated) {
        return res.status(404).json({ message: "KPI goal not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update KPI goal" });
    }
  });

  app.delete("/api/kpis/:kpiId/goals/:goalId", requireAuth, async (req, res) => {
    try {
      if (!isAdmin(req)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const deleted = await storage.deleteKpiGoal(req.params.goalId as string);
      if (!deleted) {
        return res.status(404).json({ message: "KPI goal not found" });
      }
      res.json({ message: "Goal deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete KPI goal" });
    }
  });

  // =========================================================================
  // KPI VALUES (read-only for users)
  // =========================================================================

  app.get("/api/kpis/:kpiId/values", requireAuth, async (req, res) => {
    try {
      if (!hasElevatedRole(req)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const schoolId = req.query.school_id as string | undefined;
      const limit = parseInt(req.query.limit as string) || 100;
      const values = await storage.getKpiValues(
        req.params.kpiId as string,
        schoolId === "null" ? null : schoolId,
        limit
      );
      res.json(values);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch KPI values" });
    }
  });

  // =========================================================================
  // KPI CALC RUNS (admin/ops only)
  // =========================================================================

  app.get("/api/kpis/:kpiId/calc-runs", requireAuth, async (req, res) => {
    try {
      if (!isAdmin(req) && !isOps(req)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const limit = parseInt(req.query.limit as string) || 50;
      const runs = await storage.getKpiCalcRunsByKpiId(req.params.kpiId as string, limit);
      res.json(runs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch calc runs" });
    }
  });

  app.get("/api/kpi-calc-runs/:runId/audit", requireAuth, async (req, res) => {
    try {
      if (!isAdmin(req) && !isOps(req)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const audits = await storage.getCalculationAuditByRunId(req.params.runId as string);
      res.json(audits);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit records" });
    }
  });

  // =========================================================================
  // KPI COMPUTE ENDPOINTS (admin/ops only)
  // =========================================================================

  app.get("/api/kpi-snippets", requireAuth, async (req, res) => {
    try {
      if (!isAdmin(req) && !isOps(req)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      res.json(listSnippets());
    } catch (error) {
      res.status(500).json({ message: "Failed to list snippets" });
    }
  });

  app.post("/api/kpis/:id/compute", requireAuth, async (req, res) => {
    try {
      if (!isAdmin(req) && !isOps(req)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { period_start, period_end, school_id, version } = req.body;
      if (!period_start || !period_end) {
        return res.status(400).json({ message: "period_start and period_end are required" });
      }

      const result = await computeKpi({
        kpiId: req.params.id as string,
        periodStart: period_start,
        periodEnd: period_end,
        schoolId: school_id || null,
        userId: req.currentUser?.id || null,
        version,
      });

      res.json({
        success: true,
        calcRunId: result.calcRun.id,
        kpiValueId: result.kpiValue.id,
        computedValue: result.computedValue,
        kpiKey: result.definition.key,
        period: { start: period_start, end: period_end },
        schoolId: school_id || null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Computation failed";
      const status = message.includes("concorrente") ? 409 : 500;
      res.status(status).json({ success: false, message });
    }
  });

  app.post("/api/kpis/:id/compute-all", requireAuth, async (req, res) => {
    try {
      if (!isAdmin(req) && !isOps(req)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { period_start, period_end, version, concurrency } = req.body;
      if (!period_start || !period_end) {
        return res.status(400).json({ message: "period_start and period_end are required" });
      }

      const result = await computeKpiForAllSchools(
        req.params.id as string,
        period_start,
        period_end,
        req.currentUser?.id || null,
        version,
        concurrency || 3
      );

      const successCount = result.results.filter((r) => r.success).length;
      const failCount = result.results.filter((r) => !r.success).length;

      res.json({
        success: failCount === 0,
        kpiKey: result.kpiKey,
        totalSchools: result.results.length,
        successCount,
        failCount,
        results: result.results.map((r) => ({
          schoolId: r.schoolId,
          success: r.success,
          computedValue: r.result?.computedValue,
          calcRunId: r.result?.calcRun.id,
          error: r.error,
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Batch computation failed";
      res.status(500).json({ success: false, message });
    }
  });

  app.post("/api/kpis/:id/compute-rollup", requireAuth, async (req, res) => {
    try {
      if (!isAdmin(req) && !isOps(req)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { period_start, period_end, sub_periods, school_id, aggregation } = req.body;
      if (!period_start || !period_end || !sub_periods || !Array.isArray(sub_periods)) {
        return res.status(400).json({
          message: "period_start, period_end, and sub_periods[] are required",
        });
      }

      const result = await computeRollup(
        req.params.id as string,
        period_start,
        period_end,
        sub_periods,
        school_id || null,
        req.currentUser?.id || null,
        aggregation || "sum"
      );

      res.json({
        success: true,
        calcRunId: result.calcRun.id,
        computedValue: result.computedValue,
        kpiKey: result.definition.key,
        period: { start: period_start, end: period_end },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Rollup computation failed";
      res.status(500).json({ success: false, message });
    }
  });

  // ─── Pipeline Materialized View ─────────────────────────────────────
  app.post("/api/pipeline/refresh", requireAuth, async (req, res) => {
    try {
      if (!isAdmin(req) && !isOps(req)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const { pool } = await import("./db");
      await pool.query("REFRESH MATERIALIZED VIEW CONCURRENTLY leads_pipeline_agg");
      res.json({ success: true, refreshedAt: new Date().toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Refresh failed";
      res.status(500).json({ success: false, message });
    }
  });

  app.get("/api/pipeline/agg", requireAuth, async (req, res) => {
    try {
      if (!hasElevatedRole(req)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const { pool } = await import("./db");
      const schoolId = req.query.school_id as string | undefined;
      const sellerId = req.query.seller_id as string | undefined;

      let query = "SELECT school_id, seller_id, stage, lead_count FROM leads_pipeline_agg WHERE 1=1";
      const params: string[] = [];
      if (schoolId) {
        params.push(schoolId);
        query += ` AND school_id = $${params.length}`;
      }
      if (sellerId) {
        params.push(sellerId);
        query += ` AND seller_id = $${params.length}`;
      }
      query += " ORDER BY school_id, seller_id, stage";

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Query failed";
      res.status(500).json({ success: false, message });
    }
  });


  // =========================================================================
  // QUERY BUILDER — filtering & drilldowns
  // =========================================================================
  // GET /api/query?entity=kpi_values|aggregates|comparisons
  //   &kpiId=uuid&schoolId=uuid&metricKey=str
  //   &periodStart=date&periodEnd=date&dateFrom=date&dateTo=date
  //   &sortBy=column&sortDirection=ASC|DESC
  //   &cursor=base64&page=0&limit=50
  //
  // All user-supplied values are passed through validateFilters() before SQL
  // to ensure no untrusted input reaches the query parameterization layer.

  app.get("/api/query", requireAuth, async (req, res) => {
    try {
      // Restrict to roles that should have drilldown access
      const role = req.currentUser?.role;
      const allowed = ["admin", "ops", "exec", "director"];
      if (!role || !allowed.includes(role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { buildKpiValueQuery, buildAggregateQuery, buildComparisonQuery, validateFilters, validatePagination } =
        await import("./query-builder");

      const entity = req.query.entity as string | undefined;
      const raw = { ...req.query } as Record<string, unknown>;

      const filters = validateFilters(raw);
      const pagination = validatePagination(raw);

      let result;

      switch (entity) {
        case "kpi_values":
          result = await buildKpiValueQuery(filters, pagination);
          break;
        case "aggregates":
          result = await buildAggregateQuery(filters, pagination);
          break;
        case "comparisons":
          result = await buildComparisonQuery(filters, pagination);
          break;
        default:
          return res.status(400).json({
            message: "Unknown entity. Allowed: kpi_values, aggregates, comparisons",
          });
      }

      res.json({
        data: result.rows,
        pageInfo: result.pageInfo,
        entity,
        appliedFilters: filters,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Query failed";
      res.status(400).json({ success: false, message });
    }
  });

  // =========================================================================
  // REPORT EXPORTS & DOWNLOADS
  // =========================================================================

  app.get("/api/reports/exports/:id/download", requireAuth, async (req, res) => {
    try {
      const exportId = req.params.id;
      const user = req.currentUser!;

      const { pool } = await import("./db");

      // 1. Fetch export info to verify authorization and get file_path
      const exportQuery = `
        SELECT e.id, e.file_path, e.initiated_by, s.owner_id 
        FROM report_exports e
        LEFT JOIN scheduled_reports s ON e.scheduled_report_id = s.id
        WHERE e.id = $1
      `;
      const result = await pool.query(exportQuery, [exportId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Export not found" });
      }

      const reportExport = result.rows[0];

      // 2. Authorization Rules: Must be Admin, Owner of the schedule, or Initiator of the export
      const isAuthorized =
        user.role === "admin" ||
        user.id === reportExport.initiated_by ||
        user.id === reportExport.owner_id;

      if (!isAuthorized) {
        return res.status(403).json({ message: "Not authorized to download this report" });
      }

      if (!reportExport.file_path) {
        return res.status(400).json({ message: "No file associated with this export yet" });
      }

      // 3. Generate Signed URL using REST API
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceRoleKey) {
        return res.status(500).json({ message: "Server storage not configured" });
      }

      const signUrlEndpoint = `${supabaseUrl}/storage/v1/object/sign/reports-exports/${encodeURIComponent(reportExport.file_path)}`;

      const signResponse = await fetch(signUrlEndpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ expiresIn: 300 }) // 5 minutes (300 seconds) TTL
      });

      if (!signResponse.ok) {
        const errorText = await signResponse.text();
        console.error("Failed to generate signed URL:", errorText);
        throw new Error("Failed to generate secure download link from storage");
      }

      const signData = await signResponse.json() as { signedURL?: string };

      if (!signData.signedURL) {
        throw new Error("Invalid response from storage API");
      }

      // Prefix with the Supabase URL if it's returning a relative path (it usually returns relative)
      let finalSignedUrl = signData.signedURL;
      if (finalSignedUrl.startsWith("/")) {
        finalSignedUrl = `${supabaseUrl}/storage/v1${finalSignedUrl}`;
      }

      // 4. Audit Log
      await pool.query(
        "INSERT INTO report_download_audit (export_id, user_id) VALUES ($1, $2)",
        [exportId, user.id]
      );

      res.json({ url: finalSignedUrl });
    } catch (error) {
      console.error("Report download error:", error);
      const message = error instanceof Error ? error.message : "Failed to download report";
      res.status(500).json({ success: false, message });
    }
  });

  app.post("/api/storage/signed-url", requireAuth, async (req, res) => {
    try {
      const { path, bucket = "reports" } = req.body;

      if (!path) {
        return res.status(400).json({ message: "Path is required" });
      }

      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceRoleKey) {
        return res.status(500).json({ message: "Server storage not configured" });
      }

      const signUrlEndpoint = `${supabaseUrl}/storage/v1/object/sign/${bucket}/${encodeURIComponent(path)}`;

      const signResponse = await fetch(signUrlEndpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ expiresIn: 300 }) // 5 minutes TTL
      });

      if (!signResponse.ok) {
        const errorText = await signResponse.text();
        console.error("Failed to generate signed URL:", errorText);
        throw new Error("Failed to generate secure download link from storage");
      }

      const signData = await signResponse.json() as { signedURL?: string };

      if (!signData.signedURL) {
        throw new Error("Invalid response from storage API");
      }

      let finalSignedUrl = signData.signedURL;
      if (finalSignedUrl.startsWith("/")) {
        finalSignedUrl = `${supabaseUrl}/storage/v1${finalSignedUrl}`;
      }

      res.json({ url: finalSignedUrl });
    } catch (error) {
      console.error("Signed URL generation error:", error);
      const message = error instanceof Error ? error.message : "Failed to generate signed URL";
      res.status(500).json({ success: false, message });
    }
  });

  // =========================================================================
  // CHURN RULES & EVENTS
  // =========================================================================

  app.get("/api/churn-rules", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      // Use RLS to filter automatically
      const result = await pool.query(`
        SELECT r.*, s.name as school_name 
        FROM churn_rules r
        LEFT JOIN schools s ON r.school_id = s.id
        ORDER BY r.created_at DESC
      `);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch rules" });
    }
  });

  app.post("/api/churn-rules", requireAuth, async (req, res) => {
    try {
      const { name, school_id, config, is_active } = req.body;
      const { pool } = await import("./db");
      const result = await pool.query(
        "INSERT INTO churn_rules (name, school_id, config, is_active, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [name, school_id || null, config, is_active ?? true, req.currentUser!.id]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to create rule" });
    }
  });

  app.put("/api/churn-rules/:id", requireAuth, async (req, res) => {
    try {
      const { name, config, is_active } = req.body;
      const { pool } = await import("./db");
      const result = await pool.query(
        "UPDATE churn_rules SET name = $1, config = $2, is_active = $3 WHERE id = $4 RETURNING *",
        [name, config, is_active, req.params.id]
      );
      if (result.rowCount === 0) return res.status(404).json({ message: "Not found or unauthorized" });
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ message: "Failed to update rule" });
    }
  });

  app.delete("/api/churn-rules/:id", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const result = await pool.query("DELETE FROM churn_rules WHERE id = $1", [req.params.id]);
      if (result.rowCount === 0) return res.status(404).json({ message: "Not found or unauthorized" });
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Failed to delete rule" });
    }
  });

  app.get("/api/churn-events", requireAuth, async (req, res) => {
    try {
      const { school_id, source_type, limit = 100 } = req.query;
      const { pool } = await import("./db");

      let query = "SELECT e.*, s.name as school_name FROM churn_events e LEFT JOIN schools s ON e.school_id = s.id WHERE 1=1";
      const params: any[] = [];
      let paramCount = 1;

      if (school_id) {
        query += ` AND e.school_id = $${paramCount++}`;
        params.push(school_id);
      }
      if (source_type) {
        query += ` AND e.source_type = $${paramCount++}`;
        params.push(source_type);
      }

      query += ` ORDER BY e.detected_at DESC LIMIT $${paramCount}`;
      params.push(limit);

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get("/api/churn-runs", requireAuth, async (req, res) => {
    try {
      const { rule_id } = req.query;
      const { pool } = await import("./db");
      let query = "SELECT * FROM churn_runs WHERE 1=1";
      const params: any[] = [];
      if (rule_id) {
        query += " AND rule_id = $1";
        params.push(rule_id);
      }
      query += " ORDER BY started_at DESC LIMIT 50";
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch runs" });
    }
  });

  app.post("/api/churn-rules/:id/run", requireAuth, async (req, res) => {
    try {
      const ruleId = req.params.id;
      const { dry_run } = req.body;

      const supabaseUrl = process.env.SUPABASE_URL;
      // The endpoint requires an Auth header. We can pass the authenticated user's access token 
      // if they used supabase auth on the frontend, OR we proxy it by passing the Service Role 
      // and trusting the fact that they hit this endpoint behind `requireAuth` checking.
      // Because our edge function also verifies RLS or accepts Service Role, we will use Service Role server-to-server.
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceRoleKey) {
        return res.status(500).json({ message: "Supabase integration not configured" });
      }

      const functionUrl = `${supabaseUrl}/functions/v1/churn_run`;

      const fnRes = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rule_id: ruleId,
          dry_run: !!dry_run
        })
      });

      const data = await fnRes.json();
      if (!fnRes.ok) {
        return res.status(fnRes.status).json({ message: data.message || "Function execution failed" });
      }

      res.json(data);
    } catch (error) {
      console.error("Failed to run churn engine:", error);
      res.status(500).json({ message: "Failed to invoke churn engine" });
    }
  });

  return httpServer;
}
