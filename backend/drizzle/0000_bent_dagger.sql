CREATE TYPE "public"."approval_decision" AS ENUM('pending', 'approve', 'reject');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('issued', 'in-use', 'completed', 'returned');--> statement-breakpoint
CREATE TYPE "public"."deployment_action" AS ENUM('publish', 'rollback');--> statement-breakpoint
CREATE TYPE "public"."excel_job_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."excel_job_type" AS ENUM('import', 'export');--> statement-breakpoint
CREATE TYPE "public"."module_key" AS ENUM('auth_rbac', 'user_mgmt', 'inventory', 'dashboard_shell', 'request', 'approval', 'material_assignment', 'assignment_frontend', 'consumption', 'returns', 'pcb_repair', 'analytics', 'reports_excel');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('Low', 'Normal', 'High');--> statement-breakpoint
CREATE TYPE "public"."repair_stage" AS ENUM('diagnosis', 'repairing', 'testing', 'completed');--> statement-breakpoint
CREATE TYPE "public"."repair_status" AS ENUM('open', 'in-progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending', 'approved', 'rejected', 'assigned', 'in-repair', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."return_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."return_type" AS ENUM('material', 'repair');--> statement-breakpoint
CREATE TYPE "public"."site_role" AS ENUM('Member', 'Manager', 'Admin');--> statement-breakpoint
CREATE TYPE "public"."site_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('receipt', 'issue', 'adjustment', 'return', 'transfer_in', 'transfer_out');--> statement-breakpoint
CREATE TABLE "site_members" (
	"site_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "site_role" DEFAULT 'Member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_members_pk" PRIMARY KEY("site_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" text NOT NULL,
	"is_hub_admin" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(180) NOT NULL,
	"description" text,
	"theme" jsonb DEFAULT '{"primaryColor":"#2563eb","backgroundColor":"#f8fafc","sidebarColor":"#0f172a","textColor":"#1e293b","fontFamily":"Inter","borderRadius":"8px"}'::jsonb NOT NULL,
	"status" "site_status" DEFAULT 'active' NOT NULL,
	"live_version_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sites_slug_uq" UNIQUE("slug"),
	CONSTRAINT "sites_theme_object_ck" CHECK (jsonb_typeof("sites"."theme") = 'object')
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" "module_key" NOT NULL,
	"name" varchar(180) NOT NULL,
	"description" text,
	"category" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "modules_key_uq" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "site_modules" (
	"site_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_modules_pk" PRIMARY KEY("site_id","module_id"),
	CONSTRAINT "site_modules_config_object_ck" CHECK (jsonb_typeof("site_modules"."config") = 'object')
);
--> statement-breakpoint
CREATE TABLE "site_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"config" jsonb NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_versions_site_version_uq" UNIQUE("site_id","version"),
	CONSTRAINT "site_versions_site_id_uq" UNIQUE("site_id","id"),
	CONSTRAINT "site_versions_version_positive_ck" CHECK ("site_versions"."version" > 0),
	CONSTRAINT "site_versions_config_object_ck" CHECK (jsonb_typeof("site_versions"."config") = 'object')
);
--> statement-breakpoint
CREATE TABLE "deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"action" "deployment_action" NOT NULL,
	"deployed_by" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deployments_site_id_uq" UNIQUE("site_id","id")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_site_id_uq" UNIQUE("site_id","id"),
	CONSTRAINT "categories_site_name_uq" UNIQUE("site_id","name")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"sku" varchar(120) NOT NULL,
	"name" varchar(240) NOT NULL,
	"description" text,
	"category_id" uuid,
	"unit" varchar(40) DEFAULT 'each' NOT NULL,
	"quantity_on_hand" numeric(14, 3) DEFAULT '0' NOT NULL,
	"reorder_level" numeric(14, 3) DEFAULT '0' NOT NULL,
	"unit_price" numeric(14, 2) DEFAULT '0' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_site_id_uq" UNIQUE("site_id","id"),
	CONSTRAINT "items_site_sku_uq" UNIQUE("site_id","sku"),
	CONSTRAINT "items_quantity_nonnegative_ck" CHECK ("items"."quantity_on_hand" >= 0),
	CONSTRAINT "items_reorder_nonnegative_ck" CHECK ("items"."reorder_level" >= 0),
	CONSTRAINT "items_unit_price_nonnegative_ck" CHECK ("items"."unit_price" >= 0),
	CONSTRAINT "items_metadata_object_ck" CHECK (jsonb_typeof("items"."metadata") = 'object')
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"movement_type" "stock_movement_type" NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"balance_after" numeric(14, 3),
	"reference_type" varchar(80),
	"reference_id" uuid,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_site_id_uq" UNIQUE("site_id","id"),
	CONSTRAINT "stock_movements_quantity_positive_ck" CHECK ("stock_movements"."quantity" > 0),
	CONSTRAINT "stock_movements_balance_nonnegative_ck" CHECK ("stock_movements"."balance_after" IS NULL OR "stock_movements"."balance_after" >= 0)
);
--> statement-breakpoint
CREATE TABLE "request_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"item_id" uuid,
	"description" varchar(240),
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price" numeric(14, 2),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_items_site_id_uq" UNIQUE("site_id","id"),
	CONSTRAINT "request_items_quantity_positive_ck" CHECK ("request_items"."quantity" > 0),
	CONSTRAINT "request_items_unit_price_nonnegative_ck" CHECK ("request_items"."unit_price" IS NULL OR "request_items"."unit_price" >= 0),
	CONSTRAINT "request_items_metadata_object_ck" CHECK (jsonb_typeof("request_items"."metadata") = 'object')
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"request_number" varchar(80) NOT NULL,
	"requested_by" uuid,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"priority" "priority" DEFAULT 'Normal' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"team" varchar(180),
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requests_site_id_uq" UNIQUE("site_id","id"),
	CONSTRAINT "requests_site_number_uq" UNIQUE("site_id","request_number"),
	CONSTRAINT "requests_current_step_nonnegative_ck" CHECK ("requests"."current_step" >= 0),
	CONSTRAINT "requests_metadata_object_ck" CHECK (jsonb_typeof("requests"."metadata") = 'object')
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"step" integer NOT NULL,
	"required_role" "site_role" DEFAULT 'Manager' NOT NULL,
	"decision" "approval_decision" DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"comment" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approvals_site_id_uq" UNIQUE("site_id","id"),
	CONSTRAINT "approvals_request_step_uq" UNIQUE("site_id","request_id","step"),
	CONSTRAINT "approvals_step_nonnegative_ck" CHECK ("approvals"."step" >= 0)
);
--> statement-breakpoint
CREATE TABLE "assignment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"request_item_id" uuid,
	"item_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"remaining_quantity" numeric(14, 3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignment_items_site_id_uq" UNIQUE("site_id","id"),
	CONSTRAINT "assignment_items_quantity_positive_ck" CHECK ("assignment_items"."quantity" > 0),
	CONSTRAINT "assignment_items_remaining_range_ck" CHECK ("assignment_items"."remaining_quantity" >= 0 AND "assignment_items"."remaining_quantity" <= "assignment_items"."quantity")
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"assignment_number" varchar(80) NOT NULL,
	"request_id" uuid,
	"assigned_to" uuid,
	"assigned_by" uuid,
	"status" "assignment_status" DEFAULT 'issued' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignments_site_id_uq" UNIQUE("site_id","id"),
	CONSTRAINT "assignments_site_number_uq" UNIQUE("site_id","assignment_number")
);
--> statement-breakpoint
CREATE TABLE "consumption_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"assignment_item_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"consumed_on" date DEFAULT now() NOT NULL,
	"consumed_by" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consumption_records_site_id_uq" UNIQUE("site_id","id"),
	CONSTRAINT "consumption_records_quantity_positive_ck" CHECK ("consumption_records"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "return_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"return_id" uuid NOT NULL,
	"item_id" uuid,
	"assignment_item_id" uuid,
	"repair_part_id" uuid,
	"quantity" numeric(14, 3) NOT NULL,
	"condition" varchar(80),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "return_items_site_id_uq" UNIQUE("site_id","id"),
	CONSTRAINT "return_items_quantity_positive_ck" CHECK ("return_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"return_number" varchar(80) NOT NULL,
	"type" "return_type" NOT NULL,
	"status" "return_status" DEFAULT 'pending' NOT NULL,
	"assignment_id" uuid,
	"repair_record_id" uuid,
	"received_by" uuid,
	"received_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "returns_site_id_uq" UNIQUE("site_id","id"),
	CONSTRAINT "returns_site_number_uq" UNIQUE("site_id","return_number"),
	CONSTRAINT "returns_source_xor_ck" CHECK (("returns"."assignment_id" IS NOT NULL)::int + ("returns"."repair_record_id" IS NOT NULL)::int = 1)
);
--> statement-breakpoint
CREATE TABLE "repair_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"repair_record_id" uuid NOT NULL,
	"item_id" uuid,
	"description" varchar(240),
	"quantity" numeric(14, 3) NOT NULL,
	"unit_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repair_parts_site_id_uq" UNIQUE("site_id","id"),
	CONSTRAINT "repair_parts_quantity_positive_ck" CHECK ("repair_parts"."quantity" > 0),
	CONSTRAINT "repair_parts_unit_cost_nonnegative_ck" CHECK ("repair_parts"."unit_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "repair_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"ticket_number" varchar(80) NOT NULL,
	"request_id" uuid,
	"customer_name" varchar(180),
	"device" varchar(240) NOT NULL,
	"fault" text NOT NULL,
	"stage" "repair_stage" DEFAULT 'diagnosis' NOT NULL,
	"status" "repair_status" DEFAULT 'open' NOT NULL,
	"technician_id" uuid,
	"parts_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"labour_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repair_records_site_id_uq" UNIQUE("site_id","id"),
	CONSTRAINT "repair_records_site_ticket_uq" UNIQUE("site_id","ticket_number"),
	CONSTRAINT "repair_records_parts_cost_nonnegative_ck" CHECK ("repair_records"."parts_cost" >= 0),
	CONSTRAINT "repair_records_labour_cost_nonnegative_ck" CHECK ("repair_records"."labour_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "excel_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"type" "excel_job_type" NOT NULL,
	"status" "excel_job_status" DEFAULT 'queued' NOT NULL,
	"resource" varchar(100) NOT NULL,
	"file_name" varchar(255),
	"requested_by" uuid,
	"row_count" integer,
	"error" text,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "excel_jobs_site_id_uq" UNIQUE("site_id","id"),
	CONSTRAINT "excel_jobs_row_count_nonnegative_ck" CHECK ("excel_jobs"."row_count" IS NULL OR "excel_jobs"."row_count" >= 0),
	CONSTRAINT "excel_jobs_result_object_ck" CHECK (jsonb_typeof("excel_jobs"."result") = 'object')
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"user_id" uuid,
	"action" varchar(120) NOT NULL,
	"entity_type" varchar(120) NOT NULL,
	"entity_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_logs_site_id_uq" UNIQUE("site_id","id"),
	CONSTRAINT "audit_logs_details_object_ck" CHECK (jsonb_typeof("audit_logs"."details") = 'object')
);
--> statement-breakpoint
ALTER TABLE "site_members" ADD CONSTRAINT "site_members_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_members" ADD CONSTRAINT "site_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_live_version_same_site_fk" FOREIGN KEY ("id","live_version_id") REFERENCES "public"."site_versions"("site_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_modules" ADD CONSTRAINT "site_modules_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_modules" ADD CONSTRAINT "site_modules_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_versions" ADD CONSTRAINT "site_versions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_versions" ADD CONSTRAINT "site_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_deployed_by_users_id_fk" FOREIGN KEY ("deployed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_version_same_site_fk" FOREIGN KEY ("site_id","version_id") REFERENCES "public"."site_versions"("site_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_category_same_site_fk" FOREIGN KEY ("site_id","category_id") REFERENCES "public"."categories"("site_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_same_site_fk" FOREIGN KEY ("site_id","item_id") REFERENCES "public"."items"("site_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_items" ADD CONSTRAINT "request_items_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_items" ADD CONSTRAINT "request_items_request_same_site_fk" FOREIGN KEY ("site_id","request_id") REFERENCES "public"."requests"("site_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_items" ADD CONSTRAINT "request_items_item_same_site_fk" FOREIGN KEY ("site_id","item_id") REFERENCES "public"."items"("site_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_request_same_site_fk" FOREIGN KEY ("site_id","request_id") REFERENCES "public"."requests"("site_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_items" ADD CONSTRAINT "assignment_items_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_items" ADD CONSTRAINT "assignment_items_assignment_same_site_fk" FOREIGN KEY ("site_id","assignment_id") REFERENCES "public"."assignments"("site_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_items" ADD CONSTRAINT "assignment_items_request_item_same_site_fk" FOREIGN KEY ("site_id","request_item_id") REFERENCES "public"."request_items"("site_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_items" ADD CONSTRAINT "assignment_items_item_same_site_fk" FOREIGN KEY ("site_id","item_id") REFERENCES "public"."items"("site_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_request_same_site_fk" FOREIGN KEY ("site_id","request_id") REFERENCES "public"."requests"("site_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumption_records" ADD CONSTRAINT "consumption_records_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumption_records" ADD CONSTRAINT "consumption_records_consumed_by_users_id_fk" FOREIGN KEY ("consumed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumption_records" ADD CONSTRAINT "consumption_records_assignment_item_same_site_fk" FOREIGN KEY ("site_id","assignment_item_id") REFERENCES "public"."assignment_items"("site_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_same_site_fk" FOREIGN KEY ("site_id","return_id") REFERENCES "public"."returns"("site_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_item_same_site_fk" FOREIGN KEY ("site_id","item_id") REFERENCES "public"."items"("site_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_assignment_item_same_site_fk" FOREIGN KEY ("site_id","assignment_item_id") REFERENCES "public"."assignment_items"("site_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_repair_part_same_site_fk" FOREIGN KEY ("site_id","repair_part_id") REFERENCES "public"."repair_parts"("site_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_assignment_same_site_fk" FOREIGN KEY ("site_id","assignment_id") REFERENCES "public"."assignments"("site_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_repair_record_same_site_fk" FOREIGN KEY ("site_id","repair_record_id") REFERENCES "public"."repair_records"("site_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_parts" ADD CONSTRAINT "repair_parts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_parts" ADD CONSTRAINT "repair_parts_record_same_site_fk" FOREIGN KEY ("site_id","repair_record_id") REFERENCES "public"."repair_records"("site_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_parts" ADD CONSTRAINT "repair_parts_item_same_site_fk" FOREIGN KEY ("site_id","item_id") REFERENCES "public"."items"("site_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_records" ADD CONSTRAINT "repair_records_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_records" ADD CONSTRAINT "repair_records_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_records" ADD CONSTRAINT "repair_records_request_same_site_fk" FOREIGN KEY ("site_id","request_id") REFERENCES "public"."requests"("site_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "excel_jobs" ADD CONSTRAINT "excel_jobs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "excel_jobs" ADD CONSTRAINT "excel_jobs_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_members_user_idx" ON "site_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "deployments_site_created_idx" ON "deployments" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX "categories_site_idx" ON "categories" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "items_site_name_idx" ON "items" USING btree ("site_id","name");--> statement-breakpoint
CREATE INDEX "stock_movements_site_item_created_idx" ON "stock_movements" USING btree ("site_id","item_id","created_at");--> statement-breakpoint
CREATE INDEX "request_items_site_request_idx" ON "request_items" USING btree ("site_id","request_id");--> statement-breakpoint
CREATE INDEX "requests_site_status_created_idx" ON "requests" USING btree ("site_id","status","created_at");--> statement-breakpoint
CREATE INDEX "approvals_site_decision_idx" ON "approvals" USING btree ("site_id","decision");--> statement-breakpoint
CREATE INDEX "assignment_items_site_assignment_idx" ON "assignment_items" USING btree ("site_id","assignment_id");--> statement-breakpoint
CREATE INDEX "assignments_site_status_idx" ON "assignments" USING btree ("site_id","status");--> statement-breakpoint
CREATE INDEX "consumption_records_site_assignment_item_idx" ON "consumption_records" USING btree ("site_id","assignment_item_id");--> statement-breakpoint
CREATE INDEX "return_items_site_return_idx" ON "return_items" USING btree ("site_id","return_id");--> statement-breakpoint
CREATE INDEX "returns_site_status_idx" ON "returns" USING btree ("site_id","status");--> statement-breakpoint
CREATE INDEX "repair_parts_site_record_idx" ON "repair_parts" USING btree ("site_id","repair_record_id");--> statement-breakpoint
CREATE INDEX "repair_records_site_status_idx" ON "repair_records" USING btree ("site_id","status");--> statement-breakpoint
CREATE INDEX "excel_jobs_site_created_idx" ON "excel_jobs" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_site_created_idx" ON "audit_logs" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_site_entity_idx" ON "audit_logs" USING btree ("site_id","entity_type","entity_id");