/* Monta o treino do aluno: nível → divisão; limitação → troca; academia sem aparelho → troca.
   Função pura (sem DOM, sem banco) — testada em tests/plano.test.mjs. */
import { TEMPLATES, LIMITS, GOALS } from "./regras.js";

/** Nível que vale: o validado pelo personal; senão o sugerido pelo quiz. */
export function nivelAtual(p) {
  return p.nivel_validado || p.nivel_quiz || "iniciante";
}

/** Mesmo cálculo do banco (nivel_do_quiz) — usado pra mostrar o resultado na hora. */
export function nivelDoQuiz(quiz) {
  const pts = Object.values(quiz || {}).reduce((a, v) => a + Math.min(2, Math.max(0, +v || 0)), 0);
  return pts <= 4 ? "iniciante" : pts <= 8 ? "intermediario" : "avancado";
}

const motivoLimite = l => "por causa " + (l === "lombar" ? "da lombar" : "do " + l);

/**
 * @param p   perfil: { objetivo, limites[], gym_id, nivel_quiz, nivel_validado }
 * @param cat catálogo: { gyms: {id: gym}, ex: {id: exercise} }
 */
export function montarPlano(p, cat) {
  const lv = nivelAtual(p);
  const gym = cat.gyms[p.gym_id] || { sem: [] };
  const goal = GOALS[p.objetivo] || GOALS.saude;
  const [series, reps] = goal.s[lv];
  const sem = new Set(gym.sem || []);
  const limites = p.limites || [];

  return TEMPLATES[lv].map(t => {
    const usados = new Set();
    const items = [];
    for (const id of t.ex) {
      let cur = id, motivo = "";
      for (const l of limites) {
        const ops = LIMITS[l] && LIMITS[l][cur];
        if (ops) {
          // primeira opção que não repete exercício do mesmo treino
          cur = ops.find(o => !t.ex.includes(o) && !usados.has(o)) || ops.find(o => !usados.has(o)) || ops[0];
          motivo = motivoLimite(l);
        }
      }
      const e = cat.ex[cur];
      if (e && sem.has(e.eq)) {
        const alt = e.alt && cat.ex[e.alt];
        if (alt && !sem.has(alt.eq)) { motivo = "sua academia não tem " + e.nome.toLowerCase(); cur = alt.id; }
        else motivo = motivo || "confira o aparelho com o personal";
      }
      if (!cat.ex[cur] || usados.has(cur)) continue; // exercício desativado ou repetido: sai do treino
      usados.add(cur);
      items.push({ id: cur, orig: id, motivo: cur !== id || motivo.startsWith("confira") ? motivo : "", series, reps: cur === "prancha" ? "30 a 45 s" : reps, rest: goal.rest });
    }
    return { nome: t.nome, foco: t.foco, items };
  });
}

/** Próximo treino da fila: o que vem depois do último feito. */
export function proximoIdx(plano, historico) {
  if (!historico.length) return 0;
  const i = plano.findIndex(t => t.nome === historico[0].treino);
  return (i + 1) % plano.length;
}

/** Onde fica o exercício na academia do aluno (descrição da loc > zona da academia). */
export function ondeFica(e, gym) {
  const loc = e.loc && e.loc[gym.id];
  return (loc && loc.descricao) || (gym.zonas && gym.zonas[e.zona]) || "";
}

/** Dias seguidos com treino (hoje conta se já treinou; senão começa de ontem). */
export function sequencia(historico, agora = new Date()) {
  const dia = 864e5, base = new Date(agora); base.setHours(0, 0, 0, 0);
  const dias = new Set(historico.map(h => { const d = new Date(h.created_at); d.setHours(0, 0, 0, 0); return +d; }));
  let n = 0;
  for (let d = +base; ; d -= dia) {
    if (dias.has(d)) n++; else if (d !== +base) break;
    if (n > 365) break;
  }
  return n;
}
