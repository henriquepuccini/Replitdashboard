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

  app.get("/api/users", async (_req, res) => {
    try {
      const allUsers = await storage.getUsers();
      res.json(allUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/users", async (req, res) => {
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
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const data = insertUserSchema.partial().parse(req.body);
      const user = await storage.updateUser(req.params.id, data);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(400).json({ message: handleZodError(error) });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteUser(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.get("/api/schools", async (_req, res) => {
    try {
      const allSchools = await storage.getSchools();
      res.json(allSchools);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schools" });
    }
  });

  app.get("/api/schools/:id", async (req, res) => {
    try {
      const school = await storage.getSchool(req.params.id);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }
      res.json(school);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch school" });
    }
  });

  app.post("/api/schools", async (req, res) => {
    try {
      const data = insertSchoolSchema.parse(req.body);
      const existing = await storage.getSchoolByCode(data.code);
      if (existing) {
        return res.status(409).json({ message: "School code already in use" });
      }
      const school = await storage.createSchool(data);
      res.status(201).json(school);
    } catch (error) {
      res.status(400).json({ message: handleZodError(error) });
    }
  });

  app.patch("/api/schools/:id", async (req, res) => {
    try {
      const data = insertSchoolSchema.partial().parse(req.body);
      const school = await storage.updateSchool(req.params.id, data);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }
      res.json(school);
    } catch (error) {
      res.status(400).json({ message: handleZodError(error) });
    }
  });

  app.delete("/api/schools/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSchool(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "School not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete school" });
    }
  });

  app.get("/api/user-schools/user/:userId", async (req, res) => {
    try {
      const userSchools = await storage.getUserSchoolsByUserId(
        req.params.userId
      );
      res.json(userSchools);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user-school mappings" });
    }
  });

  app.get("/api/user-schools/school/:schoolId", async (req, res) => {
    try {
      const userSchools = await storage.getUserSchoolsBySchoolId(
        req.params.schoolId
      );
      res.json(userSchools);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user-school mappings" });
    }
  });

  app.post("/api/user-schools", async (req, res) => {
    try {
      const data = insertUserSchoolSchema.parse(req.body);
      const userSchool = await storage.createUserSchool(data);
      res.status(201).json(userSchool);
    } catch (error) {
      res.status(400).json({ message: handleZodError(error) });
    }
  });

  app.delete("/api/user-schools/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteUserSchool(req.params.id);
      if (!deleted) {
        return res
          .status(404)
          .json({ message: "User-school mapping not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user-school mapping" });
    }
  });

  return httpServer;
}
