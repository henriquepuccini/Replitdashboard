import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  uuid,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const USER_ROLES = [
  "admin",
  "director",
  "seller",
  "exec",
  "finance",
  "ops",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const schools = pgTable(
  "schools",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    code: varchar("code", { length: 20 }).notNull().unique(),
    timezone: varchar("timezone", { length: 50 }).default(
      "America/Sao_Paulo"
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_schools_code").on(table.code)]
);

export const users = pgTable(
  "users",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    email: text("email").notNull().unique(),
    fullName: text("full_name"),
    avatarUrl: text("avatar_url"),
    preferredLanguage: varchar("preferred_language", { length: 8 }).default(
      "pt-BR"
    ),
    role: varchar("role", { length: 20 }).notNull().default("seller"),
    schoolId: uuid("school_id").references(() => schools.id, {
      onDelete: "set null",
    }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_users_email").on(table.email),
    index("idx_users_role").on(table.role),
  ]
);

export const userSchools = pgTable(
  "user_schools",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull().default("seller"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_user_schools_user_id_school_id").on(
      table.userId,
      table.schoolId
    ),
  ]
);

export const insertUserSchema = createInsertSchema(users)
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    id: z.string().uuid("Invalid UUID").optional(),
    email: z.string().email("Invalid email address"),
    fullName: z.string().nullable().optional(),
    role: z.enum(USER_ROLES).default("seller"),
    preferredLanguage: z.string().max(8).optional(),
    isActive: z.boolean().optional(),
  });

export const insertSchoolSchema = createInsertSchema(schools)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1, "School name is required"),
    code: z.string().min(1, "School code is required").max(20),
  });

export const insertUserSchoolSchema = createInsertSchema(userSchools)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    userId: z.string().uuid("Invalid user ID"),
    schoolId: z.string().uuid("Invalid school ID"),
    role: z.enum(USER_ROLES).default("seller"),
  });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type School = typeof schools.$inferSelect;

export type InsertUserSchool = z.infer<typeof insertUserSchoolSchema>;
export type UserSchool = typeof userSchools.$inferSelect;
