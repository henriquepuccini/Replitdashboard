CREATE TABLE "alert_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_user_sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"operation" varchar(10) NOT NULL,
	"payload" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calculation_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calc_run_id" uuid NOT NULL,
	"input_snapshot" jsonb,
	"result_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "churn_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" varchar(20) NOT NULL,
	"source_id" text NOT NULL,
	"school_id" uuid NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"churn_flag" boolean DEFAULT true NOT NULL,
	"churn_reason" text,
	"detected_by" varchar(20) DEFAULT 'engine' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "churn_motives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(40) NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"is_critical" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 99 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "churn_motives_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "churn_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid,
	"name" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "churn_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"processed_records" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connector_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connector_id" uuid NOT NULL,
	"source_path" text NOT NULL,
	"target_field" text NOT NULL,
	"transform" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connector_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connector_id" uuid NOT NULL,
	"run_id" text NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"records_in" integer DEFAULT 0 NOT NULL,
	"records_out" integer DEFAULT 0 NOT NULL,
	"error" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connector_slas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connector_id" uuid NOT NULL,
	"max_latency_ms" integer DEFAULT 5000 NOT NULL,
	"success_rate_threshold" numeric(5, 2) DEFAULT '95.00' NOT NULL,
	"escalation_emails" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connector_slas_connector_id_unique" UNIQUE("connector_id")
);
--> statement-breakpoint
CREATE TABLE "connectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" varchar(20) NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"schedule_cron" text,
	"owner_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contas_a_receber" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_connector_id" uuid NOT NULL,
	"source_id" text NOT NULL,
	"school_id" uuid,
	"amount_due" numeric(18, 4) DEFAULT '0' NOT NULL,
	"due_date" date,
	"status" varchar(10) DEFAULT 'open' NOT NULL,
	"paid_at" timestamp with time zone,
	"installment_number" integer,
	"total_installments" integer,
	"original_due_date" date,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_connector_id" uuid NOT NULL,
	"source_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"school_id" uuid,
	"enrollment_status" varchar(20) DEFAULT 'active' NOT NULL,
	"churn_motive_id" uuid,
	"churn_notes" text,
	"cancelled_at" timestamp with time zone,
	"ltv_lost" numeric(18, 4) DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connector_id" uuid,
	"alert_type" text NOT NULL,
	"severity" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "kpi_calc_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kpi_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"inputs" jsonb,
	"version" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpi_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"calc_type" varchar(20) NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kpi_definitions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "kpi_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kpi_id" uuid NOT NULL,
	"school_id" uuid,
	"user_id" uuid,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"target" numeric(18, 4) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpi_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kpi_id" uuid NOT NULL,
	"school_id" uuid,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"value" numeric(18, 4) NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"calc_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_connector_id" uuid NOT NULL,
	"source_id" text NOT NULL,
	"seller_id" uuid,
	"school_id" uuid,
	"stage" varchar(50) DEFAULT 'new' NOT NULL,
	"status" varchar(50) DEFAULT 'open' NOT NULL,
	"last_interaction" timestamp with time zone,
	"payload" jsonb NOT NULL,
	"lead_source" varchar(80),
	"lead_source_detail" text,
	"converted_at" timestamp with time zone,
	"converted_enrollment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"changed_by" uuid,
	"change_type" varchar(10) NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"changed_fields" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_inputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid,
	"data_referencia" date NOT NULL,
	"chave_metrica" text NOT NULL,
	"valor" numeric(18, 4) NOT NULL,
	"notas" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nps_surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid,
	"school_id" uuid,
	"score" integer NOT NULL,
	"comment" text,
	"survey_date" date NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_connector_id" uuid NOT NULL,
	"source_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"school_id" uuid,
	"gross_value" numeric(18, 4) DEFAULT '0' NOT NULL,
	"scholarship_discount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"commercial_discount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"net_value" numeric(18, 4) DEFAULT '0' NOT NULL,
	"due_date" date,
	"installment_number" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_ingest_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connector_id" uuid NOT NULL,
	"bucket_path" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" bigint,
	"processed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_download_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"export_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"downloaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheduled_report_id" uuid,
	"initiated_by" uuid NOT NULL,
	"format" varchar(10) NOT NULL,
	"file_path" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"error" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"school_id" uuid,
	"filters" jsonb DEFAULT '{}'::jsonb,
	"format" varchar(10) DEFAULT 'csv' NOT NULL,
	"schedule_cron" text,
	"recipients" jsonb DEFAULT '[]'::jsonb,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_capacity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"turma" varchar(80),
	"legal_capacity" integer,
	"operational_capacity" integer,
	"effective_from" date DEFAULT now() NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" varchar(20) NOT NULL,
	"timezone" varchar(50) DEFAULT 'America/Sao_Paulo',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schools_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "student_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_connector_id" uuid NOT NULL,
	"source_id" text NOT NULL,
	"school_id" uuid,
	"enrollment_id" uuid,
	"student_name" text,
	"period_start" date,
	"period_end" date,
	"base_value" numeric(18, 4) DEFAULT '0' NOT NULL,
	"scholarship_discount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"commercial_discount" numeric(18, 4) DEFAULT '0' NOT NULL,
	"final_value" numeric(18, 4),
	"installments" integer DEFAULT 1 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connector_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"records_in" integer DEFAULT 0,
	"records_out" integer DEFAULT 0,
	"error" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'seller' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"preferred_language" varchar(8) DEFAULT 'pt-BR',
	"role" varchar(20) DEFAULT 'seller' NOT NULL,
	"school_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "alert_notifications" ADD CONSTRAINT "alert_notifications_alert_id_integration_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."integration_alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_audit" ADD CONSTRAINT "calculation_audit_calc_run_id_kpi_calc_runs_id_fk" FOREIGN KEY ("calc_run_id") REFERENCES "public"."kpi_calc_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "churn_events" ADD CONSTRAINT "churn_events_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "churn_rules" ADD CONSTRAINT "churn_rules_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "churn_rules" ADD CONSTRAINT "churn_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "churn_runs" ADD CONSTRAINT "churn_runs_rule_id_churn_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."churn_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_mappings" ADD CONSTRAINT "connector_mappings_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_metrics" ADD CONSTRAINT "connector_metrics_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_slas" ADD CONSTRAINT "connector_slas_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contas_a_receber" ADD CONSTRAINT "contas_a_receber_source_connector_id_connectors_id_fk" FOREIGN KEY ("source_connector_id") REFERENCES "public"."connectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contas_a_receber" ADD CONSTRAINT "contas_a_receber_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_source_connector_id_connectors_id_fk" FOREIGN KEY ("source_connector_id") REFERENCES "public"."connectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_churn_motive_id_churn_motives_id_fk" FOREIGN KEY ("churn_motive_id") REFERENCES "public"."churn_motives"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_alerts" ADD CONSTRAINT "integration_alerts_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_alerts" ADD CONSTRAINT "integration_alerts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_calc_runs" ADD CONSTRAINT "kpi_calc_runs_kpi_id_kpi_definitions_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "public"."kpi_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_calc_runs" ADD CONSTRAINT "kpi_calc_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_definitions" ADD CONSTRAINT "kpi_definitions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_goals" ADD CONSTRAINT "kpi_goals_kpi_id_kpi_definitions_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "public"."kpi_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_goals" ADD CONSTRAINT "kpi_goals_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_goals" ADD CONSTRAINT "kpi_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_goals" ADD CONSTRAINT "kpi_goals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_values" ADD CONSTRAINT "kpi_values_kpi_id_kpi_definitions_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "public"."kpi_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_values" ADD CONSTRAINT "kpi_values_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_values" ADD CONSTRAINT "kpi_values_calc_run_id_kpi_calc_runs_id_fk" FOREIGN KEY ("calc_run_id") REFERENCES "public"."kpi_calc_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_source_connector_id_connectors_id_fk" FOREIGN KEY ("source_connector_id") REFERENCES "public"."connectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_enrollment_id_enrollments_id_fk" FOREIGN KEY ("converted_enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads_history" ADD CONSTRAINT "leads_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_inputs" ADD CONSTRAINT "manual_inputs_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_inputs" ADD CONSTRAINT "manual_inputs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nps_surveys" ADD CONSTRAINT "nps_surveys_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nps_surveys" ADD CONSTRAINT "nps_surveys_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nps_surveys" ADD CONSTRAINT "nps_surveys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_source_connector_id_connectors_id_fk" FOREIGN KEY ("source_connector_id") REFERENCES "public"."connectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_ingest_files" ADD CONSTRAINT "raw_ingest_files_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_download_audit" ADD CONSTRAINT "report_download_audit_export_id_report_exports_id_fk" FOREIGN KEY ("export_id") REFERENCES "public"."report_exports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_download_audit" ADD CONSTRAINT "report_download_audit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_scheduled_report_id_scheduled_reports_id_fk" FOREIGN KEY ("scheduled_report_id") REFERENCES "public"."scheduled_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_capacity" ADD CONSTRAINT "school_capacity_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_capacity" ADD CONSTRAINT "school_capacity_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_contracts" ADD CONSTRAINT "student_contracts_source_connector_id_connectors_id_fk" FOREIGN KEY ("source_connector_id") REFERENCES "public"."connectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_contracts" ADD CONSTRAINT "student_contracts_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_contracts" ADD CONSTRAINT "student_contracts_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_connector_id_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_schools" ADD CONSTRAINT "user_schools_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_schools" ADD CONSTRAINT "user_schools_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_auth_sync_logs_user_id" ON "auth_user_sync_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_auth_sync_logs_created_at" ON "auth_user_sync_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_calculation_audit_calc_run_id" ON "calculation_audit" USING btree ("calc_run_id");--> statement-breakpoint
CREATE INDEX "idx_churn_events_school_detected" ON "churn_events" USING btree ("school_id","detected_at");--> statement-breakpoint
CREATE INDEX "idx_churn_motives_code" ON "churn_motives" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_churn_rules_school" ON "churn_rules" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "idx_churn_runs_rule" ON "churn_runs" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "idx_connector_mappings_connector_id" ON "connector_mappings" USING btree ("connector_id");--> statement-breakpoint
CREATE INDEX "idx_connector_metrics_connector_time" ON "connector_metrics" USING btree ("connector_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_connectors_owner_id" ON "connectors" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_connectors_type" ON "connectors" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_car_school_status" ON "contas_a_receber" USING btree ("school_id","status");--> statement-breakpoint
CREATE INDEX "idx_car_due_date" ON "contas_a_receber" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_car_source_id" ON "contas_a_receber" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_car_source_connector_id" ON "contas_a_receber" USING btree ("source_connector_id");--> statement-breakpoint
CREATE INDEX "idx_enrollments_school_id" ON "enrollments" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "idx_enrollments_created_at" ON "enrollments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_enrollments_source_id" ON "enrollments" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_enrollments_source_connector_id" ON "enrollments" USING btree ("source_connector_id");--> statement-breakpoint
CREATE INDEX "idx_enrollments_status" ON "enrollments" USING btree ("enrollment_status");--> statement-breakpoint
CREATE INDEX "idx_enrollments_churn_motive" ON "enrollments" USING btree ("churn_motive_id");--> statement-breakpoint
CREATE INDEX "idx_integration_alerts_status_time" ON "integration_alerts" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_kpi_calc_runs_kpi_id" ON "kpi_calc_runs" USING btree ("kpi_id");--> statement-breakpoint
CREATE INDEX "idx_kpi_calc_runs_status" ON "kpi_calc_runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_kpi_definitions_key" ON "kpi_definitions" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_kpi_definitions_calc_type" ON "kpi_definitions" USING btree ("calc_type");--> statement-breakpoint
CREATE INDEX "idx_kpi_goals_school_kpi_period" ON "kpi_goals" USING btree ("school_id","kpi_id","period_start");--> statement-breakpoint
CREATE INDEX "idx_kpi_goals_kpi_id" ON "kpi_goals" USING btree ("kpi_id");--> statement-breakpoint
CREATE INDEX "idx_kpi_goals_user_id" ON "kpi_goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_kpi_values_kpi_school_period" ON "kpi_values" USING btree ("kpi_id","school_id","period_start" DESC);--> statement-breakpoint
CREATE INDEX "idx_kpi_values_calc_run_id" ON "kpi_values" USING btree ("calc_run_id");--> statement-breakpoint
CREATE INDEX "idx_leads_school_id" ON "leads" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "idx_leads_created_at" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_leads_source_id" ON "leads" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_leads_source_connector_id" ON "leads" USING btree ("source_connector_id");--> statement-breakpoint
CREATE INDEX "idx_leads_seller_school_stage" ON "leads" USING btree ("seller_id","school_id","stage");--> statement-breakpoint
CREATE INDEX "idx_leads_school_created_desc" ON "leads" USING btree ("school_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_leads_stage_last_interaction" ON "leads" USING btree ("stage","last_interaction");--> statement-breakpoint
CREATE INDEX "idx_leads_seller_id" ON "leads" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_leads_history_lead_id" ON "leads_history" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_leads_history_changed_by" ON "leads_history" USING btree ("changed_by");--> statement-breakpoint
CREATE INDEX "idx_leads_history_created_at" ON "leads_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_leads_history_change_type" ON "leads_history" USING btree ("change_type");--> statement-breakpoint
CREATE INDEX "idx_manual_inputs_school_date" ON "manual_inputs" USING btree ("school_id","data_referencia");--> statement-breakpoint
CREATE INDEX "idx_manual_inputs_chave" ON "manual_inputs" USING btree ("chave_metrica");--> statement-breakpoint
CREATE INDEX "idx_manual_inputs_created_by" ON "manual_inputs" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_nps_school_date" ON "nps_surveys" USING btree ("school_id","survey_date");--> statement-breakpoint
CREATE INDEX "idx_nps_enrollment" ON "nps_surveys" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "idx_payments_school_id" ON "payments" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "idx_payments_created_at" ON "payments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_payments_source_id" ON "payments" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_payments_source_connector_id" ON "payments" USING btree ("source_connector_id");--> statement-breakpoint
CREATE INDEX "idx_payments_due_date" ON "payments" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_raw_ingest_files_connector_id" ON "raw_ingest_files" USING btree ("connector_id");--> statement-breakpoint
CREATE INDEX "idx_raw_ingest_files_processed" ON "raw_ingest_files" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "idx_report_download_audit_export" ON "report_download_audit" USING btree ("export_id");--> statement-breakpoint
CREATE INDEX "idx_report_download_audit_user" ON "report_download_audit" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_report_exports_status" ON "report_exports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_scheduled_reports_owner" ON "scheduled_reports" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_reports_next_run" ON "scheduled_reports" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "idx_school_capacity_school_id" ON "school_capacity" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "idx_school_capacity_effective_from" ON "school_capacity" USING btree ("effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_school_capacity_school_turma_date" ON "school_capacity" USING btree ("school_id","turma","effective_from");--> statement-breakpoint
CREATE INDEX "idx_schools_code" ON "schools" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_student_contracts_school_period" ON "student_contracts" USING btree ("school_id","period_start" DESC);--> statement-breakpoint
CREATE INDEX "idx_student_contracts_enrollment" ON "student_contracts" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "idx_student_contracts_source_connector" ON "student_contracts" USING btree ("source_connector_id");--> statement-breakpoint
CREATE INDEX "idx_sync_runs_connector_id_started_at" ON "sync_runs" USING btree ("connector_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_sync_runs_status" ON "sync_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_user_schools_user_id_school_id" ON "user_schools" USING btree ("user_id","school_id");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role");