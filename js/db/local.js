/* Adaptador do MODO DEMONSTRAÇÃO: imita o Supabase dentro do navegador (localStorage).
   Serve pra apresentar sem servidor e pra testar o app. Reproduz as mesmas regras do
   banco (nível calculado, PAR-Q decide liberação, 18+, só personal valida).
   Contas de exemplo: aluno@demo.com / personal@demo.com — senha demo1234. */
import { EXERCICIOS, ACADEMIAS_DEMO } from "../catalogo-seed.js";
import { nivelDoQuiz } from "../plano.js";
import { montarCatalogo } from "./supabase.js";

const KEY = "mpc-demo-v1";
const dia = 864e5;
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now());
const iso = t => new Date(t).toISOString();
const clone = o => JSON.parse(JSON.stringify(o));
const espera = () => new Promise(r => setTimeout(r, 120)); // simula rede

let D = carregar();
const ouvintes = [];

function carregar() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.v === 1) return d; } catch (e) {}
  return semente();
}
function gravar() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} }

function perfilVazio(id, extra) {
  return Object.assign({ id, role: "aluno", nome: "", whatsapp: "", nascimento: null, cref: null, termos_aceitos_em: iso(Date.now()),
    objetivo: null, dias: null, limites: [], quiz: {}, nivel_quiz: null, nivel_validado: null, validado_por: null, validado_em: null,
    gym_id: null, unidade: null, onboarding_ok: false, created_at: iso(Date.now()), updated_at: iso(Date.now()) }, extra);
}

function semente() {
  const t = Date.now(), P = "demo-personal";
  const d = { v: 1, sessao: null, users: [], profiles: {}, screenings: [], logs: [], weights: [], requests: [],
    gyms: ACADEMIAS_DEMO.map(g => ({ ativo: true, ...clone(g) })),
    exercises: EXERCICIOS.map(e => ({ alt: null, video_url: null, ativo: true, ...clone(e) })), locs: [] };

  d.users.push({ id: P, email: "personal@demo.com", senha: "demo1234" });
  d.profiles[P] = perfilVazio(P, { role: "personal", nome: "Personal Demo", cref: "000000-G/ES", whatsapp: "", onboarding_ok: true });

  const alunos = [
    // nome, email, gym, quiz pts, validado, objetivo, dias, limites, parq sim?, liberado?, dias desde último, treinos 28d
    ["Juliana Souza", "aluno@demo.com", "smartfit", "intermediario", true, "hipertrofia", 4, ["joelho"], false, true, 1, 12],
    ["Mariana Costa", null, "smartfit", "iniciante", true, "emagrecimento", 3, [], false, true, 0, 11],
    ["Rafael Gomes", null, "bairro", "avancado", true, "forca", 5, [], false, true, 1, 17],
    ["Camila Rocha", null, "smartfit", "intermediario", true, "hipertrofia", 4, ["lombar"], false, true, 6, 6],
    ["Thiago Lima", null, "smartfit", "iniciante", true, "saude", 3, [], false, true, 9, 2],
    ["Patrícia Alves", null, "bairro", "intermediario", false, "saude", 3, ["ombro"], true, false, null, 0],
    ["Lucas Ferreira", null, "smartfit", "iniciante", false, "hipertrofia", 3, [], false, true, null, 0]
  ];
  const quizDe = { iniciante: { 0: 0, 1: 1, 2: 0, 3: 1, 4: 0, 5: 1 }, intermediario: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 2 }, avancado: { 0: 2, 1: 2, 2: 2, 3: 1, 4: 2, 5: 1 } };
  const nomesTreino = { iniciante: ["A", "B"], intermediario: ["A", "B", "C"], avancado: ["A", "B", "C", "D"] };
  alunos.forEach(([nome, email, gym, lv, valid, obj, dias, lim, sim, lib, ult, n28], k) => {
    const id = "demo-aluno-" + k;
    d.users.push({ id, email: email || "aluno" + k + "@demo.com", senha: "demo1234" });
    const g = d.gyms.find(x => x.id === gym);
    d.profiles[id] = perfilVazio(id, { nome, whatsapp: "2899999" + String(1000 + k), nascimento: "1994-05-1" + (k % 9),
      objetivo: obj, dias, limites: lim, quiz: quizDe[lv], nivel_quiz: lv, nivel_validado: valid ? lv : null,
      validado_por: valid ? P : null, validado_em: valid ? iso(t - 30 * dia) : null, gym_id: gym, unidade: g.unidades[0],
      onboarding_ok: true, created_at: iso(t - (valid ? 40 : 1) * dia) });
    const resp = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(i => [i, sim && i === 4]));
    d.screenings.push({ id: uuid(), user_id: id, respostas: resp, tem_sim: sim, consentimento_em: iso(t - 40 * dia),
      liberado: lib, liberado_por: sim && lib ? P : null, liberado_em: null, obs: null, created_at: iso(t - (valid ? 40 : 1) * dia) });
    if (ult !== null) {
      const letras = nomesTreino[lv];
      for (let j = 0; j < n28 + 4; j++) {
        const quando = t - (ult + Math.round(j * (26 / Math.max(n28, 1)))) * dia - 3600e3 * (j % 5);
        d.logs.push({ id: uuid(), user_id: id, treino: "Treino " + letras[(letras.length * 50 - j - 1) % letras.length], foco: "",
          gym_id: gym, exercicios_feitos: 6, exercicios_total: 6, duracao_min: 42 + (j * 7) % 15, rpe: 2 + (j % 3), series: [], created_at: iso(quando) });
      }
    }
    if (email) [[28, 68.4], [21, 67.9], [14, 67.5], [7, 67.2], [0, 66.8]].forEach(([dd, kgv]) =>
      d.weights.push({ id: uuid(), user_id: id, kg: kgv, created_at: iso(t - dd * dia) }));
  });
  d.requests.push({ id: uuid(), user_id: "demo-aluno-6", texto: "Academia Corpo em Forma, Aquidabã", status: "novo", created_at: iso(t - dia) });
  return d;
}

const eu = () => { if (!D.sessao) throw new Error("não autenticado"); return D.sessao; };
const ehPersonal = () => D.sessao && D.profiles[D.sessao] && D.profiles[D.sessao].role === "personal";
const exigePersonal = () => { if (!ehPersonal()) throw new Error("sem permissão"); };
const avisar = ev => ouvintes.forEach(cb => cb(ev));
const desc = arr => arr.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));

export const db = {
  demo: true,
  resetarDemo() { localStorage.removeItem(KEY); D = semente(); gravar(); },

  async sessao() { await espera(); return D.sessao ? { id: D.sessao, email: D.users.find(u => u.id === D.sessao).email } : null; },
  async aoMudarSessao(cb) { ouvintes.push(cb); },
  async cadastrar({ email, senha, nome, whatsapp, nascimento }) {
    await espera();
    email = email.trim().toLowerCase();
    if (D.users.some(u => u.email === email)) throw new Error("User already registered");
    if (senha.length < 8) throw new Error("Password should be at least 8 characters");
    if (nascimento && new Date(nascimento) > new Date(Date.now() - 18 * 365.25 * dia)) throw new Error("O app é só para maiores de 18 anos.");
    const id = uuid();
    D.users.push({ id, email, senha });
    D.profiles[id] = perfilVazio(id, { nome: nome.trim().slice(0, 80), whatsapp: String(whatsapp).replace(/\D/g, "").slice(0, 15), nascimento });
    D.sessao = id; gravar(); avisar("SIGNED_IN");
    return { precisaConfirmar: false };
  },
  async entrar(email, senha) {
    await espera();
    const u = D.users.find(x => x.email === email.trim().toLowerCase() && x.senha === senha);
    if (!u) throw new Error("Invalid login credentials");
    D.sessao = u.id; gravar(); avisar("SIGNED_IN");
  },
  async sair() { D.sessao = null; gravar(); avisar("SIGNED_OUT"); },
  async recuperarSenha() { await espera(); },
  async novaSenha() { await espera(); },

  async perfil() { await espera(); return clone(D.profiles[eu()]); },
  async salvarPerfil(patch) {
    await espera();
    const permitidas = ["nome", "whatsapp", "nascimento", "cref", "termos_aceitos_em", "objetivo", "dias", "limites", "quiz", "gym_id", "unidade", "onboarding_ok"];
    const p = D.profiles[eu()];
    for (const k of Object.keys(patch)) { if (!permitidas.includes(k)) throw new Error("permission denied for column " + k); p[k] = patch[k]; }
    p.nivel_quiz = Object.keys(p.quiz || {}).length ? nivelDoQuiz(p.quiz) : null;
    p.updated_at = iso(Date.now()); gravar();
    return clone(p);
  },
  async catalogo() {
    await espera();
    const ver = ehPersonal();
    return montarCatalogo(clone(D.gyms.filter(g => ver || g.ativo)).sort((a, b) => a.ordem - b.ordem),
      clone(D.exercises.filter(e => ver || e.ativo)), clone(D.locs));
  },
  async equipe() { return Object.values(D.profiles).filter(p => p.role === "personal").map(({ id, nome, cref, whatsapp }) => ({ id, nome, cref, whatsapp })); },
  async ultimoParq(userId) {
    const u = userId || eu(); if (u !== eu() && !ehPersonal()) return null;
    return clone(desc(D.screenings.filter(s => s.user_id === u))[0] || null);
  },
  async salvarParq(respostas) {
    await espera();
    const tem_sim = Object.values(respostas).some(v => v === true);
    const s = { id: uuid(), user_id: eu(), respostas, tem_sim, consentimento_em: iso(Date.now()), liberado: !tem_sim, liberado_por: null, liberado_em: null, obs: null, created_at: iso(Date.now()) };
    D.screenings.push(s); gravar(); return clone(s);
  },
  async treinos(userId) { const u = userId || eu(); return clone(desc(D.logs.filter(l => l.user_id === u))); },
  async registrarTreino(t) { await espera(); const l = { id: uuid(), ...t, user_id: eu(), created_at: iso(Date.now()) }; D.logs.push(l); gravar(); return clone(l); },
  async pesos(userId) { const u = userId || eu(); return clone(D.weights.filter(w => w.user_id === u).sort((a, b) => a.created_at.localeCompare(b.created_at))); },
  async registrarPeso(kg) {
    if (!(kg > 20 && kg < 300)) throw new Error("Peso fora da faixa");
    const w = { id: uuid(), user_id: eu(), kg: Math.round(kg * 10) / 10, created_at: iso(Date.now()) }; D.weights.push(w); gravar(); return clone(w);
  },
  async pedirAcademia(texto) { D.requests.push({ id: uuid(), user_id: eu(), texto: texto.slice(0, 200), status: "novo", created_at: iso(Date.now()) }); gravar(); },
  async retirarConsentimento() { const u = eu(); D.screenings = D.screenings.filter(s => s.user_id !== u); D.profiles[u].limites = []; gravar(); },
  async excluirConta() {
    const u = eu();
    D.users = D.users.filter(x => x.id !== u); delete D.profiles[u];
    for (const k of ["screenings", "logs", "weights"]) D[k] = D[k].filter(x => x.user_id !== u);
    D.requests.forEach(r => { if (r.user_id === u) r.user_id = null; });
    D.sessao = null; gravar(); avisar("SIGNED_OUT");
  },

  async painelAlunos() {
    exigePersonal(); await espera();
    const corte = Date.now() - 28 * dia;
    return Object.values(D.profiles).filter(p => p.role === "aluno").map(p => {
      const l = D.logs.filter(x => x.user_id === p.id), s = desc(D.screenings.filter(x => x.user_id === p.id))[0];
      return { ...clone(p), ultimo_treino: l.length ? desc(l)[0].created_at : null, treinos_28d: l.filter(x => +new Date(x.created_at) > corte).length,
        treinos_total: l.length, parq_id: s ? s.id : null, parq_sim: s ? s.tem_sim : null, parq_liberado: s ? s.liberado : null };
    }).sort((a, b) => a.nome.localeCompare(b.nome));
  },
  async aluno(id) {
    exigePersonal(); await espera();
    return { perfil: clone(D.profiles[id]), parq: await this.ultimoParq(id), treinos: await this.treinos(id), pesos: await this.pesos(id) };
  },
  async validarAluno(id, nivel) {
    exigePersonal();
    Object.assign(D.profiles[id], { nivel_validado: nivel, validado_por: D.sessao, validado_em: iso(Date.now()) }); gravar();
  },
  async liberarParq(id, obs) {
    exigePersonal();
    Object.assign(D.screenings.find(s => s.id === id), { liberado: true, liberado_por: D.sessao, liberado_em: iso(Date.now()), obs: obs || null }); gravar();
  },
  async pedidos() { exigePersonal(); return clone(desc(D.requests)); },
  async statusPedido(id, status) { exigePersonal(); D.requests.find(r => r.id === id).status = status; gravar(); },
  async salvarAcademia(g) {
    exigePersonal(); await espera();
    const i = D.gyms.findIndex(x => x.id === g.id);
    if (i >= 0) D.gyms[i] = { ...D.gyms[i], ...clone(g) }; else D.gyms.push({ ativo: true, ordem: D.gyms.length + 1, ...clone(g) });
    gravar();
  },
  async salvarExercicio(e) {
    exigePersonal(); await espera();
    const x = D.exercises.find(y => y.id === e.id);
    Object.assign(x, { nome: e.nome, grupo: e.grupo, dicas: e.dicas, video_url: e.video_url || null, ativo: e.ativo }); gravar();
  },
  async salvarLocal(exercise_id, gym_id, { video_url, descricao }) {
    exigePersonal();
    const i = D.locs.findIndex(l => l.exercise_id === exercise_id && l.gym_id === gym_id);
    const row = { exercise_id, gym_id, video_url: video_url || null, descricao: descricao || null };
    if (i >= 0) D.locs[i] = row; else D.locs.push(row);
    gravar();
  },
  async enviarVideo(arquivo) { exigePersonal(); return URL.createObjectURL(arquivo); } // demo: vale só enquanto a aba estiver aberta
};
