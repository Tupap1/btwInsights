CREATE TYPE "public"."tipo_desafio" AS ENUM('registro', 'entrada');--> statement-breakpoint
CREATE TABLE "credencial" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"clave_publica" text NOT NULL,
	"contador" bigint DEFAULT 0 NOT NULL,
	"transportes" text[],
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"usada_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "desafio" (
	"id" text PRIMARY KEY NOT NULL,
	"reto" text NOT NULL,
	"tipo" "tipo_desafio" NOT NULL,
	"usuario_id" integer,
	"expira_en" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitacion" (
	"hash" text PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"usada_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sesion" (
	"hash" text PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"usada_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "usuario_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"id_webauthn" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_nombre_unique" UNIQUE("nombre"),
	CONSTRAINT "usuario_idWebauthn_unique" UNIQUE("id_webauthn")
);
--> statement-breakpoint
ALTER TABLE "credencial" ADD CONSTRAINT "credencial_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desafio" ADD CONSTRAINT "desafio_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitacion" ADD CONSTRAINT "invitacion_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesion" ADD CONSTRAINT "sesion_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credencial_usuario_idx" ON "credencial" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "invitacion_usuario_idx" ON "invitacion" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "sesion_usuario_idx" ON "sesion" USING btree ("usuario_id");