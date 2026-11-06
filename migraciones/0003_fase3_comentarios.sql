CREATE TABLE "comentario" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "comentario_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"publicacion_id" integer NOT NULL,
	"red" "red" NOT NULL,
	"id_plataforma" text NOT NULL,
	"padre_id_plataforma" text,
	"texto" text NOT NULL,
	"autor_usuario" text,
	"es_propio" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone,
	"me_gusta" integer,
	"respuestas" integer,
	"oculto" boolean DEFAULT false NOT NULL,
	"enlace" text,
	"leido_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"desaparecio_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "hilo_comentarios" (
	"publicacion_id" integer PRIMARY KEY NOT NULL,
	"conteo_fuente" integer,
	"completo" boolean NOT NULL,
	"leido_en" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comentario" ADD CONSTRAINT "comentario_publicacion_id_publicacion_id_fk" FOREIGN KEY ("publicacion_id") REFERENCES "public"."publicacion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hilo_comentarios" ADD CONSTRAINT "hilo_comentarios_publicacion_id_publicacion_id_fk" FOREIGN KEY ("publicacion_id") REFERENCES "public"."publicacion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "comentario_red_id_unico" ON "comentario" USING btree ("red","id_plataforma");--> statement-breakpoint
CREATE INDEX "comentario_publicacion_idx" ON "comentario" USING btree ("publicacion_id");