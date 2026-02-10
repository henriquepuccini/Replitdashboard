import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertUserSchema,
  insertSchoolSchema,
  insertUserSchoolSchema,
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

  return httpServer;
}
