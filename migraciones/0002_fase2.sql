ALTER TABLE "publicacion" ADD COLUMN "marca_ia" boolean;--> statement-breakpoint
CREATE UNIQUE INDEX "idea_fuente_unica" ON "idea" USING btree ("fuente");