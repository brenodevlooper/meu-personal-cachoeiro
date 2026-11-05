/* =========================================================
   Meu Personal Cachoeiro — app do aluno + roteamento geral.
   Renderização por string + delegação de eventos:
     data-a="acao" (clique) · data-s="acao" (submit de form)
     data-f="campo" (input → S.form) · data-r="campo" (input → rascunho)
   ========================================================= */
import { CONFIG } from "./config.js";
import { db } from "./db/index.js";
import { LEVELS, LEVEL_KEYS, GOALS, PARQ, QUIZ, RPE, LIMIT_OPTS } from "./regras.js";
import { montarPlano, nivelAtual, nivelDoQuiz, proximoIdx, ondeFica, sequencia } from "./plano.js";
import { esc, primeiro, so_digitos, waLink, fmtData, kg, toast, msgErro, contar, alternarTema, I } from "./ui.js";
import { painel } from "./painel.js";

const $app = document.getElementById("app");
export const S = {
  sessao: null, perfil: null, cat: null, equipe: [], parq: null, treinos: [], pesos: [],
  tela: "welcome", ob: null, obQuiz: 0, rasc: {}, tab: "home", treino: 0, detalhe: null,
  sheet: null, sel: {}, form: {}, erro: "", ocupado: false, sets: { k: {}, cargas: {}, reps: {}, inicio: null }
};
export const A = {};       // ações de clique/submit (o painel acrescenta as dele)
const OB = ["consent", "parq", "quiz", "goal", "dias", "limits", "gym", "result"];

/* ---------- persistência local por usuário (rascunho do onboarding e séries em andamento) ---------- */
const lk = n => "mpc-" + n + "-" + (S.sessao ? S.sessao.id : "x");
const lget = n => { try { return JSON.parse(localStorage.getItem(lk(n))); } catch (e) { return null; } };
const lset = (n, v) => { try { localStorage.setItem(lk(n), JSON.stringify(v)); } catch (e) {} };
const salvarRasc = () => lset("rasc", S.rasc);
const salvarSets = () => lset("sets", S.sets);

/* ---------- carga de dados ---------- */
async function carregar() {
  S.sessao = await db.sessao();
  if (!S.sessao) { S.perfil = null; return; }
  S.perfil = await db.perfil();
  const [cat, equipe] = await Promise.all([db.catalogo(), db.equipe()]);
  S.cat = cat; S.equipe = equipe;
  document.body.classList.toggle("painel-on", S.perfil.role === "personal");
  if (S.perfil.role === "personal") return painel.abrir();
  const [parq, treinos, pesos] = await Promise.all([db.ultimoParq(), db.treinos(), db.pesos()]);
  S.parq = parq; S.treinos = treinos; S.pesos = pesos;
  S.rasc = lget("rasc") || {};
  S.sets = lget("sets") || { k: {}, cargas: {}, reps: {}, inicio: null };
  if (!S.parq) S.ob = S.ob === "parq" ? "parq" : "consent";
  else if (!S.perfil.onboarding_ok) { S.ob = S.ob && OB.indexOf(S.ob) > 1 ? S.ob : "quiz"; prepararRasc(); }
  else S.ob = null;
}
function prepararRasc() {
  const p = S.perfil;
  S.rasc = Object.assign({ quiz: p.quiz || {}, objetivo: p.objetivo, dias: p.dias || 3, limites: p.limites || [], gym_id: p.gym_id, unidade: p.unidade }, lget("rasc") || {});
}

/* ---------- helpers de domínio ---------- */
const gymAtual = () => (S.cat && S.cat.gyms[S.perfil.gym_id]) || { id: "", nome: "sua academia", zonas: {}, sem: [], unidades: [] };
const plano = () => montarPlano(S.perfil, S.cat);
const validador = () => S.equipe.find(e => e.id === S.perfil.validado_por) || null;
const personal = () => validador() || S.equipe[0] || null;
const waPersonal = () => (personal() && personal().whatsapp) || CONFIG.whatsappContato || "";
function statusTreino() {
  if (!S.parq) return "sem_parq";
  if (S.parq.tem_sim && !S.parq.liberado) return "parq";
  if (CONFIG.exigirValidacao && !S.perfil.nivel_validado) return "validacao";
  return "ok";
}
const setKey = (tn, x, k) => tn + "|" + x.id + "|" + k;
const exFeito = (tn, x) => { for (let k = 0; k < x.series; k++) if (!S.sets.k[setKey(tn, x, k)]) return false; return true; };
function ultimaCarga(exId, k) {
  for (const t of S.treinos) { const s = (t.series || []).find(z => z.ex === exId); if (s && s.cargas && s.cargas[k]) return s.cargas[k]; }
  return "";
}
function botaoWa(msg, rot = "Falar com o personal", cls = "btn wa") {
  const n = waPersonal();
  return n ? `<a class="${cls}" target="_blank" rel="noopener" href="${esc(waLink(n, msg))}">${I.wa}${rot}</a>`
           : `<button type="button" class="${cls}" data-a="semWa">${I.wa}${rot}</button>`;
}
A.semWa = () => toast("O WhatsApp do personal ainda não foi cadastrado.");

/* =========================================================
   TELAS SEM LOGIN
   ========================================================= */
function vWelcome() {
  return `<div class="view ob fade-in"><div class="blob"></div>
  <div class="logo"><span class="mk">${I.dumb}</span>${esc(CONFIG.app)}</div>
  <div class="hero"><span class="eyebrow">Para quem já treina em academia</span>
  <h1>Seu treino montado <span>pra sua academia.</span></h1>
  <p class="muted">Responde umas perguntas, escolhe onde você treina e recebe o treino com vídeo de cada exercício e de onde fica cada aparelho. Com um personal com CREF no seu WhatsApp.</p>
  <div class="feat"><span class="chip">🎥 Vídeo de cada exercício</span><span class="chip">📍 Aparelho da sua academia</span><span class="chip">💬 Personal no WhatsApp</span></div>
  <button type="button" class="btn" data-a="tela" data-v="cadastro">Montar meu treino</button>
  <button type="button" class="btn ghost" style="margin-top:10px" data-a="tela" data-v="entrar">Já tenho conta</button>
  ${db.demo ? `<div class="card" style="margin-top:16px"><span class="eyebrow">Modo demonstração</span>
    <p class="small muted" style="margin:6px 0 12px">Sem servidor ligado: os dados ficam só neste navegador.</p>
    <div class="row2"><button type="button" class="btn sm ghost" style="width:100%" data-a="demoEntrar" data-v="aluno@demo.com">Aluno de exemplo</button>
    <button type="button" class="btn sm ghost" style="width:100%" data-a="demoEntrar" data-v="personal@demo.com">Painel do personal</button></div>
    <button type="button" class="link small" style="margin-top:12px" data-a="demoReset">Zerar demonstração</button></div>` : ""}
  </div></div>`;
}
function topoVoltar(dest = "welcome") {
  return `<div class="top"><button type="button" class="iconbtn" data-a="tela" data-v="${dest}" aria-label="Voltar">${I.back}</button><span></span></div>`;
}
const campo = (id, rot, attrs = "") => `<div class="field"><label for="f-${id}">${rot}</label><input id="f-${id}" data-f="${id}" value="${esc(S.form[id] || "")}" ${attrs}></div>`;
const erro = () => S.erro ? `<p class="err" role="alert">${esc(S.erro)}</p>` : "";

function vEntrar() {
  return `<div class="view ob fade-in">${topoVoltar()}
  <div class="q"><h2>Bom te ver de novo</h2><p class="muted">Entre com o e-mail e a senha do cadastro.</p></div>
  <form data-s="entrar" style="margin-top:22px" novalidate>
  ${campo("email", "E-mail", 'type="email" autocomplete="email" inputmode="email" required')}
  ${campo("senha", "Senha", 'type="password" autocomplete="current-password" required')}
  ${erro()}
  <button class="btn" ${S.ocupado ? "disabled" : ""}>${S.ocupado ? "Entrando…" : "Entrar"}</button>
  </form>
  <button type="button" class="link small" style="margin-top:16px;align-self:center" data-a="tela" data-v="recuperar">Esqueci minha senha</button>
  <div class="spacer"></div>
  <button type="button" class="btn ghost" data-a="tela" data-v="cadastro">Criar conta</button></div>`;
}
function vCadastro() {
  const max = new Date(Date.now() - 18 * 365.25 * 864e5).toISOString().slice(0, 10);
  return `<div class="view ob fade-in">${topoVoltar()}
  <div class="q"><h2>Prazer! Vamos criar sua conta</h2><p class="muted">O personal usa seu WhatsApp pra te acompanhar.</p></div>
  <form data-s="cadastrar" style="margin-top:22px" novalidate>
  ${campo("nome", "Seu nome", 'autocomplete="name" maxlength="80" required')}
  ${campo("whatsapp", "WhatsApp", 'type="tel" inputmode="tel" autocomplete="tel" placeholder="(28) 9 9999-9999" required')}
  ${campo("nascimento", "Data de nascimento", `type="date" max="${max}" required`)}
  ${campo("email", "E-mail", 'type="email" autocomplete="email" inputmode="email" required')}
  ${campo("senha", "Senha (mínimo 8 caracteres)", 'type="password" autocomplete="new-password" minlength="8" required')}
  <label class="check" style="margin:4px 0 16px"><input type="checkbox" data-f="termos" ${S.form.termos ? "checked" : ""}>
  <span>Tenho 18 anos ou mais e li e aceito os <a class="link" href="termos.html" target="_blank">Termos de Uso</a> e a <a class="link" href="privacidade.html" target="_blank">Política de Privacidade</a>.</span></label>
  ${erro()}
  <button class="btn" ${S.ocupado ? "disabled" : ""}>${S.ocupado ? "Criando…" : "Criar conta"}</button></form></div>`;
}
function vConfirmar() {
  return `<div class="view ob fade-in">${topoVoltar("entrar")}
  <div class="q"><h2>Confirme seu e-mail</h2><p class="muted">Mandamos um link para <b>${esc(S.form.email)}</b>. Abra o e-mail, toque no link e depois entre com sua senha.</p></div>
  <div class="spacer"></div><button type="button" class="btn" data-a="tela" data-v="entrar">Já confirmei, entrar</button></div>`;
}
function vRecuperar() {
  return `<div class="view ob fade-in">${topoVoltar("entrar")}
  <div class="q"><h2>Esqueceu a senha?</h2><p class="muted">A gente manda um link pro seu e-mail pra criar uma nova.</p></div>
  <form data-s="recuperar" style="margin-top:22px" novalidate>${campo("email", "E-mail", 'type="email" autocomplete="email" required')}${erro()}
  <button class="btn" ${S.ocupado ? "disabled" : ""}>Enviar link</button></form></div>`;
}
function vNovaSenha() {
  return `<div class="view ob fade-in"><div class="q"><h2>Crie sua nova senha</h2></div>
  <form data-s="novaSenha" style="margin-top:22px" novalidate>${campo("senha", "Nova senha (mínimo 8 caracteres)", 'type="password" autocomplete="new-password" minlength="8" required')}${erro()}
  <button class="btn" ${S.ocupado ? "disabled" : ""}>Salvar senha</button></form></div>`;
}

A.tela = v => { S.tela = v; S.erro = ""; render(); };
async function tentar(fn) {
  S.ocupado = true; S.erro = ""; render();
  try { await fn(); } catch (e) { S.erro = msgErro(e); }
  S.ocupado = false; render();
}
A.entrar = () => tentar(async () => {
  if (!S.form.email || !S.form.senha) throw new Error("Preencha e-mail e senha.");
  await db.entrar(S.form.email, S.form.senha);
  S.form = {}; await carregar();
});
A.cadastrar = () => tentar(async () => {
  const f = S.form, idade = f.nascimento ? (Date.now() - new Date(f.nascimento)) / (365.25 * 864e5) : 0;
  if ((f.nome || "").trim().length < 2) throw new Error("Escreva seu nome.");
  if (so_digitos(f.whatsapp).length < 10) throw new Error("WhatsApp com DDD, por favor.");
  if (!f.nascimento) throw new Error("Informe sua data de nascimento.");
  if (idade < 18) throw new Error("O app é só para maiores de 18 anos.");
  if (!/^\S+@\S+\.\S+$/.test(f.email || "")) throw new Error("E-mail inválido.");
  if ((f.senha || "").length < 8) throw new Error("Senha fraca: use pelo menos 8 caracteres.");
  if (!f.termos) throw new Error("Para continuar, aceite os Termos e a Política de Privacidade.");
  const r = await db.cadastrar({ email: f.email.trim(), senha: f.senha, nome: f.nome.trim(), whatsapp: so_digitos(f.whatsapp), nascimento: f.nascimento });
  if (r.precisaConfirmar) { S.tela = "confirmar"; return; }
  S.form = {}; await carregar();
});
A.recuperar = () => tentar(async () => {
  if (!/^\S+@\S+\.\S+$/.test(S.form.email || "")) throw new Error("E-mail inválido.");
  await db.recuperarSenha(S.form.email.trim());
  toast("Se esse e-mail tiver conta, o link chega em instantes."); S.tela = "entrar";
});
A.novaSenha = () => tentar(async () => {
  if ((S.form.senha || "").length < 8) throw new Error("Senha fraca: use pelo menos 8 caracteres.");
  await db.novaSenha(S.form.senha); S.form = {}; toast("Senha nova salva."); history.replaceState(null, "", location.pathname); S.tela = "welcome";
  await carregar();
});
A.demoEntrar = v => tentar(async () => { await db.entrar(v, "demo1234"); await carregar(); });
A.demoReset = () => { db.resetarDemo(); toast("Demonstração zerada."); render(); };
A.sair = async () => { await db.sair(); Object.assign(S, { sessao: null, perfil: null, ob: null, tab: "home", detalhe: null, sheet: null, tela: "welcome" }); document.body.classList.remove("painel-on"); render(); };

/* =========================================================
   ONBOARDING (saúde + quiz + preferências)
   ========================================================= */
function prog() { const i = OB.indexOf(S.ob); return `<div class="prog">${OB.slice(0, -1).map((_, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div>`; }
function obTop() {
  const i = OB.indexOf(S.ob);
  return `<div class="top"><button type="button" class="iconbtn" data-a="obVoltar" aria-label="Voltar">${I.back}</button><span class="eyebrow">${i + 1} de ${OB.length - 1}</span><button type="button" class="iconbtn" data-a="sair" aria-label="Sair">${I.out}</button></div>`;
}
const irOb = s => { S.ob = s; render(); scrollTo(0, 0); };
A.obVoltar = () => {
  if (S.ob === "quiz" && S.obQuiz > 0) { S.obQuiz--; return render(); }
  const i = OB.indexOf(S.ob);
  if (i <= 0 || (S.parq && i <= 2)) { if (S.perfil.onboarding_ok && S.parq) { S.ob = null; return render(); } return A.sair(); }
  irOb(OB[i - 1]); if (S.ob === "quiz") { S.obQuiz = QUIZ.length - 1; render(); }
};

function vConsent() {
  return `<div class="view ob fade-in">${obTop()}${prog()}
  <div class="q"><h2>Antes do treino, sua saúde</h2><p class="muted">Pra montar um treino seguro, a gente precisa de algumas respostas sobre sua saúde.</p></div>
  <div class="card" style="margin-top:18px"><label class="check"><input type="checkbox" data-a="consentir" ${S.sel.consent ? "checked" : ""}>
  <span>Autorizo o ${esc(CONFIG.app)} a usar minhas respostas de saúde (questionário PAR-Q, limitações físicas, peso e esforço percebido) para montar e acompanhar meu treino.</span></label>
  <p class="small muted" style="margin-top:12px">Essas respostas são dados de saúde. Servem só para o seu personal montar um treino seguro, e só ele e a equipe responsável pelo app têm acesso. Nada disso é vendido nem vai para a academia ou para anunciantes.</p>
  <p class="small muted" style="margin-top:8px">Você pode retirar essa autorização quando quiser em Perfil › Privacidade. Sem ela, não dá pra montar um treino personalizado e seguro.</p></div>
  <div class="spacer"></div><button type="button" class="btn" ${S.sel.consent ? "" : "disabled"} data-a="irOb" data-v="parq">Continuar</button></div>`;
}
A.consentir = (v, el) => { S.sel.consent = el.checked; render(); };
A.irOb = v => irOb(v);

function vParq() {
  const r = S.rasc.parq || {}, todas = PARQ.every((_, i) => r[i] !== undefined), sim = Object.values(r).some(Boolean);
  return `<div class="view ob fade-in">${obTop()}${prog()}
  <div class="q"><h2>Questionário de saúde</h2><p class="muted">PAR-Q: leva 30 segundos e é o que todo profissional sério pede.</p></div>
  <div class="card" style="margin-top:18px;padding:4px 16px">
  ${PARQ.map((p, i) => `<div class="parq"><span id="pq${i}">${p}</span><div class="yn" role="group" aria-labelledby="pq${i}">
    <button type="button" class="${r[i] === true ? "sel" : ""}" aria-pressed="${r[i] === true}" data-a="parqResp" data-v="${i}:1">Sim</button>
    <button type="button" class="${r[i] === false ? "sel" : ""}" aria-pressed="${r[i] === false}" data-a="parqResp" data-v="${i}:0">Não</button></div></div>`).join("")}</div>
  ${sim ? `<div class="note" style="margin-top:12px"><b>Tudo bem, você pode seguir.</b>Como marcou "sim", o personal vai falar com você antes do primeiro treino e pode pedir liberação médica. O treino fica bloqueado até lá.</div>` : ""}
  ${erro()}
  <div class="spacer"></div><button type="button" class="btn" ${todas && !S.ocupado ? "" : "disabled"} data-a="parqEnviar">Continuar</button></div>`;
}
A.parqResp = v => { const [i, s] = v.split(":"); S.rasc.parq = { ...(S.rasc.parq || {}), [i]: s === "1" }; salvarRasc(); render(); };
A.parqEnviar = () => tentar(async () => {
  S.parq = await db.salvarParq(Object.fromEntries(PARQ.map((_, i) => [i, !!S.rasc.parq[i]])));
  delete S.rasc.parq; S.sel.consent = false; salvarRasc();
  if (S.perfil.onboarding_ok) { S.ob = null; toast(S.parq.tem_sim ? "Recebido. O personal vai falar com você." : "Questionário atualizado."); }
  else { prepararRasc(); S.obQuiz = 0; S.ob = "quiz"; }
});

function vQuiz() {
  const k = S.obQuiz, item = QUIZ[k], q = S.rasc.quiz || {};
  return `<div class="view ob fade-in">${obTop()}${prog()}
  <span class="eyebrow">Seu nível · pergunta ${k + 1} de ${QUIZ.length}</span>
  <div class="q" style="margin-top:8px"><h2>${item.q}</h2></div>
  <div class="opts">${item.o.map(([t, v]) => `<button type="button" class="opt ${q[k] === v ? "sel" : ""}" data-a="quiz" data-v="${k}:${v}"><span class="dot"></span>${t}</button>`).join("")}</div></div>`;
}
A.quiz = v => {
  const [k, val] = v.split(":").map(Number);
  S.rasc.quiz = { ...(S.rasc.quiz || {}), [k]: val }; salvarRasc(); render();
  setTimeout(() => { if (k < QUIZ.length - 1) { S.obQuiz = k + 1; render(); } else irOb("goal"); }, 220);
};
function vGoal() {
  return `<div class="view ob fade-in">${obTop()}${prog()}
  <div class="q"><h2>Qual é o seu objetivo agora?</h2><p class="muted">Muda séries, repetições e descanso.</p></div>
  <div class="opts">${Object.entries(GOALS).map(([k, g]) => `<button type="button" class="opt ${S.rasc.objetivo === k ? "sel" : ""}" data-a="rascPick" data-v="objetivo:${k}:dias"><span class="em">${g.em}</span>${g.n}</button>`).join("")}</div></div>`;
}
function vDias() {
  const txt = { 2: "O mínimo pra ver resultado", 3: "O mais comum", 4: "Ótimo ritmo", 5: "Rotina de quem já treina sério", 6: "Puxado, o personal acompanha de perto" };
  return `<div class="view ob fade-in">${obTop()}${prog()}
  <div class="q"><h2>Quantos dias por semana dá pra treinar?</h2><p class="muted">Seja realista. Treino que cabe na rotina é o que dá resultado.</p></div>
  <div class="opts">${[2, 3, 4, 5, 6].map(d => `<button type="button" class="opt ${S.rasc.dias === d ? "sel" : ""}" data-a="rascPick" data-v="dias:${d}:limits"><span class="dot"></span>${d} dias<small>${txt[d]}</small></button>`).join("")}</div></div>`;
}
A.rascPick = v => {
  const [campo, val, prox] = v.split(":");
  S.rasc[campo] = campo === "dias" ? +val : val; salvarRasc(); render();
  setTimeout(() => irOb(prox), 220);
};
function vLimits() {
  const l = S.rasc.limites || [];
  return `<div class="view ob fade-in">${obTop()}${prog()}
  <div class="q"><h2>Sente dor ou tem lesão em algum lugar?</h2><p class="muted">O treino troca os exercícios que forçam essa região.</p></div>
  <div class="opts">${LIMIT_OPTS.map(([k, em, t]) => `<button type="button" class="opt ${l.includes(k) ? "sel" : ""}" aria-pressed="${l.includes(k)}" data-a="lim" data-v="${k}"><span class="em">${em}</span>${t}</button>`).join("")}
  <button type="button" class="opt ${l.length === 0 ? "sel" : ""}" data-a="lim" data-v=""><span class="em">✅</span>Nenhuma</button></div>
  <p class="small muted" style="margin-top:12px">Outra lesão ou cirurgia? Conte pro personal no WhatsApp depois do cadastro.</p>
  <div class="spacer"></div><button type="button" class="btn" data-a="irOb" data-v="gym">Continuar</button></div>`;
}
A.lim = k => { const l = S.rasc.limites || []; S.rasc.limites = !k ? [] : l.includes(k) ? l.filter(x => x !== k) : [...l, k]; salvarRasc(); render(); };

function vGym() {
  const g = S.cat.gyms[S.rasc.gym_id];
  return `<div class="view ob fade-in">${obTop()}${prog()}
  <div class="q"><h2>Em qual academia você treina?</h2><p class="muted">Seu treino usa os aparelhos que <b>ela</b> tem, e o vídeo mostra onde fica cada um.</p></div>
  <div class="opts">${S.cat.lista.map(x => `<button type="button" class="opt ${S.rasc.gym_id === x.id ? "sel" : ""}" data-a="gymPick" data-v="${esc(x.id)}"><span class="dot"></span><span>${esc(x.nome)}<small>${esc(x.sub)}</small></span></button>`).join("")}
  <button type="button" class="opt" data-a="sheet" data-v="pedir"><span class="em">➕</span><span>Minha academia não está aqui<small>A gente vai lá e mapeia</small></span></button></div>
  ${g && g.unidades.length > 1 ? `<p class="eyebrow" style="margin:20px 0 10px">Unidade</p><div class="tabs">${g.unidades.map(u => `<button type="button" class="${S.rasc.unidade === u ? "on" : ""}" data-a="unidadePick" data-v="${esc(u)}">${esc(u)}</button>`).join("")}</div>` : ""}
  <p class="small muted" style="margin-top:14px">O nome da academia aparece só pra identificar os aparelhos. Não indica parceria com ela.</p>
  <div class="spacer"></div><button type="button" class="btn lime" ${S.rasc.gym_id ? "" : "disabled"} data-a="irOb" data-v="result">Montar meu treino</button></div>`;
}
A.gymPick = id => { S.rasc.gym_id = id; S.rasc.unidade = S.cat.gyms[id].unidades[0] || ""; salvarRasc(); render(); };
A.unidadePick = u => { S.rasc.unidade = u; salvarRasc(); render(); };

function vResult() {
  const lv = nivelDoQuiz(S.rasc.quiz), idx = LEVEL_KEYS.indexOf(lv), g = S.cat.gyms[S.rasc.gym_id];
  const p = montarPlano({ ...S.perfil, ...S.rasc, nivel_quiz: lv, nivel_validado: S.perfil.nivel_validado }, S.cat);
  const trocas = p.flatMap(t => t.items).filter(x => x.motivo).length;
  const valida = CONFIG.exigirValidacao && !S.perfil.nivel_validado;
  return `<div class="view ob fade-in">
  <span class="eyebrow" style="text-align:center;margin-top:8px">Resultado do quiz</span>
  <div class="levelbig" style="margin-top:12px"><span class="eyebrow" style="color:#0E1111">Nível sugerido</span><h2>${LEVELS[lv]}</h2><span>${GOALS[S.rasc.objetivo || "saude"].n} · ${S.rasc.dias}x por semana</span><div class="meter">${[0, 1, 2].map(i => `<i class="${i <= idx ? "on" : ""}"></i>`).join("")}</div></div>
  <div class="card building" style="margin-top:14px">
  <div><b>✓</b>Divisão ${p.map(t => t.nome.replace("Treino ", "")).join("/")} montada</div>
  <div><b>✓</b>${p.reduce((a, t) => a + t.items.length, 0)} exercícios pensados para a ${esc(g.nome)}</div>
  <div><b>✓</b>${trocas ? trocas + " troca" + (trocas > 1 ? "s" : "") + " por lesão ou aparelho" : "Nenhuma troca necessária"}</div>
  <div><b>${valida || (S.parq && S.parq.tem_sim && !S.parq.liberado) ? "…" : "✓"}</b>${valida ? "Vai para o personal validar antes de liberar" : "Treino liberado"}</div></div>
  ${erro()}
  <div class="spacer"></div><button type="button" class="btn lime" ${S.ocupado ? "disabled" : ""} data-a="obConcluir">Ver meu treino</button></div>`;
}
A.obConcluir = () => tentar(async () => {
  const r = S.rasc;
  S.perfil = await db.salvarPerfil({ quiz: r.quiz, objetivo: r.objetivo || "saude", dias: r.dias || 3, limites: r.limites || [], gym_id: r.gym_id, unidade: r.unidade || null, onboarding_ok: true });
  S.rasc = {}; salvarRasc(); S.ob = null; S.tab = "home";
});

/* =========================================================
   APP DO ALUNO
   ========================================================= */
function cardBloqueio(st) {
  const txt = {
    sem_parq: ["Falta o questionário de saúde", "Sem ele não dá pra liberar seu treino.", `<button type="button" class="btn" data-a="refazerParq">Responder agora</button>`],
    parq: ["O personal vai falar com você", "Você marcou \"sim\" no questionário de saúde. Antes do primeiro treino ele precisa conversar com você e pode pedir liberação médica.", botaoWa("Oi! Sou " + S.perfil.nome + ". Marquei sim no questionário de saúde do app, podemos conversar?", "Chamar o personal")],
    validacao: ["Seu treino está com o personal", "Um profissional com CREF revisa e valida seu treino antes de liberar. Você é avisado no WhatsApp. Enquanto isso, dá pra conhecer os exercícios e assistir aos vídeos.", botaoWa("Oi! Sou " + S.perfil.nome + ", acabei de me cadastrar no app.", "Avisar o personal")]
  }[st];
  return `<div class="today locked"><span class="chip warn">${I.lock.replace("<svg", '<svg width="14" height="14"')}Aguardando</span><h2>${txt[0]}</h2><p class="small muted">${txt[1]}</p><div style="margin-top:14px">${txt[2]}</div></div>`;
}
function vHome() {
  const p = plano(), i = proximoIdx(p, S.treinos), t = p[i], g = gymAtual(), st = statusTreino();
  const agora = new Date(), dow = (agora.getDay() + 6) % 7, rot = ["S", "T", "Q", "Q", "S", "S", "D"];
  const ini = new Date(agora); ini.setHours(0, 0, 0, 0); ini.setDate(ini.getDate() - dow);
  const feitos = new Set(S.treinos.map(h => { const d = new Date(h.created_at); d.setHours(0, 0, 0, 0); return +d; }));
  const semana = S.treinos.filter(h => +new Date(h.created_at) >= +ini).length;
  return `<div class="view fade-in">
  <div class="top"><div class="hello"><span class="eyebrow">${esc(g.nome)}${S.perfil.unidade ? " · " + esc(S.perfil.unidade) : ""}</span><h1>Bora, ${esc(primeiro(S.perfil.nome))}!</h1></div><button type="button" class="iconbtn" data-a="tema" aria-label="Tema claro ou escuro">${I.moon}</button></div>
  ${st !== "ok" ? cardBloqueio(st) : `<div class="today"><div class="ring"></div><span class="chip dark">Próximo treino</span><h2>${t.nome}</h2><div style="font-weight:700">${t.foco}</div><div class="small" style="margin-top:4px">${t.items.length} exercícios · ~${t.items.length * 8} min</div>
  <button type="button" class="btn" data-a="comecar" data-v="${i}">Começar treino</button></div>`}
  <div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><b>Sua semana</b><span class="chip lime">${semana} de ${S.perfil.dias}</span></div><div class="week" style="margin-top:12px">
  ${rot.map((l, k) => { const d = new Date(ini); d.setDate(d.getDate() + k); return `<div><i class="${feitos.has(+d) ? "done " : ""}${k === dow ? "today" : ""}">${d.getDate()}</i>${l}</div>`; }).join("")}</div></div>
  <div class="stats"><div class="stat"><b data-count="${S.treinos.length}">0</b><span>treinos</span></div><div class="stat"><b data-count="${sequencia(S.treinos)}">0</b><span>dias seguidos</span></div><div class="stat"><b style="font-size:20px;line-height:1.6">${LEVELS[nivelAtual(S.perfil)]}</b><span>nível</span></div></div>
  ${cardPersonal(st)}</div>`;
}
function cardPersonal(st) {
  const pe = personal();
  const msg = st === "parq" ? "Oi " + primeiro(S.perfil.nome) + "! Vi seu questionário de saúde. Antes do primeiro treino, me chama aqui rapidinho? 🙏"
    : st === "validacao" ? "Oi " + primeiro(S.perfil.nome) + "! Recebi seu cadastro. Vou revisar seu treino e te aviso aqui quando estiver liberado."
    : S.treinos.length ? "Mandou bem, " + primeiro(S.perfil.nome) + "! Qualquer dúvida no aparelho, me manda vídeo aqui." : "Oi " + primeiro(S.perfil.nome) + "! Seu treino está pronto. Qualquer dúvida no aparelho, me manda vídeo aqui.";
  return `<div class="card"><div class="pt"><div class="avatar on">${esc((pe ? pe.nome : "P")[0])}</div><div><b>${esc(pe ? pe.nome : "Seu personal")}</b><div class="small muted">Seu personal${pe && pe.cref ? " · CREF " + esc(pe.cref) : ""}</div></div></div>
  <div class="msg">${esc(msg)}</div><div style="margin-top:12px">${botaoWa("Oi! Sou " + S.perfil.nome + ", aluno(a) do " + CONFIG.app + ".")}</div></div>`;
}
A.comecar = i => { S.tab = "treino"; S.treino = +i; render(); scrollTo(0, 0); };
A.tema = () => alternarTema();

function assinatura() {
  const v = validador();
  if (!S.perfil.nivel_validado) return `<div class="signed"><span class="chip warn">Rascunho</span><span class="muted">aguardando validação do personal</span></div>`;
  return `<div class="signed">${I.shield}<span>Validado por ${esc(v ? v.nome : "personal")}${v && v.cref ? " · CREF " + esc(v.cref) : ""} · em ${fmtData(S.perfil.validado_em)}</span></div>`;
}
function vTreino() {
  const p = plano(), t = p[S.treino] || p[0], g = gymAtual(), st = statusTreino();
  const n = t.items.filter(x => exFeito(t.nome, x)).length;
  return `<div class="view fade-in">
  <div class="top"><div><span class="eyebrow">${esc(g.nome)}</span><h1 style="font-size:30px">Meu treino</h1></div>${st === "ok" ? `<span class="chip lime">${n}/${t.items.length}</span>` : `<span class="chip warn">bloqueado</span>`}</div>
  ${assinatura()}
  <div class="tabs" role="tablist">${p.map((x, i) => `<button type="button" role="tab" aria-selected="${i === S.treino}" class="${i === S.treino ? "on" : ""}" data-a="trocaTreino" data-v="${i}">${x.nome}</button>`).join("")}</div>
  <p class="muted" style="margin:-4px 0 14px;font-weight:700">${t.foco}</p>
  <div class="stack">${t.items.map((x, i) => {
    const e = S.cat.ex[x.id], d = st === "ok" && exFeito(t.nome, x);
    return `<button type="button" class="ex ${d ? "done" : ""}" data-a="abrirEx" data-v="${i}"><span class="th"><span class="n">${i + 1}</span>${I[e.icone] || I.leg}</span><span><h3>${esc(e.nome)}</h3><span class="small muted">${x.series} × ${x.reps} · ${x.rest}s descanso</span>${x.motivo ? '<br><span class="swap">trocado</span>' : ""}</span><span class="done-mark">${d ? I.check : ""}</span></button>`;
  }).join("")}</div>
  ${st === "ok" ? `<button type="button" class="btn lime" style="margin-top:16px" data-a="sheet" data-v="fim">Finalizar treino</button>` : `<div style="margin-top:16px">${cardBloqueio(st)}</div>`}
  </div>`;
}
A.trocaTreino = i => { S.treino = +i; render(); };
A.abrirEx = i => { S.detalhe = { t: S.treino, i: +i }; render(); scrollTo(0, 0); };

function video(tipo, e) {
  const g = gymAtual(), loc = tipo === "loc";
  const url = loc ? (e.loc[g.id] && e.loc[g.id].video_url) : e.video_url;
  return `<button type="button" class="vid ${loc ? "loc" : ""} ${url ? "" : "off"}" data-a="play" data-v="${esc(url || "")}" data-tipo="${tipo}">
  <span class="bg"></span><span class="glyph">${I[e.icone] || I.leg}</span>
  <span class="chip ${loc ? "warn" : "lime"}" style="align-self:flex-start">${loc ? "📍 Na " + esc(g.nome) : "🎥 Execução"}</span>
  <span class="play">${I.play}</span>
  <span class="cap">${loc ? "Onde fica o aparelho" : "Como fazer"}<br><span class="small" style="opacity:.7;font-weight:600">${url ? (loc ? "gravado na " + esc(g.nome) : "com o personal") : "vídeo em gravação"}</span></span></button>`;
}
A.play = (url, el) => {
  if (!url) return toast(el.dataset.tipo === "loc" ? "O vídeo de onde fica esse aparelho ainda está sendo gravado." : "O vídeo de execução ainda está sendo gravado.");
  if (el.querySelector("video")) return;
  const v = document.createElement("video");
  Object.assign(v, { src: url, autoplay: true, controls: true, playsInline: true });
  el.appendChild(v);
};

function vDetalhe() {
  const p = plano(), t = p[S.detalhe.t], x = t.items[S.detalhe.i], e = S.cat.ex[x.id], g = gymAtual(), total = t.items.length, st = statusTreino();
  const onde = ondeFica(e, g);
  return `<div class="view fade-in">
  <div class="top"><button type="button" class="iconbtn" data-a="fecharEx" aria-label="Voltar">${I.back}</button><span class="eyebrow">${S.detalhe.i + 1} de ${total} · ${t.nome}</span><span style="width:42px"></span></div>
  <span class="chip">${esc(e.grupo)}</span><h1 style="font-size:30px;margin:10px 0 14px">${esc(e.nome)}</h1>
  ${x.motivo ? `<div class="note" style="margin-bottom:12px"><b>Exercício trocado</b>Entrou no lugar de ${esc(S.cat.ex[x.orig] ? S.cat.ex[x.orig].nome : x.orig)}: ${esc(x.motivo)}.</div>` : ""}
  <div class="vids">${video("exec", e)}${video("loc", e)}</div>
  <div class="card where" style="margin-top:12px"><span class="pin">${I.pin}</span><div><b>Na ${esc(g.nome)}${S.perfil.unidade ? " · " + esc(S.perfil.unidade) : ""}</b><div class="small muted">${onde ? esc(onde) : "Localização em mapeamento. Se não achar o aparelho, pergunte ao personal."}</div></div></div>
  ${st === "ok" ? `<div class="card" style="margin-top:12px"><div style="display:flex;justify-content:space-between;margin-bottom:12px"><b>Séries</b><span class="small muted">${x.series} × ${x.reps} · ${x.rest}s</span></div>
  <div class="set" style="margin-bottom:2px"><span></span><span class="small muted" style="text-align:center">kg</span><span class="small muted" style="text-align:center">reps</span><span></span></div>
  <div class="sets">${Array.from({ length: x.series }, (_, k) => {
    const key = setKey(t.nome, x, k), feito = S.sets.k[key], ck = x.id + "|" + k, ult = ultimaCarga(x.id, k);
    return `<div class="set ${feito ? "ok" : ""}"><span class="i">${k + 1}</span>
    <input inputmode="decimal" aria-label="Carga da série ${k + 1} em kg" data-carga="${ck}" value="${esc(S.sets.cargas[ck] || "")}" placeholder="${ult ? esc(ult) : "–"}">
    <input inputmode="numeric" aria-label="Repetições da série ${k + 1}" data-reps="${ck}" value="${esc(S.sets.reps[ck] || "")}" placeholder="${esc(x.reps.split(" ")[0])}">
    <button type="button" data-a="serie" data-v="${esc(key)}" data-rest="${x.rest}" aria-label="Concluir série ${k + 1}" aria-pressed="${!!feito}">${I.check}</button></div>`;
  }).join("")}</div>${S.treinos.length ? `<p class="small muted" style="margin-top:8px">Em cinza: a carga do último treino.</p>` : ""}</div>` : `<div class="note" style="margin-top:12px"><b>Séries liberadas depois da validação</b>Assista aos vídeos à vontade. Registrar séries fica disponível quando o personal liberar seu treino.</div>`}
  <div class="card" style="margin-top:12px"><b>Dicas do personal</b><ul class="tips small" style="margin-top:8px">${(e.dicas || []).map(d => "<li>" + esc(d) + "</li>").join("")}</ul></div>
  <div class="row2" style="margin-top:14px">${botaoWa("Oi! Dúvida no " + e.nome + " (" + t.nome + ") na " + g.nome + ".", "Dúvida", "btn ghost")}
  ${S.detalhe.i < total - 1 ? `<button type="button" class="btn" data-a="proxEx">Próximo</button>` : st === "ok" ? `<button type="button" class="btn lime" data-a="sheet" data-v="fim">Finalizar</button>` : `<button type="button" class="btn" data-a="fecharEx">Voltar</button>`}</div></div>`;
}
A.fecharEx = () => { S.detalhe = null; render(); };
A.proxEx = () => { S.detalhe.i++; render(); scrollTo(0, 0); };
A.serie = (key, el) => {
  S.sets.k[key] = !S.sets.k[key];
  if (!S.sets.inicio) S.sets.inicio = Date.now();
  salvarSets(); render();
  if (S.sets.k[key]) iniciarTimer(+el.dataset.rest);
};

/* ---------- timer de descanso ---------- */
let timerInt = null;
function iniciarTimer(seg) {
  clearInterval(timerInt); S.sheet = "timer"; S.tLeft = seg; S.tTotal = seg; render();
  timerInt = setInterval(() => {
    S.tLeft--;
    if (S.tLeft <= 0) { clearInterval(timerInt); S.sheet = null; render(); toast("Descanso acabou. Próxima série!"); try { navigator.vibrate && navigator.vibrate(300); } catch (e) {} return; }
    desenharTimer();
  }, 1000);
}
const fmtT = s => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
function desenharTimer() {
  const c = document.getElementById("tc"), t = document.getElementById("tt"); if (!c) return;
  c.style.strokeDashoffset = 2 * Math.PI * 84 * (1 - S.tLeft / S.tTotal); t.textContent = fmtT(S.tLeft);
}
function sheetTimer() {
  const len = 2 * Math.PI * 84;
  return `<div class="sheet-bg"><div class="sheet" role="dialog" aria-label="Descanso" style="text-align:center"><span class="eyebrow">Descanso</span>
  <div class="timer"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="84" fill="none" stroke="var(--line)" stroke-width="14"/><circle id="tc" cx="100" cy="100" r="84" fill="none" stroke="var(--ink)" stroke-width="14" stroke-linecap="round" stroke-dasharray="${len}" stroke-dashoffset="${len * (1 - S.tLeft / S.tTotal)}" style="transition:stroke-dashoffset 1s linear"/></svg><span class="t" id="tt" aria-live="off">${fmtT(S.tLeft)}</span></div>
  <div class="row2"><button type="button" class="btn ghost" data-a="maisTempo">+15s</button><button type="button" class="btn" data-a="pularTimer">Pular</button></div></div></div>`;
}
A.maisTempo = () => { S.tLeft += 15; S.tTotal += 15; desenharTimer(); };
A.pularTimer = () => { clearInterval(timerInt); S.sheet = null; render(); };

/* ---------- fim do treino ---------- */
function sheetFim() {
  const t = plano()[S.treino], n = t.items.filter(x => exFeito(t.nome, x)).length;
  return `<div class="sheet-bg" data-a="fecharSheetFundo"><div class="sheet" role="dialog" aria-label="Finalizar treino">
  <span class="eyebrow">${t.nome} · ${n} de ${t.items.length} exercícios</span><h2 style="font-size:28px;margin:6px 0">Como foi o treino?</h2>
  <div class="rpe">${RPE.map(([em, l], i) => `<button type="button" class="${S.sel.rpe === i + 1 ? "sel" : ""}" aria-pressed="${S.sel.rpe === i + 1}" data-a="rpe" data-v="${i + 1}">${em}<small>${l}</small></button>`).join("")}</div>
  ${erro()}
  <button type="button" class="btn lime" ${S.sel.rpe && !S.ocupado ? "" : "disabled"} data-a="finalizar">Salvar treino</button>
  <button type="button" class="btn ghost" style="margin-top:10px" data-a="fecharSheet">Ainda não terminei</button></div></div>`;
}
A.rpe = v => { S.sel.rpe = +v; render(); };
A.finalizar = () => tentar(async () => {
  const t = plano()[S.treino], feitos = t.items.filter(x => exFeito(t.nome, x)).length;
  const dur = S.sets.inicio ? Math.max(1, Math.round((Date.now() - S.sets.inicio) / 6e4)) : t.items.length * 8;
  const series = t.items.map(x => ({ ex: x.id, feitas: Array.from({ length: x.series }, (_, k) => !!S.sets.k[setKey(t.nome, x, k)]).filter(Boolean).length,
    cargas: Array.from({ length: x.series }, (_, k) => S.sets.cargas[x.id + "|" + k] || ""), reps: Array.from({ length: x.series }, (_, k) => S.sets.reps[x.id + "|" + k] || "") }));
  const log = await db.registrarTreino({ treino: t.nome, foco: t.foco, gym_id: S.perfil.gym_id, exercicios_feitos: feitos, exercicios_total: t.items.length, duracao_min: Math.min(dur, 600), rpe: S.sel.rpe, series });
  S.treinos.unshift(log);
  for (const k of Object.keys(S.sets.k)) if (k.startsWith(t.nome + "|")) delete S.sets.k[k];
  S.sets.inicio = null; salvarSets();
  S.resumo = "✅ Treino concluído — " + S.perfil.nome + "\n" + t.nome + " (" + t.foco + ") na " + gymAtual().nome + "\n" + feitos + "/" + t.items.length + " exercícios · " + dur + " min · senti " + RPE[S.sel.rpe - 1][1].toLowerCase() + "\n" + S.treinos.length + "º treino no app";
  S.sheet = "salvo"; S.detalhe = null; S.sel = {};
});
function sheetSalvo() {
  return `<div class="sheet-bg"><div class="sheet" role="dialog" aria-label="Treino salvo" style="text-align:center">
  <div style="font-size:54px">🎉</div><h2 style="font-size:28px;margin:6px 0">Treino salvo!</h2><p class="muted" style="margin-bottom:18px">Manda o resumo pro personal acompanhar.</p>
  <div data-a="fecharSalvo">${botaoWa(S.resumo, "Enviar resumo no WhatsApp")}</div>
  <button type="button" class="btn ghost" style="margin-top:10px" data-a="fecharSalvo">Agora não</button></div></div>`;
}
A.fecharSalvo = () => { setTimeout(() => { S.sheet = null; S.tab = "home"; render(); }, 50); };

/* ---------- pedir mapeamento ---------- */
function sheetPedir() {
  return `<div class="sheet-bg" data-a="fecharSheetFundo"><div class="sheet" role="dialog" aria-label="Pedir mapeamento">
  <h2 style="font-size:26px">A gente vai até a sua academia</h2><p class="muted" style="margin:8px 0 16px">Fala qual é. O personal grava os aparelhos e libera seu treino mapeado. Enquanto isso, escolha a academia mais parecida.</p>
  <form data-s="pedir" novalidate>${campo("academia", "Nome da academia e bairro", 'placeholder="Ex.: Academia X, Gilberto Machado" maxlength="200"')}${erro()}
  <button class="btn">Pedir mapeamento</button></form></div></div>`;
}
A.pedir = () => tentar(async () => {
  if ((S.form.academia || "").trim().length < 2) throw new Error("Escreva o nome da academia.");
  await db.pedirAcademia(S.form.academia.trim()); S.form.academia = ""; S.sheet = null; toast("Pedido enviado pro personal!");
});

/* ---------- evolução ---------- */
function vEvol() {
  const dia = 864e5, agora = Date.now(), sem = [];
  for (let w = 5; w >= 0; w--) { const a = agora - (w + 1) * 7 * dia, b = agora - w * 7 * dia; sem.push(S.treinos.filter(h => { const x = +new Date(h.created_at); return x > a && x <= b; }).length); }
  const max = Math.max(S.perfil.dias || 1, ...sem), ps = S.pesos, dif = ps.length > 1 ? ps[ps.length - 1].kg - ps[0].kg : 0;
  const rpe = S.treinos.length ? S.treinos.reduce((a, h) => a + h.rpe, 0) / S.treinos.length : 0;
  return `<div class="view fade-in">
  <div class="top"><div><span class="eyebrow">Seu progresso</span><h1 style="font-size:30px">Evolução</h1></div></div>
  <div class="card"><div style="display:flex;justify-content:space-between"><b>Treinos por semana</b><span class="small muted">meta: ${S.perfil.dias}</span></div>
  <div class="bars" role="img" aria-label="Treinos nas últimas 6 semanas: ${sem.join(", ")}">${sem.map((v, i) => `<div><i class="${v >= S.perfil.dias ? "hi" : ""}" style="height:${Math.max(6, Math.round(v / max * 96))}px;animation-delay:${i * .06}s"></i><span>${i === 5 ? "esta" : "-" + (5 - i) + "s"}</span></div>`).join("")}</div></div>
  <div class="row2" style="margin-top:12px"><div class="kpi"><span class="eyebrow" style="color:#0E1111">Peso</span><b>${ps.length ? kg(ps[ps.length - 1].kg) : "–"}</b><span class="small" style="font-weight:700">${ps.length > 1 ? (dif <= 0 ? "▼ " : "▲ ") + kg(Math.abs(dif)) + " kg desde o início" : "registre seu peso"}</span></div>
  <div class="stat" style="display:grid;align-content:space-between"><span>Esforço médio</span><b>${rpe ? rpe.toFixed(1).replace(".", ",") : "–"}<span style="font-size:14px"> /5</span></b><span>${rpe >= 4 ? "intenso" : rpe ? "no ponto" : "sem treinos ainda"}</span></div></div>
  <button type="button" class="btn ghost" style="margin-top:12px" data-a="sheet" data-v="peso">+ Registrar peso de hoje</button>
  <div class="card" style="margin-top:12px"><b>Histórico</b><div style="margin-top:4px">
  ${S.treinos.length ? S.treinos.slice(0, 10).map(h => `<div class="hist"><div><b>${esc(h.treino)}</b><div class="small muted">${fmtData(h.created_at, { weekday: "short", day: "2-digit", month: "2-digit" })} · ${h.duracao_min || "–"} min</div></div><span aria-label="${RPE[h.rpe - 1][1]}">${RPE[h.rpe - 1][0]}</span></div>`).join("") : `<p class="muted small" style="padding:12px 0">Seu primeiro treino aparece aqui.</p>`}
  </div></div></div>`;
}
function sheetPeso() {
  const ult = S.pesos.length ? S.pesos[S.pesos.length - 1].kg : "";
  return `<div class="sheet-bg" data-a="fecharSheetFundo"><div class="sheet" role="dialog" aria-label="Registrar peso">
  <h2 style="font-size:26px;margin-bottom:14px">Seu peso hoje</h2>
  <form data-s="peso" novalidate>${campo("peso", "Peso em kg", `inputmode="decimal" placeholder="${esc(kg(ult || null))}" autofocus`)}${erro()}<button class="btn">Salvar</button></form></div></div>`;
}
A.peso = () => tentar(async () => {
  const v = parseFloat(String(S.form.peso || "").replace(",", "."));
  if (!(v > 20 && v < 300)) throw new Error("Confere o peso: algo entre 20 e 300 kg.");
  S.pesos.push(await db.registrarPeso(v)); S.form.peso = ""; S.sheet = null; toast("Peso registrado.");
});

/* ---------- perfil ---------- */
function vPerfil() {
  const st = statusTreino(), parqTxt = { sem_parq: '<span class="chip warn">responder</span>', parq: '<span class="chip warn">falar com personal</span>' }[st] || '<span class="chip">liberado</span>';
  return `<div class="view fade-in">
  <div class="top"><div><span class="eyebrow">Perfil</span><h1 style="font-size:30px">${esc(S.perfil.nome)}</h1></div><div class="avatar" style="background:var(--accent);color:#0E1111">${esc(primeiro(S.perfil.nome)[0] || "?")}</div></div>
  <div class="card"><span class="eyebrow">Minha academia</span><div style="margin-top:10px" class="stack">
  ${S.cat.lista.map(x => `<button type="button" class="opt ${S.perfil.gym_id === x.id ? "sel" : ""}" style="box-shadow:none;background:var(--soft)" data-a="trocarAcademia" data-v="${esc(x.id)}"><span class="dot"></span><span>${esc(x.nome)}<small>${esc(x.sub)}</small></span></button>`).join("")}
  <button type="button" class="opt" style="box-shadow:none;background:var(--soft)" data-a="sheet" data-v="pedir"><span class="em">➕</span><span>Minha academia não está aqui</span></button>
  </div><p class="small muted" style="margin-top:10px">Trocou de academia? O treino e os vídeos de "onde fica" mudam na hora.</p></div>
  <div class="card" style="margin-top:12px;padding:4px 18px">
  <div class="list-row"><span>Nível</span><span class="chip ${S.perfil.nivel_validado ? "lime" : "warn"}">${LEVELS[nivelAtual(S.perfil)]}${S.perfil.nivel_validado ? "" : " · sugerido"}</span></div>
  <div class="list-row"><span>Objetivo</span><span class="muted">${(GOALS[S.perfil.objetivo] || {}).n || "–"}</span></div>
  <div class="list-row"><span>Dias por semana</span><span class="muted">${S.perfil.dias}</span></div>
  <div class="list-row"><span>Limitações</span><span class="muted">${S.perfil.limites.length ? S.perfil.limites.join(", ") : "nenhuma"}</span></div>
  <div class="list-row"><span>Questionário de saúde</span>${parqTxt}</div>
  <button type="button" class="list-row" data-a="refazerQuiz"><span>Refazer quiz e preferências</span><span aria-hidden="true">›</span></button>
  <button type="button" class="list-row" data-a="refazerParq"><span>Atualizar questionário de saúde</span><span aria-hidden="true">›</span></button>
  <button type="button" class="list-row" data-a="tema"><span>Tema claro / escuro</span><span aria-hidden="true">›</span></button></div>
  <p class="eyebrow" style="margin:20px 0 10px">Privacidade</p>
  <div class="card" style="padding:4px 18px">
  <button type="button" class="list-row" data-a="baixarDados"><span>Baixar meus dados</span><span aria-hidden="true">›</span></button>
  <a class="list-row" href="privacidade.html" target="_blank"><span>Política de Privacidade</span><span aria-hidden="true">›</span></a>
  <a class="list-row" href="termos.html" target="_blank"><span>Termos de Uso</span><span aria-hidden="true">›</span></a>
  <button type="button" class="list-row" data-a="sheet" data-v="retirar"><span>Retirar autorização dos dados de saúde</span><span aria-hidden="true">›</span></button>
  <button type="button" class="list-row" data-a="sair"><span>Sair da conta</span><span aria-hidden="true">›</span></button>
  <button type="button" class="list-row" style="color:var(--danger)" data-a="sheet" data-v="excluir"><span>Excluir minha conta</span><span aria-hidden="true">›</span></button></div>
  <p class="small muted" style="text-align:center;margin-top:18px">${esc(CONFIG.app)} · treino validado e acompanhado por profissional com CREF</p></div>`;
}
A.trocarAcademia = id => tentar(async () => {
  const g = S.cat.gyms[id];
  S.perfil = await db.salvarPerfil({ gym_id: id, unidade: g.unidades[0] || null }); toast("Treino remontado para a " + g.nome);
});
A.refazerQuiz = () => { prepararRasc(); S.obQuiz = 0; S.ob = "quiz"; render(); scrollTo(0, 0); };
A.refazerParq = () => { S.rasc.parq = {}; S.sel.consent = false; S.ob = "consent"; render(); scrollTo(0, 0); };
A.baixarDados = async () => {
  const dados = { exportado_em: new Date().toISOString(), conta: S.sessao, perfil: S.perfil, questionario_saude: S.parq, treinos: S.treinos, pesos: S.pesos };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" }));
  a.download = "meus-dados-meu-personal.json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
function sheetConfirma(tit, txt, acao, rot) {
  return `<div class="sheet-bg" data-a="fecharSheetFundo"><div class="sheet" role="alertdialog" aria-label="${esc(tit)}">
  <h2 style="font-size:26px">${tit}</h2><p class="muted" style="margin:8px 0 18px">${txt}</p>${erro()}
  <button type="button" class="btn danger" ${S.ocupado ? "disabled" : ""} data-a="${acao}">${rot}</button>
  <button type="button" class="btn ghost" style="margin-top:10px" data-a="fecharSheet">Cancelar</button></div></div>`;
}
A.retirar = () => tentar(async () => { await db.retirarConsentimento(); S.parq = null; S.perfil = await db.perfil(); S.sheet = null; toast("Autorização retirada. Seus dados de saúde foram apagados."); });
A.excluir = () => tentar(async () => { await db.excluirConta(); S.sheet = null; await A.sair(); toast("Conta excluída."); });

/* ---------- sheets genéricos ---------- */
A.sheet = v => { S.sheet = v; S.erro = ""; render(); };
A.fecharSheet = () => { S.sheet = null; S.erro = ""; render(); };
A.fecharSheetFundo = (v, el, ev) => { if (ev.target === el) A.fecharSheet(); };

/* =========================================================
   RENDER
   ========================================================= */
function nav() {
  const tabs = [["home", "Início", I.home], ["treino", "Treino", I.dumb], ["evol", "Evolução", I.chart], ["perfil", "Perfil", I.user]];
  const i = tabs.findIndex(t => t[0] === S.tab);
  return `<nav class="nav" aria-label="Navegação"><span class="pill" style="transform:translateX(${i * 100}%)"></span>
  ${tabs.map(([k, l, ic]) => `<button type="button" class="${k === S.tab ? "on" : ""}" ${k === S.tab ? 'aria-current="page"' : ""} data-a="aba" data-v="${k}">${ic}${l}</button>`).join("")}</nav>`;
}
A.aba = k => { S.tab = k; S.detalhe = null; render(); scrollTo(0, 0); };

export function render() {
  let h = db.demo ? `<div class="demo-bar">MODO DEMONSTRAÇÃO · dados só neste navegador</div>` : "";
  if (S.carregando) h += `<div class="view ob" style="justify-content:center;align-items:center"><span class="muted">Carregando…</span></div>`;
  else if (!S.sessao) h += ({ welcome: vWelcome, entrar: vEntrar, cadastro: vCadastro, confirmar: vConfirmar, recuperar: vRecuperar, novaSenha: vNovaSenha }[S.tela] || vWelcome)();
  else if (S.perfil.role === "personal") h += painel.render();
  else if (S.ob) h += ({ consent: vConsent, parq: vParq, quiz: vQuiz, goal: vGoal, dias: vDias, limits: vLimits, gym: vGym, result: vResult }[S.ob])();
  else h += (S.detalhe ? vDetalhe() : { home: vHome, treino: vTreino, evol: vEvol, perfil: vPerfil }[S.tab]()) + nav();
  const sh = { timer: sheetTimer, fim: sheetFim, salvo: sheetSalvo, pedir: sheetPedir, peso: sheetPeso,
    retirar: () => sheetConfirma("Retirar autorização?", "Apagamos suas respostas de saúde e limitações. Seu treino fica bloqueado até você responder o questionário de novo.", "retirar", "Retirar e apagar"),
    excluir: () => sheetConfirma("Excluir sua conta?", "Apagamos sua conta, seus treinos, pesos e respostas de saúde. Não dá pra desfazer.", "excluir", "Excluir definitivamente") }[S.sheet];
  if (sh && S.sessao) h += sh();
  if (S.sheet === "pedir" && !S.sessao) S.sheet = null;
  $app.innerHTML = h;
  contar($app);
  const f = $app.querySelector(".sheet [autofocus]"); if (f) f.focus();
}

/* ---------- eventos (delegação) ---------- */
document.addEventListener("click", ev => {
  const el = ev.target.closest("[data-a]"); if (!el || !$app.contains(el) && !document.body.contains(el)) return;
  const fn = A[el.dataset.a]; if (!fn) return;
  if (el.tagName === "INPUT") return fn(el.dataset.v, el, ev);
  fn(el.dataset.v, el, ev);
});
document.addEventListener("submit", ev => {
  const f = ev.target.closest("[data-s]"); if (!f) return;
  ev.preventDefault(); const fn = A[f.dataset.s]; if (fn) fn(null, f, ev);
});
document.addEventListener("input", ev => {
  const t = ev.target, d = t.dataset;
  if (d.f) S.form[d.f] = t.type === "checkbox" ? t.checked : t.value;
  else if (d.carga) { S.sets.cargas[d.carga] = t.value; salvarSets(); }
  else if (d.reps) { S.sets.reps[d.reps] = t.value; salvarSets(); }
  else if (d.p && painel.input) painel.input(t);
});
document.addEventListener("change", ev => { const t = ev.target; if (t.dataset.f && t.type === "checkbox") S.form[t.dataset.f] = t.checked; if (t.dataset.p && painel.change) painel.change(t); });

/* ---------- partida ---------- */
painel.init({ S, A, db, render, carregar, tentar });
db.aoMudarSessao(async ev => {
  if (ev === "PASSWORD_RECOVERY") { S.tela = "novaSenha"; S.sessao = null; render(); }
  if (ev === "SIGNED_OUT" && S.sessao) { S.sessao = null; render(); }
});
(async () => {
  try { await carregar(); } catch (e) { console.error(e); toast(msgErro(e)); }
  if (/[?&]nova-senha/.test(location.search)) S.tela = "novaSenha";
  S.carregando = false; render();
})();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
