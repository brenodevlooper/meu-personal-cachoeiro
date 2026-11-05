// Gera supabase/seed.sql a partir de js/catalogo-seed.js (fonte única do catálogo inicial).
// Uso: node scripts/gerar-seed.mjs
import { writeFileSync } from "node:fs";
import { EXERCICIOS, ACADEMIAS } from "../js/catalogo-seed.js";

const q = v => v == null ? "null" : "'" + String(v).replace(/'/g, "''") + "'";
const arr = a => "array[" + (a || []).map(q).join(",") + "]::text[]";
const json = o => q(JSON.stringify(o || {})) + "::jsonb";

let sql = "-- GERADO por scripts/gerar-seed.mjs — não editar à mão.\n-- Catálogo inicial. Depois do lançamento quem edita é o personal, pelo painel.\n\n";
for (const g of ACADEMIAS) {
  sql += `insert into public.gyms (id, nome, sub, unidades, sem, zonas, ordem) values (${q(g.id)}, ${q(g.nome)}, ${q(g.sub)}, ${arr(g.unidades)}, ${arr(g.sem)}, ${json(g.zonas)}, ${g.ordem || 0}) on conflict (id) do nothing;\n`;
}
sql += "\n";
for (const e of EXERCICIOS) {
  sql += `insert into public.exercises (id, nome, grupo, zona, eq, icone, alt, dicas) values (${q(e.id)}, ${q(e.nome)}, ${q(e.grupo)}, ${q(e.zona)}, ${q(e.eq)}, ${q(e.icone)}, ${q(e.alt)}, ${arr(e.dicas)}) on conflict (id) do nothing;\n`;
}
writeFileSync(new URL("../supabase/seed.sql", import.meta.url), sql);
console.log("seed.sql:", ACADEMIAS.length, "academias,", EXERCICIOS.length, "exercícios");
