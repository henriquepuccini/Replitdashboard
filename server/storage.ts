import {
  type User,
  type InsertUser,
  type School,
  type InsertSchool,
  type UserSchool,
  type InsertUserSchool,
  type AuthUserSyncLog,
  type InsertAuthUserSyncLog,
  users,
  schools,
  userSchools,
  authUserSyncLogs,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  upsertUserFromAuth(
    id: string,
    email: string,
    fullName?: string | null,
    avatarUrl?: string | null
  ): Promise<User>;
  softDeleteUser(id: string): Promise<User | undefined>;

  getSchool(id: string): Promise<School | undefined>;
  getSchoolByCode(code: string): Promise<School | undefined>;
  getSchools(): Promise<School[]>;
  createSchool(school: InsertSchool): Promise<School>;
  updateSchool(id: string, data: Partial<InsertSchool>): Promise<School | undefined>;
  deleteSchool(id: string): Promise<boolean>;

  getUserSchool(id: string): Promise<UserSchool | undefined>;
  getUserSchoolsByUserId(userId: string): Promise<UserSchool[]>;
  getUserSchoolsBySchoolId(schoolId: string): Promise<UserSchool[]>;
  createUserSchool(userSchool: InsertUserSchool): Promise<UserSchool>;
  deleteUserSchool(id: string): Promise<boolean>;

  createSyncLog(log: InsertAuthUserSyncLog): Promise<AuthUserSyncLog>;
  getSyncLogsByUserId(userId: string, limit?: number): Promise<AuthUserSyncLog[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(
    id: string,
    data: Partial<InsertUser>
  ): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async getSchool(id: string): Promise<School | undefined> {
    const [school] = await db
      .select()
      .from(schools)
      .where(eq(schools.id, id));
    return school;
  }

  async getSchoolByCode(code: string): Promise<School | undefined> {
    const [school] = await db
      .select()
      .from(schools)
      .where(eq(schools.code, code));
    return school;
  }

  async getSchools(): Promise<School[]> {
    return db.select().from(schools);
  }

  async createSchool(insertSchool: InsertSchool): Promise<School> {
    const [school] = await db
      .insert(schools)
      .values(insertSchool)
      .returning();
    return school;
  }

  async updateSchool(
    id: string,
    data: Partial<InsertSchool>
  ): Promise<School | undefined> {
    const [school] = await db
      .update(schools)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schools.id, id))
      .returning();
    return school;
  }

  async deleteSchool(id: string): Promise<boolean> {
    const result = await db
      .delete(schools)
      .where(eq(schools.id, id))
      .returning();
    return result.length > 0;
  }

  async getUserSchool(id: string): Promise<UserSchool | undefined> {
    const [userSchool] = await db
      .select()
      .from(userSchools)
      .where(eq(userSchools.id, id));
    return userSchool;
  }

  async getUserSchoolsByUserId(userId: string): Promise<UserSchool[]> {
    return db
      .select()
      .from(userSchools)
      .where(eq(userSchools.userId, userId));
  }

  async getUserSchoolsBySchoolId(schoolId: string): Promise<UserSchool[]> {
    return db
      .select()
      .from(userSchools)
      .where(eq(userSchools.schoolId, schoolId));
  }

  async createUserSchool(
    insertUserSchool: InsertUserSchool
  ): Promise<UserSchool> {
    const [userSchool] = await db
      .insert(userSchools)
      .values(insertUserSchool)
      .returning();
    return userSchool;
  }

  async deleteUserSchool(id: string): Promise<boolean> {
    const result = await db
      .delete(userSchools)
      .where(eq(userSchools.id, id))
      .returning();
    return result.length > 0;
  }

  async upsertUserFromAuth(
    id: string,
    email: string,
    fullName?: string | null,
    avatarUrl?: string | null
  ): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        id,
        email,
        fullName: fullName ?? null,
        avatarUrl: avatarUrl ?? null,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email,
          fullName: fullName !== undefined ? fullName : undefined,
          avatarUrl: avatarUrl !== undefined ? avatarUrl : undefined,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async softDeleteUser(id: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async createSyncLog(log: InsertAuthUserSyncLog): Promise<AuthUserSyncLog> {
    const [entry] = await db
      .insert(authUserSyncLogs)
      .values(log)
      .returning();
    return entry;
  }

  async getSyncLogsByUserId(
    userId: string,
    limit: number = 50
  ): Promise<AuthUserSyncLog[]> {
    return db
      .select()
      .from(authUserSyncLogs)
      .where(eq(authUserSyncLogs.userId, userId))
      .orderBy(desc(authUserSyncLogs.createdAt))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
