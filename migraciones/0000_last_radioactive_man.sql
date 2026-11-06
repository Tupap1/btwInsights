CREATE TYPE "public"."emparejado_por" AS ENUM('id', 'etiqueta', 'fecha_texto', 'manual');--> statement-breakpoint
CREATE TYPE "public"."estado_corrida" AS ENUM('en_curso', 'ok', 'parcial', 'error', 'abandonada');--> statement-breakpoint
CREATE TYPE "public"."estado_publicacion" AS ENUM('borrador', 'pendiente_aprobacion', 'programado', 'publicando', 'publicado', 'parcial', 'fallido', 'cancelado', 'borrado');--> statement-breakpoint
CREATE TYPE "public"."estado_reel" AS ENUM('idea', 'guion', 'produccion', 'listo', 'archivado');--> statement-breakpoint
CREATE TYPE "public"."formato" AS ENUM('la_cuenta', 'dialogo', 'prueba_real', 'plata_3d', 'pantalla_dividida', 'otro');--> statement-breakpoint
CREATE TYPE "public"."fuente" AS ENUM('meta', 'zernio', 'manual');--> statement-breakpoint
CREATE TYPE "public"."nivel_alerta" AS ENUM('info', 'aviso', 'error');--> statement-breakpoint
CREATE TYPE "public"."origen_corrida" AS ENUM('cli', 'http', 'boton');--> statement-breakpoint
CREATE TYPE "public"."origen_publicacion" AS ENUM('zernio', 'meta', 'manual');--> statement-breakpoint
CREATE TYPE "public"."red" AS ENUM('tiktok', 'instagram', 'facebook');--> statement-breakpoint
CREATE TYPE "public"."via" AS ENUM('api', 'csv', 'timeline', 'captura');--> statement-breakpoint
CREATE TYPE "public"."voz" AS ENUM('fernando', 'andres', 'andres_voice_changer', 'sin_voz', 'otra');--> statement-breakpoint
CREATE TABLE "alerta" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "alerta_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"clave" text NOT NULL,
	"tipo" text NOT NULL,
	"nivel" "nivel_alerta" DEFAULT 'aviso' NOT NULL,
	"mensaje" text NOT NULL,
	"reel_id" text,
	"publicacion_id" integer,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"resuelta_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "corrida" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "corrida_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"origen" "origen_corrida" NOT NULL,
	"estado" "estado_corrida" DEFAULT 'en_curso' NOT NULL,
	"iniciada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"terminada_en" timestamp with time zone,
	"resumen" jsonb,
	"errores" jsonb
);
--> statement-breakpoint
CREATE TABLE "cuenta_lectura" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cuenta_lectura_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"red" "red" NOT NULL,
	"cuenta" text NOT NULL,
	"fuente" "fuente" NOT NULL,
	"leido_en" timestamp with time zone NOT NULL,
	"seguidores" integer,
	"publicaciones" integer
);
--> statement-breakpoint
CREATE TABLE "curva_retencion" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "curva_retencion_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"publicacion_id" integer NOT NULL,
	"fuente" "fuente" NOT NULL,
	"leido_en" timestamp with time zone NOT NULL,
	"dato_actualizado_en" timestamp with time zone NOT NULL,
	"puntos" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idea" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "idea_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"titulo" text NOT NULL,
	"gancho" text,
	"formato" "formato",
	"funcion_btwash" text,
	"verificada_en_codigo" boolean DEFAULT false NOT NULL,
	"puntaje" integer,
	"estado" text DEFAULT 'nueva' NOT NULL,
	"fuente" text,
	"reel_id" text,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lead_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"fecha" date NOT NULL,
	"canal" text NOT NULL,
	"reel_id" text,
	"nota" text,
	"resultado" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lectura" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lectura_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"publicacion_id" integer NOT NULL,
	"fuente" "fuente" NOT NULL,
	"via" "via" NOT NULL,
	"leido_en" timestamp with time zone NOT NULL,
	"dato_actualizado_en" timestamp with time zone NOT NULL,
	"horas_desde_publicacion" double precision,
	"vistas" integer,
	"alcance" integer,
	"me_gusta" integer,
	"comentarios" integer,
	"compartidos" integer,
	"guardados" integer,
	"seguidores_ganados" integer,
	"visitas_perfil" integer,
	"interacciones" integer,
	"reproducciones_con_repeticion" integer,
	"completos" integer,
	"reacciones" jsonb,
	"tiempo_promedio_s" double precision,
	"tiempo_total_s" double precision,
	"pct_completo" double precision,
	"pct_salta3s" double precision,
	"ret1s" double precision,
	"ret3s" double precision,
	"ret5s" double precision,
	"ret10s" double precision,
	"pct_para_ti" double precision,
	"pct_busqueda" double precision,
	"pct_no_seguidores" double precision,
	"pais_principal" text,
	"pais_principal_pct" double precision,
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publicacion" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "publicacion_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"reel_id" text,
	"red" "red" NOT NULL,
	"cuenta" text,
	"post_id_plataforma" text,
	"zernio_post_id" text,
	"etiquetas" text[] DEFAULT '{}'::text[] NOT NULL,
	"enlace" text,
	"texto" text,
	"duracion_s" double precision,
	"programado_para" timestamp with time zone,
	"publicado_en" timestamp with time zone,
	"estado" "estado_publicacion" NOT NULL,
	"origen" "origen_publicacion" NOT NULL,
	"emparejado_por" "emparejado_por",
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reel" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text,
	"carpeta" text,
	"gancho" text,
	"formato" "formato",
	"formato_detalle" text,
	"voz" "voz",
	"voz_detalle" text,
	"etiqueta_ia" boolean,
	"duracion_s" double precision,
	"puntaje_guion" integer,
	"variables_probadas" text,
	"guion" text,
	"texto_tiktok" text,
	"texto_meta" text,
	"comentario_fijado" text,
	"avisos" text[] DEFAULT '{}'::text[] NOT NULL,
	"fecha_plan" date,
	"estado" "estado_reel" DEFAULT 'idea' NOT NULL,
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_reel_id_reel_id_fk" FOREIGN KEY ("reel_id") REFERENCES "public"."reel"("id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_publicacion_id_publicacion_id_fk" FOREIGN KEY ("publicacion_id") REFERENCES "public"."publicacion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curva_retencion" ADD CONSTRAINT "curva_retencion_publicacion_id_publicacion_id_fk" FOREIGN KEY ("publicacion_id") REFERENCES "public"."publicacion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea" ADD CONSTRAINT "idea_reel_id_reel_id_fk" FOREIGN KEY ("reel_id") REFERENCES "public"."reel"("id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_reel_id_reel_id_fk" FOREIGN KEY ("reel_id") REFERENCES "public"."reel"("id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lectura" ADD CONSTRAINT "lectura_publicacion_id_publicacion_id_fk" FOREIGN KEY ("publicacion_id") REFERENCES "public"."publicacion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicacion" ADD CONSTRAINT "publicacion_reel_id_reel_id_fk" FOREIGN KEY ("reel_id") REFERENCES "public"."reel"("id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "alerta_abierta_unica" ON "alerta" USING btree ("clave") WHERE "alerta"."resuelta_en" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "corrida_una_en_curso" ON "corrida" USING btree ("estado") WHERE "corrida"."estado" = 'en_curso';--> statement-breakpoint
CREATE UNIQUE INDEX "cuenta_lectura_unica" ON "cuenta_lectura" USING btree ("red","cuenta","fuente","leido_en");--> statement-breakpoint
CREATE UNIQUE INDEX "curva_unica" ON "curva_retencion" USING btree ("publicacion_id","fuente","dato_actualizado_en");--> statement-breakpoint
CREATE UNIQUE INDEX "lectura_unica" ON "lectura" USING btree ("publicacion_id","fuente","via","dato_actualizado_en");--> statement-breakpoint
CREATE INDEX "lectura_publicacion_idx" ON "lectura" USING btree ("publicacion_id","dato_actualizado_en");--> statement-breakpoint
CREATE UNIQUE INDEX "publicacion_red_post_unico" ON "publicacion" USING btree ("red","post_id_plataforma");--> statement-breakpoint
CREATE UNIQUE INDEX "publicacion_zernio_unico" ON "publicacion" USING btree ("zernio_post_id");--> statement-breakpoint
CREATE INDEX "publicacion_reel_idx" ON "publicacion" USING btree ("reel_id");