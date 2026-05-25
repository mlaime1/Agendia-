


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;




ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."trip_type_enum" AS ENUM (
    'ida',
    'ida y vuelta',
    'especial'
);


ALTER TYPE "public"."trip_type_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.users (auth_id, email, name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Sin nombre'),
    NOW()
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" bigint NOT NULL,
    "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "nombre" character varying NOT NULL,
    "phone" numeric NOT NULL,
    "billing_cycle" character varying NOT NULL,
    "billing_day" integer,
    "billing_start_date" "date",
    "auth_id" "text"
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."clients_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."clients_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."clients_id_seq" OWNED BY "public"."clients"."id";



CREATE TABLE IF NOT EXISTS "public"."rates" (
    "id" bigint NOT NULL,
    "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "client_id" bigint,
    "route_id" bigint,
    "base_price" numeric NOT NULL,
    "surcharge_price" numeric,
    "start_date" "date",
    "end_date" "date",
    "trip_type" "public"."trip_type_enum" DEFAULT 'ida'::"public"."trip_type_enum" NOT NULL
);


ALTER TABLE "public"."rates" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."rates_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."rates_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."rates_id_seq" OWNED BY "public"."rates"."id";



CREATE TABLE IF NOT EXISTS "public"."route_stops" (
    "id" bigint NOT NULL,
    "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "address" character varying,
    "stop_order" numeric,
    "route_id" bigint
);


ALTER TABLE "public"."route_stops" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."route_stops_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."route_stops_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."route_stops_id_seq" OWNED BY "public"."route_stops"."id";



CREATE TABLE IF NOT EXISTS "public"."routes" (
    "id" bigint NOT NULL,
    "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "name" character varying,
    "client_id" bigint
);


ALTER TABLE "public"."routes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."routes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."routes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."routes_id_seq" OWNED BY "public"."routes"."id";



CREATE TABLE IF NOT EXISTS "public"."summaries" (
    "id" bigint NOT NULL,
    "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
    "client_id" bigint NOT NULL,
    "driver_id" bigint NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "period_type" character varying NOT NULL,
    "total_trips" integer DEFAULT 0 NOT NULL,
    "total_amount" numeric DEFAULT 0 NOT NULL,
    "status" character varying DEFAULT 'draft'::character varying NOT NULL,
    "sent_at" timestamp(6) with time zone,
    "paid_at" timestamp(6) with time zone,
    "archived_at" timestamp(6) with time zone,
    "whatsapp_msg" "text",
    "notes" character varying
);


ALTER TABLE "public"."summaries" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."summaries_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."summaries_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."summaries_id_seq" OWNED BY "public"."summaries"."id";



CREATE TABLE IF NOT EXISTS "public"."trips" (
    "id" bigint NOT NULL,
    "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "user_id" bigint NOT NULL,
    "client_id" bigint NOT NULL,
    "route_id" bigint NOT NULL,
    "rate_id" bigint,
    "trip_date" timestamp(6) without time zone NOT NULL,
    "trip_type" "public"."trip_type_enum" NOT NULL,
    "final_price" numeric NOT NULL,
    "has_surcharge" boolean DEFAULT false NOT NULL,
    "surcharge_reason" character varying,
    "special_type" character varying,
    "notes" character varying,
    "summary_id" bigint
);


ALTER TABLE "public"."trips" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."trips_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."trips_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."trips_id_seq" OWNED BY "public"."trips"."id";



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" bigint NOT NULL,
    "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "name" character varying NOT NULL,
    "email" character varying NOT NULL,
    "alias" character varying,
    "auth_id" "text",
    "role" "text" DEFAULT 'driver'::"text" NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."users_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."users_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."users_id_seq" OWNED BY "public"."users"."id";



ALTER TABLE ONLY "public"."clients" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."clients_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."rates" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."rates_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."route_stops" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."route_stops_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."routes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."routes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."summaries" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."summaries_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."trips" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."trips_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."users" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."users_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "cliente_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_auth_id_key" UNIQUE ("auth_id");



ALTER TABLE ONLY "public"."rates"
    ADD CONSTRAINT "rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."route_stops"
    ADD CONSTRAINT "route_stops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."routes"
    ADD CONSTRAINT "routes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."summaries"
    ADD CONSTRAINT "summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "user_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_id_key" UNIQUE ("auth_id");



ALTER TABLE ONLY "public"."rates"
    ADD CONSTRAINT "rates_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."rates"
    ADD CONSTRAINT "rates_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id");



ALTER TABLE ONLY "public"."route_stops"
    ADD CONSTRAINT "route_stops_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id");



ALTER TABLE ONLY "public"."routes"
    ADD CONSTRAINT "routes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."summaries"
    ADD CONSTRAINT "summaries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."summaries"
    ADD CONSTRAINT "summaries_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_rate_id_fkey" FOREIGN KEY ("rate_id") REFERENCES "public"."rates"("id");



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id");



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_summary_id_fkey" FOREIGN KEY ("summary_id") REFERENCES "public"."summaries"("id");



ALTER TABLE ONLY "public"."trips"
    ADD CONSTRAINT "trips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."route_stops" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."routes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."summaries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trips" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;




































































































































































































drop extension if exists "pg_net";

revoke delete on table "public"."clients" from "anon";

revoke insert on table "public"."clients" from "anon";

revoke references on table "public"."clients" from "anon";

revoke select on table "public"."clients" from "anon";

revoke trigger on table "public"."clients" from "anon";

revoke truncate on table "public"."clients" from "anon";

revoke update on table "public"."clients" from "anon";

revoke delete on table "public"."clients" from "authenticated";

revoke insert on table "public"."clients" from "authenticated";

revoke references on table "public"."clients" from "authenticated";

revoke select on table "public"."clients" from "authenticated";

revoke trigger on table "public"."clients" from "authenticated";

revoke truncate on table "public"."clients" from "authenticated";

revoke update on table "public"."clients" from "authenticated";

revoke delete on table "public"."clients" from "service_role";

revoke insert on table "public"."clients" from "service_role";

revoke references on table "public"."clients" from "service_role";

revoke select on table "public"."clients" from "service_role";

revoke trigger on table "public"."clients" from "service_role";

revoke truncate on table "public"."clients" from "service_role";

revoke update on table "public"."clients" from "service_role";

revoke delete on table "public"."rates" from "anon";

revoke insert on table "public"."rates" from "anon";

revoke references on table "public"."rates" from "anon";

revoke select on table "public"."rates" from "anon";

revoke trigger on table "public"."rates" from "anon";

revoke truncate on table "public"."rates" from "anon";

revoke update on table "public"."rates" from "anon";

revoke delete on table "public"."rates" from "authenticated";

revoke insert on table "public"."rates" from "authenticated";

revoke references on table "public"."rates" from "authenticated";

revoke select on table "public"."rates" from "authenticated";

revoke trigger on table "public"."rates" from "authenticated";

revoke truncate on table "public"."rates" from "authenticated";

revoke update on table "public"."rates" from "authenticated";

revoke delete on table "public"."rates" from "service_role";

revoke insert on table "public"."rates" from "service_role";

revoke references on table "public"."rates" from "service_role";

revoke select on table "public"."rates" from "service_role";

revoke trigger on table "public"."rates" from "service_role";

revoke truncate on table "public"."rates" from "service_role";

revoke update on table "public"."rates" from "service_role";

revoke delete on table "public"."route_stops" from "anon";

revoke insert on table "public"."route_stops" from "anon";

revoke references on table "public"."route_stops" from "anon";

revoke select on table "public"."route_stops" from "anon";

revoke trigger on table "public"."route_stops" from "anon";

revoke truncate on table "public"."route_stops" from "anon";

revoke update on table "public"."route_stops" from "anon";

revoke delete on table "public"."route_stops" from "authenticated";

revoke insert on table "public"."route_stops" from "authenticated";

revoke references on table "public"."route_stops" from "authenticated";

revoke select on table "public"."route_stops" from "authenticated";

revoke trigger on table "public"."route_stops" from "authenticated";

revoke truncate on table "public"."route_stops" from "authenticated";

revoke update on table "public"."route_stops" from "authenticated";

revoke delete on table "public"."route_stops" from "service_role";

revoke insert on table "public"."route_stops" from "service_role";

revoke references on table "public"."route_stops" from "service_role";

revoke select on table "public"."route_stops" from "service_role";

revoke trigger on table "public"."route_stops" from "service_role";

revoke truncate on table "public"."route_stops" from "service_role";

revoke update on table "public"."route_stops" from "service_role";

revoke delete on table "public"."routes" from "anon";

revoke insert on table "public"."routes" from "anon";

revoke references on table "public"."routes" from "anon";

revoke select on table "public"."routes" from "anon";

revoke trigger on table "public"."routes" from "anon";

revoke truncate on table "public"."routes" from "anon";

revoke update on table "public"."routes" from "anon";

revoke delete on table "public"."routes" from "authenticated";

revoke insert on table "public"."routes" from "authenticated";

revoke references on table "public"."routes" from "authenticated";

revoke select on table "public"."routes" from "authenticated";

revoke trigger on table "public"."routes" from "authenticated";

revoke truncate on table "public"."routes" from "authenticated";

revoke update on table "public"."routes" from "authenticated";

revoke delete on table "public"."routes" from "service_role";

revoke insert on table "public"."routes" from "service_role";

revoke references on table "public"."routes" from "service_role";

revoke select on table "public"."routes" from "service_role";

revoke trigger on table "public"."routes" from "service_role";

revoke truncate on table "public"."routes" from "service_role";

revoke update on table "public"."routes" from "service_role";

revoke delete on table "public"."summaries" from "anon";

revoke insert on table "public"."summaries" from "anon";

revoke references on table "public"."summaries" from "anon";

revoke select on table "public"."summaries" from "anon";

revoke trigger on table "public"."summaries" from "anon";

revoke truncate on table "public"."summaries" from "anon";

revoke update on table "public"."summaries" from "anon";

revoke delete on table "public"."summaries" from "authenticated";

revoke insert on table "public"."summaries" from "authenticated";

revoke references on table "public"."summaries" from "authenticated";

revoke select on table "public"."summaries" from "authenticated";

revoke trigger on table "public"."summaries" from "authenticated";

revoke truncate on table "public"."summaries" from "authenticated";

revoke update on table "public"."summaries" from "authenticated";

revoke delete on table "public"."summaries" from "service_role";

revoke insert on table "public"."summaries" from "service_role";

revoke references on table "public"."summaries" from "service_role";

revoke select on table "public"."summaries" from "service_role";

revoke trigger on table "public"."summaries" from "service_role";

revoke truncate on table "public"."summaries" from "service_role";

revoke update on table "public"."summaries" from "service_role";

revoke delete on table "public"."trips" from "anon";

revoke insert on table "public"."trips" from "anon";

revoke references on table "public"."trips" from "anon";

revoke select on table "public"."trips" from "anon";

revoke trigger on table "public"."trips" from "anon";

revoke truncate on table "public"."trips" from "anon";

revoke update on table "public"."trips" from "anon";

revoke delete on table "public"."trips" from "authenticated";

revoke insert on table "public"."trips" from "authenticated";

revoke references on table "public"."trips" from "authenticated";

revoke select on table "public"."trips" from "authenticated";

revoke trigger on table "public"."trips" from "authenticated";

revoke truncate on table "public"."trips" from "authenticated";

revoke update on table "public"."trips" from "authenticated";

revoke delete on table "public"."trips" from "service_role";

revoke insert on table "public"."trips" from "service_role";

revoke references on table "public"."trips" from "service_role";

revoke select on table "public"."trips" from "service_role";

revoke trigger on table "public"."trips" from "service_role";

revoke truncate on table "public"."trips" from "service_role";

revoke update on table "public"."trips" from "service_role";

revoke delete on table "public"."users" from "anon";

revoke insert on table "public"."users" from "anon";

revoke references on table "public"."users" from "anon";

revoke select on table "public"."users" from "anon";

revoke trigger on table "public"."users" from "anon";

revoke truncate on table "public"."users" from "anon";

revoke update on table "public"."users" from "anon";

revoke delete on table "public"."users" from "authenticated";

revoke insert on table "public"."users" from "authenticated";

revoke references on table "public"."users" from "authenticated";

revoke select on table "public"."users" from "authenticated";

revoke trigger on table "public"."users" from "authenticated";

revoke truncate on table "public"."users" from "authenticated";

revoke update on table "public"."users" from "authenticated";

revoke delete on table "public"."users" from "service_role";

revoke insert on table "public"."users" from "service_role";

revoke references on table "public"."users" from "service_role";

revoke select on table "public"."users" from "service_role";

revoke trigger on table "public"."users" from "service_role";

revoke truncate on table "public"."users" from "service_role";

revoke update on table "public"."users" from "service_role";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


