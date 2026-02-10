import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  uuid,
  boolean,
  timestamp,
  index,
  jsonb,
  bigint,
  integer,
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

export const SYNC_OPERATIONS = ["INSERT", "UPDATE", "DELETE"] as const;
export type SyncOperation = (typeof SYNC_OPERATIONS)[number];

export const authUserSyncLogs = pgTable(
  "auth_user_sync_logs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull(),
    operation: varchar("operation", { length: 10 }).notNull(),
    payload: text("payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_auth_sync_logs_user_id").on(table.userId),
    index("idx_auth_sync_logs_created_at").on(table.createdAt),
  ]
);

export const insertAuthUserSyncLogSchema = createInsertSchema(authUserSyncLogs)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    userId: z.string().uuid("Invalid user ID"),
    operation: z.enum(SYNC_OPERATIONS),
    payload: z.string().nullable().optional(),
  });

export type InsertAuthUserSyncLog = z.infer<typeof insertAuthUserSyncLogSchema>;
export type AuthUserSyncLog = typeof authUserSyncLogs.$inferSelect;

export const CONNECTOR_TYPES = ["crm", "finance", "academic"] as const;
export type ConnectorType = (typeof CONNECTOR_TYPES)[number];

export const SYNC_RUN_STATUSES = ["pending", "running", "success", "failed"] as const;
export type SyncRunStatus = (typeof SYNC_RUN_STATUSES)[number];

export const connectors = pgTable(
  "connectors",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    type: varchar("type", { length: 20 }).notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().default({}),
    scheduleCron: text("schedule_cron"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_connectors_owner_id").on(table.ownerId),
    index("idx_connectors_type").on(table.type),
  ]
);

export const connectorMappings = pgTable(
  "connector_mappings",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    connectorId: uuid("connector_id")
      .notNull()
      .references(() => connectors.id, { onDelete: "cascade" }),
    sourcePath: text("source_path").notNull(),
    targetField: text("target_field").notNull(),
    transform: jsonb("transform").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_connector_mappings_connector_id").on(table.connectorId),
  ]
);

export const rawIngestFiles = pgTable(
  "raw_ingest_files",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    connectorId: uuid("connector_id")
      .notNull()
      .references(() => connectors.id, { onDelete: "cascade" }),
    bucketPath: text("bucket_path").notNull(),
    fileName: text("file_name").notNull(),
    fileSize: bigint("file_size", { mode: "number" }),
    processed: boolean("processed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_raw_ingest_files_connector_id").on(table.connectorId),
    index("idx_raw_ingest_files_processed").on(table.processed),
  ]
);

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    connectorId: uuid("connector_id")
      .notNull()
      .references(() => connectors.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    recordsIn: integer("records_in").default(0),
    recordsOut: integer("records_out").default(0),
    error: jsonb("error").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_sync_runs_connector_id_started_at").on(
      table.connectorId,
      table.startedAt
    ),
    index("idx_sync_runs_status").on(table.status),
  ]
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sourceConnectorId: uuid("source_connector_id")
      .notNull()
      .references(() => connectors.id, { onDelete: "cascade" }),
    sourceId: text("source_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    schoolId: uuid("school_id").references(() => schools.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_leads_school_id").on(table.schoolId),
    index("idx_leads_created_at").on(table.createdAt),
    index("idx_leads_source_id").on(table.sourceId),
    index("idx_leads_source_connector_id").on(table.sourceConnectorId),
  ]
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sourceConnectorId: uuid("source_connector_id")
      .notNull()
      .references(() => connectors.id, { onDelete: "cascade" }),
    sourceId: text("source_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    schoolId: uuid("school_id").references(() => schools.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_payments_school_id").on(table.schoolId),
    index("idx_payments_created_at").on(table.createdAt),
    index("idx_payments_source_id").on(table.sourceId),
    index("idx_payments_source_connector_id").on(table.sourceConnectorId),
  ]
);

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sourceConnectorId: uuid("source_connector_id")
      .notNull()
      .references(() => connectors.id, { onDelete: "cascade" }),
    sourceId: text("source_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    schoolId: uuid("school_id").references(() => schools.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_enrollments_school_id").on(table.schoolId),
    index("idx_enrollments_created_at").on(table.createdAt),
    index("idx_enrollments_source_id").on(table.sourceId),
    index("idx_enrollments_source_connector_id").on(table.sourceConnectorId),
  ]
);

export const insertConnectorSchema = createInsertSchema(connectors)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1, "Connector name is required"),
    type: z.enum(CONNECTOR_TYPES),
    config: z.record(z.unknown()).optional(),
    scheduleCron: z.string().nullable().optional(),
    ownerId: z.string().uuid("Invalid owner ID"),
    isActive: z.boolean().optional(),
  });

export const insertConnectorMappingSchema = createInsertSchema(connectorMappings)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    connectorId: z.string().uuid("Invalid connector ID"),
    sourcePath: z.string().min(1, "Source path is required"),
    targetField: z.string().min(1, "Target field is required"),
    transform: z.record(z.unknown()).nullable().optional(),
  });

export const insertRawIngestFileSchema = createInsertSchema(rawIngestFiles)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    connectorId: z.string().uuid("Invalid connector ID"),
    bucketPath: z.string().min(1, "Bucket path is required"),
    fileName: z.string().min(1, "File name is required"),
    fileSize: z.number().int().nonnegative().nullable().optional(),
    processed: z.boolean().optional(),
  });

export const insertSyncRunSchema = createInsertSchema(syncRuns)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    connectorId: z.string().uuid("Invalid connector ID"),
    status: z.enum(SYNC_RUN_STATUSES).default("pending"),
    recordsIn: z.number().int().nonnegative().optional(),
    recordsOut: z.number().int().nonnegative().optional(),
    error: z.record(z.unknown()).nullable().optional(),
    startedAt: z.date().optional(),
    finishedAt: z.date().nullable().optional(),
  });

export const insertLeadSchema = createInsertSchema(leads)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    sourceConnectorId: z.string().uuid("Invalid connector ID"),
    sourceId: z.string().min(1, "Source ID is required"),
    payload: z.record(z.unknown()),
    schoolId: z.string().uuid("Invalid school ID").nullable().optional(),
  });

export const insertPaymentSchema = createInsertSchema(payments)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    sourceConnectorId: z.string().uuid("Invalid connector ID"),
    sourceId: z.string().min(1, "Source ID is required"),
    payload: z.record(z.unknown()),
    schoolId: z.string().uuid("Invalid school ID").nullable().optional(),
  });

export const insertEnrollmentSchema = createInsertSchema(enrollments)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    sourceConnectorId: z.string().uuid("Invalid connector ID"),
    sourceId: z.string().min(1, "Source ID is required"),
    payload: z.record(z.unknown()),
    schoolId: z.string().uuid("Invalid school ID").nullable().optional(),
  });

export type InsertConnector = z.infer<typeof insertConnectorSchema>;
export type Connector = typeof connectors.$inferSelect;

export type InsertConnectorMapping = z.infer<typeof insertConnectorMappingSchema>;
export type ConnectorMapping = typeof connectorMappings.$inferSelect;

export type InsertRawIngestFile = z.infer<typeof insertRawIngestFileSchema>;
export type RawIngestFile = typeof rawIngestFiles.$inferSelect;

export type InsertSyncRun = z.infer<typeof insertSyncRunSchema>;
export type SyncRun = typeof syncRuns.$inferSelect;

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

export type InsertEnrollment = z.infer<typeof insertEnrollmentSchema>;
export type Enrollment = typeof enrollments.$inferSelect;
