import { test } from "node:test";
import assert from "node:assert/strict";
import { montarPlano, nivelDoQuiz, proximoIdx, sequencia } from "../js/plano.js";
import { EXERCICIOS, ACADEMIAS_DEMO } from "../js/catalogo-seed.js";

const cat = {
  gyms: Object.fromEntries(ACADEMIAS_DEMO.map(g => [g.id, g])),
  ex: Object.fromEntries(EXERCICIOS.map(e => [e.id, e]))
};
const base = { objetivo: "hipertrofia", limites: [], gym_id: "smartfit", nivel_quiz: "intermediario", nivel_validado: null };

test("nível do quiz segue os cortes 4 / 8", () => {
  assert.equal(nivelDoQuiz({ 0: 0, 1: 1, 2: 1, 3: 1, 4: 1, 5: 0 }), "iniciante");
  assert.equal(nivelDoQuiz({ 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 2 }), "intermediario");
  assert.equal(nivelDoQuiz({ 0: 2, 1: 2, 2: 2, 3: 1, 4: 1, 5: 1 }), "avancado");
  assert.equal(nivelDoQuiz({ 0: 9, 1: -3 }), "iniciante"); // valores fora da faixa são travados em 0–2
});

test("nível validado pelo personal vence o do quiz", () => {
  assert.equal(montarPlano({ ...base, nivel_validado: "avancado" }, cat).length, 4);
  assert.equal(montarPlano(base, cat).length, 3);
});

test("academia sem Smith e sem abdutora troca os dois", () => {
  const c = montarPlano({ ...base, gym_id: "bairro" }, cat)[2].items.map(i => i.id);
  assert.ok(c.includes("goblet") && !c.includes("agach_smith"));
  assert.ok(c.includes("abd_elastico") && !c.includes("abdutora"));
});

test("limitação no joelho tira afundo e agachamento, sem repetir exercício", () => {
  const p = montarPlano({ ...base, limites: ["joelho"], nivel_validado: "avancado" }, cat);
  for (const t of p) {
    const ids = t.items.map(i => i.id);
    assert.equal(new Set(ids).size, ids.length, t.nome + " repetiu exercício");
    assert.ok(!ids.includes("afundo") && !ids.includes("agach_smith") && !ids.includes("goblet"));
  }
});

test("joelho + lombar + academia sem Smith ainda fecha o treino sem repetir", () => {
  const p = montarPlano({ ...base, limites: ["joelho", "lombar", "ombro"], gym_id: "bairro", nivel_validado: "avancado" }, cat);
  for (const t of p) {
    const ids = t.items.map(i => i.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.length >= 4, t.nome + " ficou curto demais: " + ids.length);
  }
});

test("objetivo muda séries, reps e descanso", () => {
  const f = montarPlano({ ...base, objetivo: "forca" }, cat)[0].items[0];
  assert.deepEqual([f.series, f.reps, f.rest], [4, "6 a 8", 120]);
});

test("fila de treinos e sequência de dias", () => {
  const p = montarPlano(base, cat);
  assert.equal(proximoIdx(p, []), 0);
  assert.equal(proximoIdx(p, [{ treino: "Treino C" }]), 0);
  assert.equal(proximoIdx(p, [{ treino: "Treino A" }]), 1);
  const hoje = new Date(2026, 10, 5, 10);
  const h = [new Date(2026, 10, 4, 9), new Date(2026, 10, 3, 9), new Date(2026, 10, 1, 9)].map(d => ({ created_at: d.toISOString() }));
  assert.equal(sequencia(h, hoje), 2);
});
