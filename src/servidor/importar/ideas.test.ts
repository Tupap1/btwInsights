import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatoDeTexto, leerIdeas } from "./ideas";

const leer = (n: string) => readFileSync(`pruebas/fixtures/btw-videos/guiones/${n}`, "utf8");

describe("leerIdeas: tabla de ideas-2026-11-05.md", () => {
  const { ideas, avisos } = leerIdeas(leer("ideas-2026-11-05.md"), "ideas-2026-11-05.md");

  it("da 12 ideas, sin avisos", () => {
    expect(ideas).toHaveLength(12);
    expect(avisos).toEqual([]);
  });
  it("la 4 tiene 12 (con negritas) y la 2 tiene 11 (con texto entre paréntesis)", () => {
    expect(ideas[3]?.puntaje).toBe(12);
    expect(ideas[1]?.puntaje).toBe(11);
    expect(ideas.map((i) => i.puntaje)).toEqual([11, 11, 10, 12, 10, 10, 10, 11, 10, 9, 10, 11]);
  });
  it("fuente estable por número de fila", () => {
    expect(ideas[0]?.fuente).toBe("ideas-2026-11-05.md#1");
    expect(ideas[11]?.fuente).toBe("ideas-2026-11-05.md#12");
  });
  it("título, gancho y función de BTWash", () => {
    expect(ideas[3]?.titulo).toBe("¿Cuánto tienes en la mano?");
    expect(ideas[3]?.gancho).toContain("Vendiste setecientos quince mil hoy");
    expect(ideas[3]?.funcionBtwash).toBe("Cierre de caja por método y cartera");
  });
  it("mapea el formato y guarda el original si es 'otro'", () => {
    expect(ideas[0]?.formato).toBe("plata_3d");
    expect(ideas[1]?.formato).toBe("prueba_real");
    expect(ideas[5]?.formato).toBe("dialogo");
    expect(ideas[6]?.formato).toBe("pantalla_dividida");
    expect(ideas[4]?.formato).toBe("otro");
    expect(ideas[4]?.titulo).toBe("La semana libre (formato: Mito)");
    expect(ideas[11]?.titulo).toBe("Subir a $30.000, ¿pierdes clientes? (formato: Mito, con cuentas)");
  });
  it("estado inicial nueva", () => {
    expect(ideas.every((i) => i.estado === "nueva")).toBe(true);
  });
});

describe("leerIdeas: encabezados de ideas-imagina-que-eres.md", () => {
  const { ideas } = leerIdeas(leer("ideas-imagina-que-eres.md"), "ideas-imagina-que-eres.md");
  it("da una idea por encabezado, sin puntaje", () => {
    expect(ideas.map((i) => i.fuente)).toEqual(["ideas-imagina-que-eres.md#A", "ideas-imagina-que-eres.md#B"]);
    expect(ideas[0]?.titulo).toBe("Imagina que tienes un lavadero… ¿qué haces?");
    expect(ideas.every((i) => i.puntaje === null && i.gancho === null && i.estado === "nueva")).toBe(true);
  });
});

describe("leerIdeas: casos raros", () => {
  it("encuentra las columnas por nombre, sin depender del orden", () => {
    const t = "| Puntaje | Idea | # | Formato |\n|---|---|---|---|\n| 7/12 | Hola | 3 | La cuenta |\n";
    const { ideas } = leerIdeas(t, "x.md");
    expect(ideas).toMatchObject([{ fuente: "x.md#3", titulo: "Hola", puntaje: 7, formato: "la_cuenta", gancho: null }]);
  });
  it("un puntaje que no es N/12 da null y un aviso", () => {
    const t = "| # | Idea | Puntaje |\n|---|---|---|\n| 1 | Hola | mucho |\n";
    const r = leerIdeas(t, "x.md");
    expect(r.ideas[0]?.puntaje).toBeNull();
    expect(r.avisos).toHaveLength(1);
  });
  it("un puntaje fuera de 0 a 12 se descarta", () => {
    const t = "| # | Idea | Puntaje |\n|---|---|---|\n| 1 | Hola | 15/12 |\n";
    expect(leerIdeas(t, "x.md").ideas[0]?.puntaje).toBeNull();
  });
  it("texto sin ideas da lista vacía", () => {
    expect(leerIdeas("# Nada\n\nSolo texto.", "x.md").ideas).toEqual([]);
  });
});

describe("formatoDeTexto", () => {
  it.each([
    ["Plata en 3D", "plata_3d"],
    ["Diálogo en texto", "dialogo"],
    ["Prueba real con recuadro sobre el lavado", "prueba_real"],
    ["Pantalla dividida", "pantalla_dividida"],
    ["La cuenta", "la_cuenta"],
    ["Mito", "otro"],
    ["", null],
  ])("%s -> %s", (t, f) => expect(formatoDeTexto(t)).toBe(f));
});
