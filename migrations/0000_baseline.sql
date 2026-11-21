CREATE TABLE "aefi_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_name" text NOT NULL,
	"dob" text NOT NULL,
	"sex" text NOT NULL,
	"barangay" text NOT NULL,
	"vaccine_given" text NOT NULL,
	"vaccination_date" text NOT NULL,
	"vaccination_id" integer,
	"vaccine_preventable_disease" text,
	"event_date" text NOT NULL,
	"event_description" text NOT NULL,
	"severity" text NOT NULL,
	"outcome" text DEFAULT 'UNKNOWN' NOT NULL,
	"reported_to_chd" boolean DEFAULT false,
	"reported_to_chd_at" timestamp,
	"status" text DEFAULT 'NOTIFIED' NOT NULL,
	"who_causality" text,
	"investigated_by_user_id" varchar,
	"investigated_at" timestamp,
	"classified_by_user_id" varchar,
	"classified_at" timestamp,
	"fda_submission_id" text,
	"fda_submitted_at" timestamp,
	"recorded_by_user_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"linked_person_type" text,
	"linked_person_id" integer
);
--> statement-breakpoint
CREATE TABLE "birth_attendance_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"mother_id" integer NOT NULL,
	"delivery_date" text NOT NULL,
	"delivery_type" text NOT NULL,
	"delivery_term" text,
	"notes" text,
	"recorded_by_user_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campaign_tallies" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_type" text NOT NULL,
	"campaign_name" text NOT NULL,
	"campaign_date" text NOT NULL,
	"barangay" text NOT NULL,
	"tallies" jsonb DEFAULT '{}'::jsonb,
	"total_served" integer DEFAULT 0 NOT NULL,
	"conducted_by_user_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cervical_cancer_screenings" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_name" text NOT NULL,
	"barangay" text NOT NULL,
	"dob" text NOT NULL,
	"screen_date" text NOT NULL,
	"screen_method" text,
	"suspicious" boolean DEFAULT false,
	"linked_to_care" boolean DEFAULT false,
	"linked_outcome" text,
	"precancerous" boolean DEFAULT false,
	"precancerous_outcome" text,
	"notes" text,
	"recorded_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"linked_person_type" text,
	"linked_person_id" integer
);
--> statement-breakpoint
CREATE TABLE "child_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer NOT NULL,
	"visit_number" integer NOT NULL,
	"visit_date" text NOT NULL,
	"weight_kg" text,
	"height_cm" text,
	"muac" text,
	"nutrition_notes" text,
	"immunization_notes" text,
	"monitoring_notes" text,
	"recorded_by" text,
	"created_at" text NOT NULL,
	CONSTRAINT "child_visits_child_id_visit_number_unique" UNIQUE("child_id","visit_number")
);
--> statement-breakpoint
CREATE TABLE "children" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"dob" text NOT NULL,
	"sex" text,
	"barangay" text NOT NULL,
	"address_line" text,
	"mother_id" integer,
	"next_visit_date" text,
	"birth_weight_kg" text,
	"birth_weight_category" text,
	"vaccines" jsonb DEFAULT '{}'::jsonb,
	"vitamin_a1_date" text,
	"vitamin_a2_date" text,
	"iron_supp_complete" boolean DEFAULT false,
	"breastfed_exclusively" boolean DEFAULT false,
	"growth" jsonb DEFAULT '[]'::jsonb,
	"latitude" text,
	"longitude" text,
	"sms_opt_in" boolean,
	"sms_opt_in_date" text,
	"sms_opt_out_date" text
);
--> statement-breakpoint
CREATE TABLE "cold_chain_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"barangay" text NOT NULL,
	"reading_date" text NOT NULL,
	"reading_period" text NOT NULL,
	"temp_celsius" real NOT NULL,
	"vvm_status" text DEFAULT 'OK' NOT NULL,
	"notes" text,
	"recorded_by_user_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "consults" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_name" text NOT NULL,
	"age" integer NOT NULL,
	"sex" text NOT NULL,
	"barangay" text NOT NULL,
	"address_line" text,
	"consult_date" text NOT NULL,
	"chief_complaint" text NOT NULL,
	"diagnosis" text NOT NULL,
	"icd_code" text,
	"treatment" text,
	"disposition" text DEFAULT 'Treated',
	"referred_to" text,
	"consult_type" text DEFAULT 'General',
	"linked_person_type" text,
	"linked_person_id" integer,
	"notes" text,
	"created_by" text,
	"created_at" text NOT NULL,
	"blood_pressure" text,
	"weight_kg" text,
	"temperature_c" text,
	"pulse_rate" text,
	"height_cm" text,
	"disposition_notes" text,
	"is_walk_in" boolean DEFAULT false,
	"service_codes" jsonb DEFAULT '[]'::jsonb,
	"acuity_level" text,
	"acuity_override_reason" text,
	"triaged_by_user_id" varchar,
	"triaged_at" timestamp,
	"respiratory_rate" text,
	"spo2" text,
	"rbs_mmol" text,
	"muac_cm" text,
	"pain_score" integer,
	"allergies_verified" boolean DEFAULT false,
	"known_allergies" text,
	"known_ncd_programs" jsonb DEFAULT '[]'::jsonb,
	"imci_danger_signs" jsonb,
	"imci_main_symptoms" jsonb,
	"adult_danger_signs" jsonb,
	"pregnancy_status" text,
	"lmp_date" text,
	"md_assessment" text,
	"md_diagnosis" text,
	"md_plan" text,
	"md_disposition" text,
	"md_referred_to" text,
	"md_signed_by_user_id" varchar,
	"md_signed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "death_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"deceased_name" text NOT NULL,
	"age" integer,
	"sex" text,
	"barangay" text NOT NULL,
	"date_of_death" text NOT NULL,
	"cause_of_death" text,
	"icd_code" text,
	"place_of_death" text,
	"linked_person_type" text,
	"linked_person_id" integer,
	"reported_by" text,
	"notes" text,
	"age_days" integer,
	"maternal_death_cause" text,
	"residency" text,
	"is_fetal_death" boolean DEFAULT false,
	"is_live_born_early_neonatal" boolean DEFAULT false,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "death_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"death_event_id" integer NOT NULL,
	"review_type" text NOT NULL,
	"status" text DEFAULT 'PENDING_NOTIFY' NOT NULL,
	"due_date" text NOT NULL,
	"notified_at" timestamp,
	"review_scheduled_at" timestamp,
	"reviewed_at" timestamp,
	"closed_at" timestamp,
	"committee_members" jsonb,
	"findings" text,
	"recommendations" text,
	"barangay_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disease_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_name" text NOT NULL,
	"age" integer NOT NULL,
	"barangay" text NOT NULL,
	"address_line" text,
	"phone" text,
	"additional_conditions" jsonb DEFAULT '[]'::jsonb,
	"condition" text NOT NULL,
	"date_reported" text NOT NULL,
	"status" text DEFAULT 'New',
	"notes" text,
	"linked_person_type" text,
	"linked_person_id" integer,
	"referral_to_rhu" boolean DEFAULT false,
	"referred_rhu_id" integer,
	"latitude" text,
	"longitude" text
);
--> statement-breakpoint
CREATE TABLE "doh_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"bureau" text DEFAULT 'HFDB' NOT NULL,
	"significance" text DEFAULT 'MEDIUM' NOT NULL,
	"source_url" text NOT NULL,
	"published_date" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text DEFAULT 'MANUAL' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "filariasis_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_name" text NOT NULL,
	"barangay" text NOT NULL,
	"dob" text NOT NULL,
	"sex" text NOT NULL,
	"exam_date" text NOT NULL,
	"result" text,
	"manifestation" text DEFAULT 'NONE',
	"notes" text,
	"recorded_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"status" text DEFAULT 'REPORTED',
	"reviewer_notes" text,
	"reviewed_at" timestamp,
	"reviewed_by_user_id" varchar,
	"linked_person_type" text,
	"linked_person_id" integer
);
--> statement-breakpoint
CREATE TABLE "fp_service_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"barangay" text NOT NULL,
	"patient_name" text NOT NULL,
	"linked_person_type" text,
	"linked_person_id" integer,
	"dob" text,
	"fp_method" text NOT NULL,
	"fp_status" text NOT NULL,
	"date_started" text NOT NULL,
	"date_stopped" text,
	"reporting_month" text,
	"notes" text,
	"recorded_by" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" text NOT NULL,
	"sender_name" text NOT NULL,
	"sender_role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_stations" (
	"id" serial PRIMARY KEY NOT NULL,
	"facility_name" text NOT NULL,
	"facility_type" text,
	"has_tb_dots" boolean DEFAULT false NOT NULL,
	"barangay" text NOT NULL,
	"latitude" text NOT NULL,
	"longitude" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_water_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"barangay" text NOT NULL,
	"survey_date" text NOT NULL,
	"household_id" text,
	"household_head" text,
	"water_level" text,
	"safely_managed" boolean DEFAULT false,
	"notes" text,
	"recorded_by_user_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"barangay" text NOT NULL,
	"vaccines" jsonb DEFAULT '{"bcgQty":0,"hepBQty":0,"pentaQty":0,"opvQty":0,"mrQty":0}'::jsonb,
	"htn_meds" jsonb DEFAULT '[]'::jsonb,
	"low_stock_threshold" integer DEFAULT 10,
	"surplus_threshold" integer DEFAULT 100,
	"last_updated" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"barangay" text NOT NULL,
	"item_type" text NOT NULL,
	"item_name" text NOT NULL,
	"quantity_requested" integer NOT NULL,
	"urgency" text DEFAULT 'NORMAL' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"requested_by_user_id" varchar,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"fulfilled_by_user_id" varchar,
	"fulfilled_at" timestamp,
	"notes" text,
	"fulfillment_notes" text
);
--> statement-breakpoint
CREATE TABLE "inventory_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"barangay" text NOT NULL,
	"snapshot_date" text NOT NULL,
	"item_type" text NOT NULL,
	"item_key" text NOT NULL,
	"qty" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "konsulta_encounters" (
	"id" serial PRIMARY KEY NOT NULL,
	"enrollment_id" integer NOT NULL,
	"consult_id" integer,
	"encounter_date" text NOT NULL,
	"barangay" text NOT NULL,
	"service_codes" jsonb DEFAULT '[]'::jsonb,
	"icd10_codes" jsonb DEFAULT '[]'::jsonb,
	"diagnosis" text,
	"claim_type" text DEFAULT 'CAPITATION' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"sync_status" text DEFAULT 'UNSYNCED' NOT NULL,
	"synced_at" timestamp,
	"philhealth_claim_ref" text,
	"error_message" text,
	"recorded_by_user_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "konsulta_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"pin" text,
	"member_type" text DEFAULT 'PRINCIPAL' NOT NULL,
	"principal_pin" text,
	"family_id" text,
	"first_name" text NOT NULL,
	"middle_name" text,
	"last_name" text NOT NULL,
	"suffix" text,
	"date_of_birth" text NOT NULL,
	"sex" text NOT NULL,
	"civil_status" text,
	"mothers_maiden_name" text,
	"address_line" text,
	"barangay" text NOT NULL,
	"municipality" text DEFAULT 'Placer',
	"province" text DEFAULT 'Surigao del Norte',
	"contributor_category" text,
	"sponsor_name" text,
	"employer" text,
	"provider_code" text,
	"enrollment_date" text NOT NULL,
	"valid_from" text,
	"valid_until" text,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"sync_status" text DEFAULT 'UNSYNCED' NOT NULL,
	"synced_at" timestamp,
	"philhealth_ack_ref" text,
	"error_message" text,
	"recorded_by_user_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leprosy_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_name" text NOT NULL,
	"barangay" text NOT NULL,
	"dob" text NOT NULL,
	"sex" text NOT NULL,
	"registered_date" text NOT NULL,
	"new_case" boolean DEFAULT false,
	"confirmed" boolean DEFAULT false,
	"notes" text,
	"recorded_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"status" text DEFAULT 'REPORTED',
	"reviewer_notes" text,
	"reviewed_at" timestamp,
	"reviewed_by_user_id" varchar,
	"linked_person_type" text,
	"linked_person_id" integer
);
--> statement-breakpoint
CREATE TABLE "m1_indicator_catalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_version_id" integer NOT NULL,
	"page_number" integer NOT NULL,
	"section_code" text NOT NULL,
	"row_key" text NOT NULL,
	"official_label" text NOT NULL,
	"data_type" text DEFAULT 'INT' NOT NULL,
	"unit" text,
	"row_order" integer NOT NULL,
	"indent_level" integer DEFAULT 0,
	"column_group_type" text,
	"column_spec" jsonb,
	"data_source_table" text,
	"data_source_filter" jsonb,
	"is_computed" boolean DEFAULT false,
	"compute_spec_json" jsonb,
	"is_required" boolean DEFAULT true,
	"help_text" text
);
--> statement-breakpoint
CREATE TABLE "m1_indicator_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_instance_id" integer NOT NULL,
	"row_key" text NOT NULL,
	"column_key" text,
	"value_number" integer,
	"value_decimal" text,
	"value_text" text,
	"value_source" text DEFAULT 'ENCODED' NOT NULL,
	"computed_at" text,
	"locked" boolean DEFAULT false,
	"created_by_user_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "m1_report_header" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_instance_id" integer NOT NULL,
	"header_json" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "m1_report_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_version_id" integer NOT NULL,
	"scope_type" text DEFAULT 'BARANGAY' NOT NULL,
	"barangay_id" integer,
	"barangay_name" text,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"created_by_user_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "m1_template_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_name" text NOT NULL,
	"version_label" text NOT NULL,
	"source_file_name" text,
	"source_pdf_hash" text,
	"page_count" integer DEFAULT 3,
	"is_active" boolean DEFAULT true,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medical_certificates" (
	"id" serial PRIMARY KEY NOT NULL,
	"certificate_number" text NOT NULL,
	"cert_type" text NOT NULL,
	"patient_name" text NOT NULL,
	"patient_age" integer,
	"patient_sex" text,
	"barangay" text NOT NULL,
	"address_line" text,
	"issue_date" text NOT NULL,
	"valid_until" text,
	"purpose" text,
	"findings" text,
	"signed_by_user_id" varchar,
	"signed_by_name" text,
	"signed_by_title" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"linked_person_type" text,
	"linked_person_id" integer
);
--> statement-breakpoint
CREATE TABLE "medication_dispensings" (
	"id" serial PRIMARY KEY NOT NULL,
	"consult_id" integer NOT NULL,
	"medicine_inventory_id" integer,
	"medicine_name" text NOT NULL,
	"strength" text,
	"unit" text,
	"quantity_dispensed" integer NOT NULL,
	"barangay" text NOT NULL,
	"dispensed_by_user_id" varchar,
	"dispensed_at" timestamp DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "medicine_inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"barangay" text NOT NULL,
	"medicine_name" text NOT NULL,
	"strength" text,
	"unit" text,
	"qty" integer DEFAULT 0 NOT NULL,
	"expiration_date" text,
	"lot_number" text,
	"source_supplier" text,
	"category" text,
	"notes" text,
	"low_stock_threshold" integer DEFAULT 10,
	"last_updated" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mental_health_screenings" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_name" text NOT NULL,
	"barangay" text NOT NULL,
	"dob" text NOT NULL,
	"sex" text NOT NULL,
	"screen_date" text NOT NULL,
	"tool" text DEFAULT 'mhGAP',
	"positive" boolean DEFAULT false,
	"notes" text,
	"recorded_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"linked_person_type" text,
	"linked_person_id" integer
);
--> statement-breakpoint
CREATE TABLE "mothers" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"age" integer NOT NULL,
	"barangay" text NOT NULL,
	"address_line" text,
	"phone" text,
	"registration_date" text NOT NULL,
	"ga_weeks" integer NOT NULL,
	"expected_delivery_date" text,
	"next_prenatal_check_date" text,
	"anc_visits" integer DEFAULT 0,
	"bmi_status" text,
	"tt1_date" text,
	"tt2_date" text,
	"tt3_date" text,
	"tt4_date" text,
	"tt5_date" text,
	"status" text DEFAULT 'active',
	"outcome" text,
	"outcome_date" text,
	"outcome_notes" text,
	"delivery_attendant" text,
	"delivery_location" text,
	"birth_weight_kg" text,
	"birth_weight_category" text,
	"breastfed_within_1hr" boolean DEFAULT false,
	"iron_supp_given" boolean DEFAULT false,
	"latitude" text,
	"longitude" text,
	"sms_opt_in" boolean,
	"sms_opt_in_date" text,
	"sms_opt_out_date" text
);
--> statement-breakpoint
CREATE TABLE "ncd_screenings" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_name" text NOT NULL,
	"barangay" text NOT NULL,
	"dob" text NOT NULL,
	"sex" text NOT NULL,
	"screen_date" text NOT NULL,
	"condition" text NOT NULL,
	"diagnosed" boolean DEFAULT false,
	"meds_provided" boolean DEFAULT false,
	"meds_source" text,
	"notes" text,
	"recorded_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"linked_person_type" text,
	"linked_person_id" integer
);
--> statement-breakpoint
CREATE TABLE "nutrition_followups" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer NOT NULL,
	"barangay" text NOT NULL,
	"follow_up_date" text NOT NULL,
	"classification" text NOT NULL,
	"weight_kg" text,
	"height_cm" text,
	"muac_cm" text,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"next_step" text,
	"next_follow_up_date" text,
	"outcome" text,
	"notes" text,
	"recorded_by" text,
	"created_at" text NOT NULL,
	"referred_rhu_id" integer
);
--> statement-breakpoint
CREATE TABLE "oral_health_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_name" text NOT NULL,
	"barangay" text NOT NULL,
	"dob" text NOT NULL,
	"sex" text NOT NULL,
	"visit_date" text NOT NULL,
	"is_first_visit" boolean DEFAULT true,
	"facility_based" boolean DEFAULT true,
	"is_pregnant" boolean DEFAULT false,
	"notes" text,
	"recorded_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"linked_person_type" text,
	"linked_person_id" integer
);
--> statement-breakpoint
CREATE TABLE "outbreaks" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'DISEASE_CASES' NOT NULL,
	"disease" text NOT NULL,
	"barangay" text NOT NULL,
	"status" text DEFAULT 'SUSPECTED' NOT NULL,
	"case_count" integer DEFAULT 1 NOT NULL,
	"case_ids" jsonb,
	"window_days" integer,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"declared_at" timestamp,
	"contained_at" timestamp,
	"closed_at" timestamp,
	"investigation_notes" text,
	"containment_actions" text,
	"closure_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "philhealth_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'PENDING_SUBMISSION' NOT NULL,
	"submitted_at" timestamp,
	"response_json" jsonb,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "philpen_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_name" text NOT NULL,
	"barangay" text NOT NULL,
	"dob" text NOT NULL,
	"sex" text NOT NULL,
	"assessment_date" text NOT NULL,
	"smoking_history" boolean DEFAULT false,
	"binge_drinker" boolean DEFAULT false,
	"insufficient_activity" boolean DEFAULT false,
	"unhealthy_diet" boolean DEFAULT false,
	"bmi_category" text,
	"notes" text,
	"recorded_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"linked_person_type" text,
	"linked_person_id" integer
);
--> statement-breakpoint
CREATE TABLE "pidsr_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"barangay" text NOT NULL,
	"week_start_date" text NOT NULL,
	"week_end_date" text NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"submitted_by_user_id" varchar,
	"cat2_case_count" integer DEFAULT 0,
	"zero_report_diseases" jsonb,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "postpartum_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"mother_id" integer NOT NULL,
	"visit_date" text NOT NULL,
	"visit_type" text NOT NULL,
	"bp_systolic" integer,
	"bp_diastolic" integer,
	"breastfeeding_exclusive" boolean,
	"iron_supp_given" boolean,
	"fp_counseling_given" boolean,
	"trans_in_from_lgu" boolean DEFAULT false,
	"trans_out_with_mov" boolean DEFAULT false,
	"trans_out_date" text,
	"notes" text,
	"recorded_by_user_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prenatal_screenings" (
	"id" serial PRIMARY KEY NOT NULL,
	"mother_id" integer NOT NULL,
	"screening_date" text NOT NULL,
	"hep_b_screened" boolean DEFAULT false,
	"hep_b_positive" boolean,
	"anemia_screened" boolean DEFAULT false,
	"hgb_level_g_dl" real,
	"gdm_screened" boolean DEFAULT false,
	"gdm_positive" boolean,
	"iron_folic_complete" boolean DEFAULT false,
	"mms_given" boolean DEFAULT false,
	"calcium_given" boolean DEFAULT false,
	"deworming_given" boolean DEFAULT false,
	"notes" text,
	"recorded_by_user_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prenatal_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"mother_id" integer NOT NULL,
	"visit_number" integer NOT NULL,
	"visit_date" text NOT NULL,
	"ga_weeks" integer,
	"weight_kg" text,
	"blood_pressure" text,
	"fundal_height" text,
	"fetal_heart_tone" text,
	"risk_status" text,
	"notes" text,
	"next_scheduled_visit" text,
	"recorded_by" text,
	"created_at" text NOT NULL,
	CONSTRAINT "prenatal_visits_mother_id_visit_number_unique" UNIQUE("mother_id","visit_number")
);
--> statement-breakpoint
CREATE TABLE "rabies_exposures" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_name" text NOT NULL,
	"barangay" text NOT NULL,
	"dob" text NOT NULL,
	"sex" text NOT NULL,
	"exposure_date" text NOT NULL,
	"category" text NOT NULL,
	"treatment_center" text,
	"complete_doses" boolean DEFAULT false,
	"notes" text,
	"recorded_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"status" text DEFAULT 'REPORTED',
	"reviewer_notes" text,
	"reviewed_at" timestamp,
	"reviewed_by_user_id" varchar,
	"linked_person_type" text,
	"linked_person_id" integer
);
--> statement-breakpoint
CREATE TABLE "referral_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_facility" text NOT NULL,
	"source_user_id" varchar,
	"source_barangay" text,
	"target_facility" text NOT NULL,
	"target_user_id" varchar,
	"patient_id" integer NOT NULL,
	"patient_type" text NOT NULL,
	"patient_name" text NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"received_at" timestamp,
	"completed_at" timestamp,
	"received_notes" text,
	"completion_outcome" text,
	"linked_person_type" text,
	"linked_person_id" integer
);
--> statement-breakpoint
CREATE TABLE "schistosomiasis_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_name" text NOT NULL,
	"barangay" text NOT NULL,
	"dob" text NOT NULL,
	"sex" text NOT NULL,
	"seen_date" text NOT NULL,
	"suspected" boolean DEFAULT false,
	"treated" boolean DEFAULT false,
	"confirmed" boolean DEFAULT false,
	"complicated" boolean DEFAULT false,
	"notes" text,
	"recorded_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"status" text DEFAULT 'REPORTED',
	"reviewer_notes" text,
	"reviewed_at" timestamp,
	"reviewed_by_user_id" varchar,
	"linked_person_type" text,
	"linked_person_id" integer
);
--> statement-breakpoint
CREATE TABLE "school_immunizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"learner_name" text NOT NULL,
	"barangay" text NOT NULL,
	"school_name" text,
	"grade_level" integer,
	"dob" text NOT NULL,
	"sex" text NOT NULL,
	"vaccine" text NOT NULL,
	"dose_number" integer NOT NULL,
	"vaccination_date" text NOT NULL,
	"notes" text,
	"recorded_by_user_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "senior_med_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"senior_id" integer NOT NULL,
	"senior_unique_id" text,
	"claimed_at" text NOT NULL,
	"claimed_barangay_id" integer NOT NULL,
	"claimed_barangay_name" text,
	"claimed_facility_id" integer,
	"medication_name" text NOT NULL,
	"dose" text,
	"quantity" integer NOT NULL,
	"cycle_days" integer DEFAULT 30,
	"next_eligible_at" text NOT NULL,
	"claimed_by_user_id" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "senior_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"senior_id" integer NOT NULL,
	"visit_number" integer NOT NULL,
	"visit_date" text NOT NULL,
	"blood_pressure" text,
	"weight_kg" text,
	"medication_pickup_note" text,
	"symptoms_remarks" text,
	"follow_up_notes" text,
	"recorded_by" text,
	"created_at" text NOT NULL,
	CONSTRAINT "senior_visits_senior_id_visit_number_unique" UNIQUE("senior_id","visit_number")
);
--> statement-breakpoint
CREATE TABLE "seniors" (
	"id" serial PRIMARY KEY NOT NULL,
	"senior_unique_id" text,
	"senior_citizen_id" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"dob" text,
	"sex" text,
	"age" integer NOT NULL,
	"barangay" text NOT NULL,
	"address_line" text,
	"phone" text,
	"last_bp" text,
	"last_bp_date" text,
	"last_medication_name" text,
	"last_medication_dose_mg" integer,
	"last_medication_quantity" integer,
	"last_medication_given_date" text,
	"next_pickup_date" text,
	"htn_meds_ready" boolean DEFAULT false,
	"picked_up" boolean DEFAULT false,
	"civil_status" text,
	"latitude" text,
	"longitude" text,
	"sms_opt_in" boolean,
	"sms_opt_in_date" text,
	"sms_opt_out_date" text
);
--> statement-breakpoint
CREATE TABLE "sick_child_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer NOT NULL,
	"visit_date" text NOT NULL,
	"vitamin_a_given" boolean DEFAULT false,
	"has_acute_diarrhea" boolean DEFAULT false,
	"notes" text,
	"recorded_by_user_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sms_outbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient" text NOT NULL,
	"recipient_phone" text,
	"message" text NOT NULL,
	"sent_at" text NOT NULL,
	"status" text DEFAULT 'Queued (Demo)',
	"barangay" text,
	"automated" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "sth_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_name" text NOT NULL,
	"barangay" text NOT NULL,
	"dob" text NOT NULL,
	"sex" text NOT NULL,
	"screen_date" text NOT NULL,
	"confirmed" boolean DEFAULT false,
	"residency" text DEFAULT 'RESIDENT',
	"notes" text,
	"recorded_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"status" text DEFAULT 'REPORTED',
	"reviewer_notes" text,
	"reviewed_at" timestamp,
	"reviewed_by_user_id" varchar,
	"linked_person_type" text,
	"linked_person_id" integer
);
--> statement-breakpoint
CREATE TABLE "tb_dose_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tb_patient_id" integer NOT NULL,
	"dose_date" text NOT NULL,
	"observed_status" text NOT NULL,
	"observed_by_user_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tb_patients" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"age" integer NOT NULL,
	"barangay" text NOT NULL,
	"address_line" text,
	"phone" text,
	"tb_type" text DEFAULT 'Pulmonary',
	"treatment_phase" text NOT NULL,
	"treatment_start_date" text NOT NULL,
	"last_observed_dose_date" text,
	"next_dots_visit_date" text,
	"missed_doses_count" integer DEFAULT 0,
	"meds_regimen_name" text,
	"referral_to_rhu" boolean DEFAULT false,
	"referred_rhu_id" integer,
	"next_sputum_check_date" text,
	"outcome_status" text DEFAULT 'Ongoing',
	"latitude" text,
	"longitude" text,
	"sms_opt_in" boolean,
	"sms_opt_in_date" text,
	"sms_opt_out_date" text
);
--> statement-breakpoint
CREATE TABLE "theme_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"lgu_name" text DEFAULT 'Placer Municipality' NOT NULL,
	"lgu_subtitle" text DEFAULT 'Province of Surigao del Norte',
	"logo_url" text,
	"color_scheme" text DEFAULT 'healthsync' NOT NULL,
	"primary_hue" integer DEFAULT 172,
	"primary_saturation" integer DEFAULT 53,
	"primary_lightness" integer DEFAULT 49
);
--> statement-breakpoint
CREATE TABLE "vaccinations" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer,
	"school_immunization_id" integer,
	"vaccine" text NOT NULL,
	"dose_number" integer NOT NULL,
	"vaccination_date" text NOT NULL,
	"lot_number" text,
	"expiration_date" text,
	"medicine_inventory_id" integer,
	"administered_by_user_id" varchar,
	"barangay" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vision_screenings" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_name" text NOT NULL,
	"barangay" text NOT NULL,
	"dob" text NOT NULL,
	"sex" text NOT NULL,
	"screen_date" text NOT NULL,
	"eye_disease_found" boolean DEFAULT false,
	"referred_to_eye_care" boolean DEFAULT false,
	"notes" text,
	"recorded_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"linked_person_type" text,
	"linked_person_id" integer
);
--> statement-breakpoint
CREATE TABLE "workforce_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"credential_type" text NOT NULL,
	"date_obtained" text NOT NULL,
	"expiry_date" text,
	"provider" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workforce_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"profession" text NOT NULL,
	"prc_license_number" text,
	"prc_license_expiry" text,
	"barangay" text,
	"facility_type" text,
	"employment_status" text NOT NULL,
	"date_hired" text,
	"date_separated" text,
	"separation_reason" text,
	"contact_number" text,
	"email" text,
	"user_id" varchar,
	"notes" text,
	"recorded_by_user_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"user_role" varchar NOT NULL,
	"action" varchar NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" varchar,
	"barangay_id" serial NOT NULL,
	"barangay_name" text,
	"before_json" jsonb,
	"after_json" jsonb,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "barangay_settings" (
	"barangay_id" serial PRIMARY KEY NOT NULL,
	"barangay_name_override" text,
	"subtitle" text,
	"logo_url" text,
	"theme_json" jsonb,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "barangays" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"municipality_id" serial NOT NULL,
	"population" serial NOT NULL,
	"latitude" text,
	"longitude" text
);
--> statement-breakpoint
CREATE TABLE "direct_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" varchar NOT NULL,
	"receiver_id" varchar NOT NULL,
	"content" text NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "municipality_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"municipality_id" serial NOT NULL,
	"municipality_name" text,
	"subtitle" text,
	"logo_url" text,
	"theme_json" jsonb,
	"updated_at" text NOT NULL,
	CONSTRAINT "municipality_settings_municipality_id_unique" UNIQUE("municipality_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_barangays" (
	"user_id" varchar NOT NULL,
	"barangay_id" serial NOT NULL,
	CONSTRAINT "user_barangays_user_id_barangay_id_pk" PRIMARY KEY("user_id","barangay_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar NOT NULL,
	"password_hash" varchar NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" varchar DEFAULT 'TL' NOT NULL,
	"status" varchar DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"contact_number" varchar,
	"full_name" varchar,
	"kyc_id_type" varchar,
	"kyc_id_file_url" varchar,
	"kyc_selfie_url" varchar,
	"kyc_notes" text,
	"kyc_reviewed_at" timestamp,
	"kyc_reviewed_by_id" varchar,
	"kyc_face_match_status" varchar,
	"kyc_face_match_score" real,
	"kyc_face_match_reason" text,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aefi_events" ADD CONSTRAINT "aefi_events_vaccination_id_vaccinations_id_fk" FOREIGN KEY ("vaccination_id") REFERENCES "public"."vaccinations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birth_attendance_records" ADD CONSTRAINT "birth_attendance_records_mother_id_mothers_id_fk" FOREIGN KEY ("mother_id") REFERENCES "public"."mothers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_visits" ADD CONSTRAINT "child_visits_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disease_cases" ADD CONSTRAINT "disease_cases_referred_rhu_id_health_stations_id_fk" FOREIGN KEY ("referred_rhu_id") REFERENCES "public"."health_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_followups" ADD CONSTRAINT "nutrition_followups_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_followups" ADD CONSTRAINT "nutrition_followups_referred_rhu_id_health_stations_id_fk" FOREIGN KEY ("referred_rhu_id") REFERENCES "public"."health_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postpartum_visits" ADD CONSTRAINT "postpartum_visits_mother_id_mothers_id_fk" FOREIGN KEY ("mother_id") REFERENCES "public"."mothers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prenatal_screenings" ADD CONSTRAINT "prenatal_screenings_mother_id_mothers_id_fk" FOREIGN KEY ("mother_id") REFERENCES "public"."mothers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prenatal_visits" ADD CONSTRAINT "prenatal_visits_mother_id_mothers_id_fk" FOREIGN KEY ("mother_id") REFERENCES "public"."mothers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "senior_visits" ADD CONSTRAINT "senior_visits_senior_id_seniors_id_fk" FOREIGN KEY ("senior_id") REFERENCES "public"."seniors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sick_child_visits" ADD CONSTRAINT "sick_child_visits_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_dose_logs" ADD CONSTRAINT "tb_dose_logs_tb_patient_id_tb_patients_id_fk" FOREIGN KEY ("tb_patient_id") REFERENCES "public"."tb_patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_patients" ADD CONSTRAINT "tb_patients_referred_rhu_id_health_stations_id_fk" FOREIGN KEY ("referred_rhu_id") REFERENCES "public"."health_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_school_immunization_id_school_immunizations_id_fk" FOREIGN KEY ("school_immunization_id") REFERENCES "public"."school_immunizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_medicine_inventory_id_medicine_inventory_id_fk" FOREIGN KEY ("medicine_inventory_id") REFERENCES "public"."medicine_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_credentials" ADD CONSTRAINT "workforce_credentials_member_id_workforce_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."workforce_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barangay_settings" ADD CONSTRAINT "barangay_settings_barangay_id_barangays_id_fk" FOREIGN KEY ("barangay_id") REFERENCES "public"."barangays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_barangays" ADD CONSTRAINT "user_barangays_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_barangays" ADD CONSTRAINT "user_barangays_barangay_id_barangays_id_fk" FOREIGN KEY ("barangay_id") REFERENCES "public"."barangays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cold_chain_logs_unique_idx" ON "cold_chain_logs" USING btree ("barangay","reading_date","reading_period");--> statement-breakpoint
CREATE INDEX "doh_updates_source_url_idx" ON "doh_updates" USING btree ("source_url");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_snapshots_unique_idx" ON "inventory_snapshots" USING btree ("barangay","snapshot_date","item_type","item_key");--> statement-breakpoint
CREATE UNIQUE INDEX "pidsr_submissions_unique_idx" ON "pidsr_submissions" USING btree ("barangay","week_end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "tb_dose_logs_unique_idx" ON "tb_dose_logs" USING btree ("tb_patient_id","dose_date");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");