import { describe, expect, it } from "vitest";
import { autorizado } from "./autorizar";

describe("autorizado", () => {
  const secreto = "un-secreto-largo-123";

  it("acepta Bearer con el secreto correcto", () => {
    expect(autorizado(`Bearer ${secreto}`, secreto)).toBe(true);
    expect(autorizado(`bearer ${secreto}`, secreto)).toBe(true);
  });

  it("rechaza un secreto equivocado, de otro largo o con espacios de más", () => {
    expect(autorizado("Bearer otro", secreto)).toBe(false);
    expect(autorizado(`Bearer ${secreto}x`, secreto)).toBe(false);
    expect(autorizado(`Bearer ${secreto.slice(0, -1)}`, secreto)).toBe(false);
    expect(autorizado(`Bearer  ${secreto}`, secreto)).toBe(false);
  });

  it("rechaza sin cabecera o con otro esquema", () => {
    expect(autorizado(null, secreto)).toBe(false);
    expect(autorizado("", secreto)).toBe(false);
    expect(autorizado(secreto, secreto)).toBe(false);
    expect(autorizado(`Basic ${secreto}`, secreto)).toBe(false);
    expect(autorizado("Bearer ", secreto)).toBe(false);
  });

  it("sin secreto configurado siempre es false", () => {
    expect(autorizado("Bearer ", undefined)).toBe(false);
    expect(autorizado("Bearer algo", undefined)).toBe(false);
    expect(autorizado("Bearer algo", "")).toBe(false);
    expect(autorizado(null, undefined)).toBe(false);
  });
});
