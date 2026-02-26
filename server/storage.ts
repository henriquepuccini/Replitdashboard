import {
  type User,
  type InsertUser,
  type School,
  type InsertSchool,
  type UserSchool,
  type InsertUserSchool,
  type AuthUserSyncLog,
  type InsertAuthUserSyncLog,
  type Connector,
  type InsertConnector,
  type ConnectorMapping,
  type InsertConnectorMapping,
  type RawIngestFile,
  type InsertRawIngestFile,
  type SyncRun,
  type InsertSyncRun,
  type Lead,
  type InsertLead,
  type Payment,
  type InsertPayment,
  type Enrollment,
  type InsertEnrollment,
  type KpiDefinition,
  type InsertKpiDefinition,
  type KpiCalcRun,
  type InsertKpiCalcRun,
  type KpiValue,
  type InsertKpiValue,
  type KpiGoal,
  type InsertKpiGoal,
  type CalculationAudit,
  type InsertCalculationAudit,
  type ConnectorMetric,
  type ConnectorSla,
  type InsertConnectorSla,
  type IntegrationAlert,
  type InsertIntegrationAlert,
  type AlertNotification,
  users,
  schools,
  userSchools,
  authUserSyncLogs,
  connectors,
  connectorMappings,
  rawIngestFiles,
  syncRuns,
  leads,
  payments,
  enrollments,
  kpiDefinitions,
  kpiCalcRuns,
  kpiValues,
  kpiGoals,
  calculationAudit,
  connectorMetrics,
  connectorSlas,
  integrationAlerts,
  alertNotifications,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, isNull } from "drizzle-orm";

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

  getConnector(id: string): Promise<Connector | undefined>;
  getConnectors(): Promise<Connector[]>;
  getConnectorsByOwnerId(ownerId: string): Promise<Connector[]>;
  createConnector(connector: InsertConnector): Promise<Connector>;
  updateConnector(id: string, data: Partial<InsertConnector>): Promise<Connector | undefined>;
  deleteConnector(id: string): Promise<boolean>;

  getConnectorMapping(id: string): Promise<ConnectorMapping | undefined>;
  getConnectorMappings(connectorId: string): Promise<ConnectorMapping[]>;
  createConnectorMapping(mapping: InsertConnectorMapping): Promise<ConnectorMapping>;
  updateConnectorMapping(id: string, data: Partial<InsertConnectorMapping>): Promise<ConnectorMapping | undefined>;
  deleteConnectorMapping(id: string): Promise<boolean>;

  getRawIngestFiles(connectorId: string): Promise<RawIngestFile[]>;
  createRawIngestFile(file: InsertRawIngestFile): Promise<RawIngestFile>;
  markFileProcessed(id: string): Promise<RawIngestFile | undefined>;

  getSyncRun(id: string): Promise<SyncRun | undefined>;
  getSyncRuns(connectorId: string, limit?: number): Promise<SyncRun[]>;
  getSyncRunsByConnectorId(connectorId: string, limit?: number): Promise<SyncRun[]>;
  createSyncRun(run: InsertSyncRun): Promise<SyncRun>;
  updateSyncRun(id: string, data: Partial<InsertSyncRun>): Promise<SyncRun | undefined>;

  getLeads(): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  getLeadsBySchoolId(schoolId: string): Promise<Lead[]>;
  getLeadsBySellerId(sellerId: string): Promise<Lead[]>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, data: Partial<InsertLead>): Promise<Lead | undefined>;
  upsertLead(lead: InsertLead): Promise<Lead>;

  getPayments(): Promise<Payment[]>;
  getPaymentsBySchoolId(schoolId: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  upsertPayment(payment: InsertPayment): Promise<Payment>;

  getEnrollments(): Promise<Enrollment[]>;
  getEnrollmentsBySchoolId(schoolId: string): Promise<Enrollment[]>;
  createEnrollment(enrollment: InsertEnrollment): Promise<Enrollment>;
  upsertEnrollment(enrollment: InsertEnrollment): Promise<Enrollment>;

  getKpiDefinition(id: string): Promise<KpiDefinition | undefined>;
  getKpiDefinitionByKey(key: string): Promise<KpiDefinition | undefined>;
  getKpiDefinitions(activeOnly?: boolean): Promise<KpiDefinition[]>;
  createKpiDefinition(def: InsertKpiDefinition): Promise<KpiDefinition>;
  updateKpiDefinition(id: string, data: Partial<InsertKpiDefinition>): Promise<KpiDefinition | undefined>;

  getKpiCalcRun(id: string): Promise<KpiCalcRun | undefined>;
  getKpiCalcRunsByKpiId(kpiId: string, limit?: number): Promise<KpiCalcRun[]>;
  createKpiCalcRun(run: InsertKpiCalcRun): Promise<KpiCalcRun>;
  updateKpiCalcRun(id: string, data: Partial<InsertKpiCalcRun>): Promise<KpiCalcRun | undefined>;

  getKpiValues(kpiId: string, schoolId?: string | null, limit?: number): Promise<KpiValue[]>;
  createKpiValue(value: InsertKpiValue): Promise<KpiValue>;

  getKpiGoals(kpiId: string, schoolId?: string | null): Promise<KpiGoal[]>;
  createKpiGoal(goal: InsertKpiGoal): Promise<KpiGoal>;
  updateKpiGoal(id: string, data: Partial<InsertKpiGoal>): Promise<KpiGoal | undefined>;
  deleteKpiGoal(id: string): Promise<boolean>;

  createCalculationAudit(audit: InsertCalculationAudit): Promise<CalculationAudit>;
  getCalculationAuditByRunId(calcRunId: string): Promise<CalculationAudit[]>;

  getConnectorMetrics(connectorId: string, limit?: number): Promise<ConnectorMetric[]>;
  getConnectorSlas(): Promise<ConnectorSla[]>;
  getConnectorSla(connectorId: string): Promise<ConnectorSla | undefined>;
  upsertConnectorSla(data: InsertConnectorSla): Promise<ConnectorSla>;
  getIntegrationAlerts(limit?: number): Promise<IntegrationAlert[]>;
  updateIntegrationAlert(id: string, data: Partial<InsertIntegrationAlert>): Promise<IntegrationAlert | undefined>;
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

  async getConnector(id: string): Promise<Connector | undefined> {
    const [connector] = await db.select().from(connectors).where(eq(connectors.id, id));
    return connector;
  }

  async getConnectors(): Promise<Connector[]> {
    return db.select().from(connectors);
  }

  async getConnectorsByOwnerId(ownerId: string): Promise<Connector[]> {
    return db.select().from(connectors).where(eq(connectors.ownerId, ownerId));
  }

  async createConnector(connector: InsertConnector): Promise<Connector> {
    const [created] = await db.insert(connectors).values(connector).returning();
    return created;
  }

  async updateConnector(id: string, data: Partial<InsertConnector>): Promise<Connector | undefined> {
    const [updated] = await db
      .update(connectors)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(connectors.id, id))
      .returning();
    return updated;
  }

  async deleteConnector(id: string): Promise<boolean> {
    const result = await db.delete(connectors).where(eq(connectors.id, id)).returning();
    return result.length > 0;
  }

  async getConnectorMapping(id: string): Promise<ConnectorMapping | undefined> {
    const [mapping] = await db.select().from(connectorMappings).where(eq(connectorMappings.id, id));
    return mapping;
  }

  async getConnectorMappings(connectorId: string): Promise<ConnectorMapping[]> {
    return db.select().from(connectorMappings).where(eq(connectorMappings.connectorId, connectorId));
  }

  async createConnectorMapping(mapping: InsertConnectorMapping): Promise<ConnectorMapping> {
    const [created] = await db.insert(connectorMappings).values(mapping).returning();
    return created;
  }

  async updateConnectorMapping(id: string, data: Partial<InsertConnectorMapping>): Promise<ConnectorMapping | undefined> {
    const [updated] = await db
      .update(connectorMappings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(connectorMappings.id, id))
      .returning();
    return updated;
  }

  async deleteConnectorMapping(id: string): Promise<boolean> {
    const result = await db.delete(connectorMappings).where(eq(connectorMappings.id, id)).returning();
    return result.length > 0;
  }

  async getRawIngestFiles(connectorId: string): Promise<RawIngestFile[]> {
    return db.select().from(rawIngestFiles).where(eq(rawIngestFiles.connectorId, connectorId));
  }

  async createRawIngestFile(file: InsertRawIngestFile): Promise<RawIngestFile> {
    const [created] = await db.insert(rawIngestFiles).values(file).returning();
    return created;
  }

  async markFileProcessed(id: string): Promise<RawIngestFile | undefined> {
    const [updated] = await db
      .update(rawIngestFiles)
      .set({ processed: true })
      .where(eq(rawIngestFiles.id, id))
      .returning();
    return updated;
  }

  async getSyncRun(id: string): Promise<SyncRun | undefined> {
    const [run] = await db.select().from(syncRuns).where(eq(syncRuns.id, id));
    return run;
  }

  async getSyncRuns(connectorId: string, limit: number = 50): Promise<SyncRun[]> {
    return this.getSyncRunsByConnectorId(connectorId, limit);
  }

  async getSyncRunsByConnectorId(connectorId: string, limit: number = 50): Promise<SyncRun[]> {
    return db
      .select()
      .from(syncRuns)
      .where(eq(syncRuns.connectorId, connectorId))
      .orderBy(desc(syncRuns.startedAt))
      .limit(limit);
  }

  async createSyncRun(run: InsertSyncRun): Promise<SyncRun> {
    const [created] = await db.insert(syncRuns).values(run).returning();
    return created;
  }

  async updateSyncRun(id: string, data: Partial<InsertSyncRun>): Promise<SyncRun | undefined> {
    const [updated] = await db
      .update(syncRuns)
      .set(data)
      .where(eq(syncRuns.id, id))
      .returning();
    return updated;
  }

  async getLeads(): Promise<Lead[]> {
    return db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async getLeadsBySchoolId(schoolId: string): Promise<Lead[]> {
    return db.select().from(leads).where(eq(leads.schoolId, schoolId)).orderBy(desc(leads.createdAt));
  }

  async getLeadsBySellerId(sellerId: string): Promise<Lead[]> {
    return db.select().from(leads).where(eq(leads.sellerId, sellerId)).orderBy(desc(leads.createdAt));
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [created] = await db.insert(leads).values(lead).returning();
    return created;
  }

  async updateLead(id: string, data: Partial<InsertLead>): Promise<Lead | undefined> {
    const [updated] = await db
      .update(leads)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return updated;
  }

  async upsertLead(lead: InsertLead): Promise<Lead> {
    const [upserted] = await db
      .insert(leads)
      .values(lead)
      .onConflictDoUpdate({
        target: [leads.sourceConnectorId, leads.sourceId],
        set: {
          payload: lead.payload,
          schoolId: lead.schoolId,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upserted;
  }

  async getPayments(): Promise<Payment[]> {
    return db.select().from(payments);
  }

  async getPaymentsBySchoolId(schoolId: string): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.schoolId, schoolId));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [created] = await db.insert(payments).values(payment).returning();
    return created;
  }

  async upsertPayment(payment: InsertPayment): Promise<Payment> {
    const [upserted] = await db
      .insert(payments)
      .values(payment)
      .onConflictDoUpdate({
        target: [payments.sourceConnectorId, payments.sourceId],
        set: {
          payload: payment.payload,
          schoolId: payment.schoolId,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upserted;
  }

  async getEnrollments(): Promise<Enrollment[]> {
    return db.select().from(enrollments);
  }

  async getEnrollmentsBySchoolId(schoolId: string): Promise<Enrollment[]> {
    return db.select().from(enrollments).where(eq(enrollments.schoolId, schoolId));
  }

  async createEnrollment(enrollment: InsertEnrollment): Promise<Enrollment> {
    const [created] = await db.insert(enrollments).values(enrollment).returning();
    return created;
  }

  async upsertEnrollment(enrollment: InsertEnrollment): Promise<Enrollment> {
    const [upserted] = await db
      .insert(enrollments)
      .values(enrollment)
      .onConflictDoUpdate({
        target: [enrollments.sourceConnectorId, enrollments.sourceId],
        set: {
          payload: enrollment.payload,
          schoolId: enrollment.schoolId,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upserted;
  }
  async getKpiDefinition(id: string): Promise<KpiDefinition | undefined> {
    const [def] = await db.select().from(kpiDefinitions).where(eq(kpiDefinitions.id, id));
    return def;
  }

  async getKpiDefinitionByKey(key: string): Promise<KpiDefinition | undefined> {
    const [def] = await db.select().from(kpiDefinitions).where(eq(kpiDefinitions.key, key));
    return def;
  }

  async getKpiDefinitions(activeOnly: boolean = false): Promise<KpiDefinition[]> {
    if (activeOnly) {
      return db.select().from(kpiDefinitions).where(eq(kpiDefinitions.isActive, true));
    }
    return db.select().from(kpiDefinitions);
  }

  async createKpiDefinition(def: InsertKpiDefinition): Promise<KpiDefinition> {
    const [created] = await db.insert(kpiDefinitions).values(def).returning();
    return created;
  }

  async updateKpiDefinition(id: string, data: Partial<InsertKpiDefinition>): Promise<KpiDefinition | undefined> {
    const [updated] = await db
      .update(kpiDefinitions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(kpiDefinitions.id, id))
      .returning();
    return updated;
  }

  async getKpiCalcRun(id: string): Promise<KpiCalcRun | undefined> {
    const [run] = await db.select().from(kpiCalcRuns).where(eq(kpiCalcRuns.id, id));
    return run;
  }

  async getKpiCalcRunsByKpiId(kpiId: string, limit: number = 50): Promise<KpiCalcRun[]> {
    return db
      .select()
      .from(kpiCalcRuns)
      .where(eq(kpiCalcRuns.kpiId, kpiId))
      .orderBy(desc(kpiCalcRuns.startedAt))
      .limit(limit);
  }

  async createKpiCalcRun(run: InsertKpiCalcRun): Promise<KpiCalcRun> {
    const [created] = await db.insert(kpiCalcRuns).values(run).returning();
    return created;
  }

  async updateKpiCalcRun(id: string, data: Partial<InsertKpiCalcRun>): Promise<KpiCalcRun | undefined> {
    const [updated] = await db
      .update(kpiCalcRuns)
      .set(data)
      .where(eq(kpiCalcRuns.id, id))
      .returning();
    return updated;
  }

  async getKpiValues(kpiId: string, schoolId?: string | null, limit: number = 100): Promise<KpiValue[]> {
    const conditions = [eq(kpiValues.kpiId, kpiId)];
    if (schoolId === null) {
      conditions.push(isNull(kpiValues.schoolId));
    } else if (schoolId) {
      conditions.push(eq(kpiValues.schoolId, schoolId));
    }
    return db
      .select()
      .from(kpiValues)
      .where(and(...conditions))
      .orderBy(desc(kpiValues.periodStart))
      .limit(limit);
  }

  async createKpiValue(value: InsertKpiValue): Promise<KpiValue> {
    const [created] = await db.insert(kpiValues).values(value).returning();
    return created;
  }

  async getKpiGoals(kpiId: string, schoolId?: string | null): Promise<KpiGoal[]> {
    const conditions = [eq(kpiGoals.kpiId, kpiId)];
    if (schoolId === null) {
      conditions.push(isNull(kpiGoals.schoolId));
    } else if (schoolId) {
      conditions.push(eq(kpiGoals.schoolId, schoolId));
    }
    return db
      .select()
      .from(kpiGoals)
      .where(and(...conditions))
      .orderBy(desc(kpiGoals.periodStart));
  }

  async createKpiGoal(goal: InsertKpiGoal): Promise<KpiGoal> {
    const [created] = await db.insert(kpiGoals).values(goal).returning();
    return created;
  }

  async updateKpiGoal(id: string, data: Partial<InsertKpiGoal>): Promise<KpiGoal | undefined> {
    const [updated] = await db
      .update(kpiGoals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(kpiGoals.id, id))
      .returning();
    return updated;
  }

  async deleteKpiGoal(id: string): Promise<boolean> {
    const result = await db.delete(kpiGoals).where(eq(kpiGoals.id, id)).returning();
    return result.length > 0;
  }

  async createCalculationAudit(audit: InsertCalculationAudit): Promise<CalculationAudit> {
    const [created] = await db.insert(calculationAudit).values(audit).returning();
    return created;
  }

  async getCalculationAuditByRunId(calcRunId: string): Promise<CalculationAudit[]> {
    return db
      .select()
      .from(calculationAudit)
      .where(eq(calculationAudit.calcRunId, calcRunId))
      .orderBy(desc(calculationAudit.createdAt));
  }

  async getConnectorMetrics(connectorId: string, limit: number = 100): Promise<ConnectorMetric[]> {
    return db
      .select()
      .from(connectorMetrics)
      .where(eq(connectorMetrics.connectorId, connectorId))
      .orderBy(desc(connectorMetrics.createdAt))
      .limit(limit);
  }

  async getConnectorSlas(): Promise<ConnectorSla[]> {
    return db.select().from(connectorSlas);
  }

  async getConnectorSla(connectorId: string): Promise<ConnectorSla | undefined> {
    const [sla] = await db.select().from(connectorSlas).where(eq(connectorSlas.connectorId, connectorId));
    return sla;
  }

  async upsertConnectorSla(data: InsertConnectorSla): Promise<ConnectorSla> {
    const [upserted] = await db
      .insert(connectorSlas)
      .values(data)
      .onConflictDoUpdate({
        target: connectorSlas.connectorId,
        set: {
          maxLatencyMs: data.maxLatencyMs,
          successRateThreshold: data.successRateThreshold,
          escalationEmails: data.escalationEmails,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upserted;
  }

  async getIntegrationAlerts(limit: number = 200): Promise<IntegrationAlert[]> {
    return db
      .select()
      .from(integrationAlerts)
      .orderBy(desc(integrationAlerts.createdAt))
      .limit(limit);
  }

  async updateIntegrationAlert(id: string, data: Partial<InsertIntegrationAlert>): Promise<IntegrationAlert | undefined> {
    const [updated] = await db
      .update(integrationAlerts)
      .set({
        ...data,
        ...(data.status === 'resolved' ? { resolvedAt: new Date() } : {})
      })
      .where(eq(integrationAlerts.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
