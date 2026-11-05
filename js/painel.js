/* =========================================================
   Painel do personal: alunos, liberação de saúde, validação
   de nível, academias, exercícios (vídeos) e pedidos.
   Campos: data-p="campo" (input/change → P.form)
   ========================================================= */
import { CONFIG } from "./config.js";
import { LEVELS, LEVEL_KEYS, GOALS, PARQ, QUIZ, ZONAS, EQUIPAMENTOS } from "./regras.js";
import { montarPlano } from "./plano.js";
import { esc, primeiro, waLink, fmtData, diasDesde, kg, toast, alternarTema, I } from "./ui.js";

let C;   // contexto do app: { S, A, db, render, carregar, tentar }
const P = { aba: "alunos", filtro: "todos", busca: "", alunos: [], pedidos: [], det: null, nivelSel: null, form: {}, ed: null };
const statusPedido = { novo: "Novo", agendado: "Visita agendada", mapeado: "Mapeado", descartado: "Descartado" };

/* ---------- classificação dos alunos ---------- */
const parqPendente = a => a.parq_sim && !a.parq_liberado;
const praValidar = a => a.onboarding_ok && !a.nivel_validado && !parqPendente(a);
const sumido = a => { const d = diasDesde(a.ultimo_treino); return d !== null && d >= CONFIG.diasSumido; };
const semParq = a => !a.parq_id;
const aderencia = a => Math.min(100, Math.round((a.treinos_28d || 0) / ((a.dias || 3) * 4) * 100));
const FILTROS = {
  todos: ["Alunos", () => true],
  validar: ["Pra validar", praValidar],
  parq: ["PAR-Q pendente", parqPendente],
  sumidos: ["Sumiram (" + CONFIG.diasSumido + "+ dias)", sumido]
};

function msgWa(a) {
  const n = primeiro(a.nome);
  if (parqPendente(a)) return `Oi ${n}! Aqui é seu personal do ${CONFIG.app}. Vi seu questionário de saúde: antes do primeiro treino quero conversar com você rapidinho. Pode falar agora?`;
  if (praValidar(a)) return `Oi ${n}! Seu treino no ${CONFIG.app} está liberado. Qualquer dúvida em aparelho, me manda vídeo aqui 💪`;
  if (sumido(a)) return `Oi ${n}! Sentimos sua falta. Bora voltar essa semana? Seu próximo treino já está no app 💪`;
  return `Oi ${n}! Tudo certo com o treino?`;
}

export const painel = {
  init(ctx) { C = ctx; Object.assign(C.A, acoes); },

  async abrir() {
    const [alunos, pedidos] = await Promise.all([C.db.painelAlunos(), C.db.pedidos()]);
    P.alunos = alunos; P.pedidos = pedidos;
    if (P.dono !== C.S.sessao.id) Object.assign(P, { dono: C.S.sessao.id, aba: "alunos", filtro: "todos", busca: "", det: null, ed: null, form: {} });
  },

  render() {
    const pend = P.pedidos.filter(p => p.status === "novo").length;
    const abas = [["alunos", "Alunos"], ["academias", "Academias"], ["exercicios", "Exercícios"], ["pedidos", "Pedidos"], ["eu", "Meus dados"]];
    const me = C.S.perfil, faltaDado = !me.cref || !me.whatsapp;
    const corpo = P.det ? vAluno() : P.ed ? (P.aba === "academias" ? vEdGym() : vEdEx()) : { alunos: vAlunos, academias: vAcademias, exercicios: vExercicios, pedidos: vPedidos, eu: vEu }[P.aba]();
    return `<div class="pn fade-in">
    <div class="pn-head"><div class="logo"><span class="mk">${I.dumb}</span><span>${esc(CONFIG.app)}<span class="small muted" style="display:block;font-weight:600">Painel do personal</span></span></div>
    <span class="grow"></span>
    <nav class="pn-nav" aria-label="Seções do painel">${abas.map(([k, l]) => `<button type="button" class="${P.aba === k ? "on" : ""}" data-a="pAba" data-v="${k}">${l}${k === "pedidos" && pend ? `<span class="badge">${pend}</span>` : ""}</button>`).join("")}</nav>
    <button type="button" class="iconbtn" data-a="tema" aria-label="Tema claro ou escuro">${I.moon}</button>
    <button type="button" class="iconbtn" data-a="sair" aria-label="Sair">${I.out}</button></div>
    ${faltaDado && P.aba !== "eu" ? `<div class="note" style="margin-bottom:16px"><b>Cadastre seu CREF e WhatsApp</b>Eles aparecem pro aluno no treino validado e no botão "Falar com o personal". <button type="button" class="link" data-a="pAba" data-v="eu">Preencher agora</button></div>` : ""}
    ${C.S.erro ? `<div class="note" role="alert" style="margin-bottom:16px"><b>Não deu certo</b>${esc(C.S.erro)}</div>` : ""}
    ${corpo}</div>`;
  },

  input(t) {
    const k = t.dataset.p;
    if (k === "busca") { P.busca = t.value; const r = document.getElementById("pn-lista"); if (r) r.innerHTML = listaAlunos(); return; }
    if (t.type === "checkbox") return;
    P.form[k] = t.value;
  },
  change(t) {
    const k = t.dataset.p;
    if (t.type === "checkbox") { P.form[k] = t.checked; return; }
    if (k.startsWith("up:")) return enviar(t, k.slice(3));
    if (k.startsWith("status:")) return C.tentar(async () => { await C.db.statusPedido(k.slice(7), t.value); P.pedidos = await C.db.pedidos(); toast("Status atualizado."); });
  }
};

/* =========================================================
   ALUNOS
   ========================================================= */
function vAlunos() {
  const n = k => P.alunos.filter(FILTROS[k][1]).length;
  return `<h1>Seus alunos</h1>
  <div class="kpis">
  ${Object.entries(FILTROS).map(([k, [rot]], i) => `<button type="button" class="k ${i === 0 ? "hot" : ""} ${P.filtro === k ? "sel" : ""}" data-a="pFiltro" data-v="${k}" aria-pressed="${P.filtro === k}"><span>${rot}</span><b data-count="${n(k)}" ${k !== "todos" && n(k) ? 'style="color:var(--danger)"' : ""}>0</b></button>`).join("")}</div>
  <div class="field" style="max-width:420px"><label for="pn-busca" class="sr">Buscar aluno</label><input id="pn-busca" data-p="busca" placeholder="Buscar pelo nome…" value="${esc(P.busca)}"></div>
  <div class="stack" id="pn-lista">${listaAlunos()}</div>`;
}
function listaAlunos() {
  const b = P.busca.trim().toLowerCase();
  const lista = P.alunos.filter(FILTROS[P.filtro][1]).filter(a => !b || a.nome.toLowerCase().includes(b))
    .sort((x, y) => (parqPendente(y) - parqPendente(x)) || (praValidar(y) - praValidar(x)) || (sumido(y) - sumido(x)) || x.nome.localeCompare(y.nome));
  if (!lista.length) return `<p class="muted" style="padding:20px 4px">${P.alunos.length ? "Ninguém nesse filtro. 👌" : "Nenhum aluno ainda. Quando alguém se cadastrar, aparece aqui."}</p>`;
  return lista.map(a => {
    const d = diasDesde(a.ultimo_treino), ad = aderencia(a), g = C.S.cat.gyms[a.gym_id];
    const badges = (parqPendente(a) ? '<span class="chip red">PAR-Q</span> ' : "") + (praValidar(a) ? '<span class="chip warn">validar</span> ' : "")
      + (semParq(a) ? '<span class="chip">sem PAR-Q</span> ' : "") + (!a.onboarding_ok && !semParq(a) ? '<span class="chip">cadastro incompleto</span> ' : "");
    return `<div class="al"><button type="button" class="avatar" data-a="pAluno" data-v="${a.id}" aria-label="Abrir ${esc(a.nome)}">${esc(a.nome[0] || "?")}</button>
    <button type="button" class="meta" style="text-align:left" data-a="pAluno" data-v="${a.id}"><b>${esc(a.nome)}</b> ${badges}
    <div class="small muted">${esc(g ? g.nome : "sem academia")} · ${LEVELS[a.nivel_validado || a.nivel_quiz] || "–"}${a.nivel_validado ? "" : " (sugerido)"} · ${d === null ? "ainda não treinou" : d === 0 ? "treinou hoje" : "há " + d + " dia" + (d > 1 ? "s" : "")}</div>
    <div class="adh" title="Aderência: ${ad}% da meta das últimas 4 semanas"><i class="${ad < 50 ? "low" : ""}" style="width:${ad}%"></i></div></button>
    ${a.whatsapp ? `<a class="wa-mini" target="_blank" rel="noopener" aria-label="WhatsApp de ${esc(a.nome)}" href="${esc(waLink(a.whatsapp, msgWa(a)))}">${I.wa}</a>` : ""}</div>`;
  }).join("");
}

function vAluno() {
  const { perfil: p, parq, treinos, pesos } = P.det, g = C.S.cat.gyms[p.gym_id];
  const lv = P.nivelSel || p.nivel_validado || p.nivel_quiz || "iniciante";
  const plano = p.onboarding_ok ? montarPlano({ ...p, nivel_validado: lv }, C.S.cat) : [];
  const idade = p.nascimento ? Math.floor((Date.now() - new Date(p.nascimento)) / (365.25 * 864e5)) : null;
  const validador = C.S.equipe.find(e => e.id === p.validado_por);
  const resumo = { ...p, parq_sim: parq && parq.tem_sim, parq_liberado: parq && parq.liberado, parq_id: parq && parq.id };
  return `<div class="top"><button type="button" class="iconbtn" data-a="pFecharAluno" aria-label="Voltar">${I.back}</button><span></span></div>
  <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:18px"><div class="avatar">${esc(p.nome[0] || "?")}</div>
  <div style="flex:1;min-width:200px"><h1 style="font-size:30px">${esc(p.nome)}</h1><span class="muted small">${esc(g ? g.nome : "sem academia")}${p.unidade ? " · " + esc(p.unidade) : ""} · cadastrado em ${fmtData(p.created_at, { day: "2-digit", month: "2-digit", year: "numeric" })}</span></div>
  ${p.whatsapp ? `<a class="btn wa sm" target="_blank" rel="noopener" href="${esc(waLink(p.whatsapp, msgWa(resumo)))}">${I.wa}WhatsApp</a>` : ""}</div>
  <div class="grid2">
  <div class="stack">
    <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>Liberação de saúde (PAR-Q)</b>${!parq ? '<span class="chip">não respondeu</span>' : parq.liberado ? '<span class="chip lime">liberado</span>' : '<span class="chip red">aguardando você</span>'}</div>
    ${parq ? `<table class="tbl" style="margin-top:8px"><tbody>${PARQ.map((q, i) => `<tr><td class="small">${q}</td><td class="${parq.respostas[i] ? "yes" : "muted"}" style="white-space:nowrap">${parq.respostas[i] ? "SIM" : "não"}</td></tr>`).join("")}</tbody></table>
    ${parq.tem_sim && !parq.liberado ? `<div class="field" style="margin-top:12px"><label for="pn-obs">Como foi liberado (fica registrado)</label><textarea id="pn-obs" data-p="obs" placeholder="Ex.: conversei por telefone em 05/11, apresentou liberação do cardiologista">${esc(P.form.obs || "")}</textarea></div>
      <p class="small muted" style="margin:-6px 0 12px">Não anexe laudo nem atestado aqui: registre só que conferiu.</p>
      <button type="button" class="btn" data-a="pLiberar" data-v="${parq.id}">Liberar para treinar</button>`
      : parq.tem_sim ? `<p class="small muted" style="margin-top:10px">Liberado em ${fmtData(parq.liberado_em)}${parq.obs ? ": " + esc(parq.obs) : ""}</p>` : `<p class="small muted" style="margin-top:10px">Respondeu "não" em tudo em ${fmtData(parq.created_at)}.</p>`}`
      : `<p class="small muted" style="margin-top:8px">Sem questionário, o treino do aluno fica bloqueado.</p>`}</div>

    <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>Nível</b>${p.nivel_validado ? `<span class="chip lime">validado</span>` : '<span class="chip warn">a validar</span>'}</div>
    ${p.onboarding_ok ? `<table class="tbl" style="margin-top:8px"><tbody>${QUIZ.map((q, i) => { const o = q.o.find(x => x[1] === +p.quiz[i]); return `<tr><td class="small">${q.q}</td><td class="small" style="font-weight:700">${o ? esc(o[0]) : "–"}</td></tr>`; }).join("")}</tbody></table>
    <p class="small" style="margin:12px 0 8px">Quiz sugere <b>${LEVELS[p.nivel_quiz] || "–"}</b>${p.nivel_validado && p.nivel_quiz !== p.nivel_validado ? ` · validado como <b>${LEVELS[p.nivel_validado]}</b>` : ""}${validador ? ` · por ${esc(validador.nome)} em ${fmtData(p.validado_em)}` : ""}</p>
    <div class="tabs" role="radiogroup" aria-label="Nível a validar">${LEVEL_KEYS.map(k => `<button type="button" role="radio" aria-checked="${lv === k}" class="${lv === k ? "on" : ""}" data-a="pNivel" data-v="${k}">${LEVELS[k]}</button>`).join("")}</div>
    <button type="button" class="btn ${p.nivel_validado === lv ? "ghost" : "lime"}" data-a="pValidar" data-v="${lv}">${p.nivel_validado === lv ? "Revalidar" : "Validar"} como ${LEVELS[lv]}</button>
    ${parq && parq.tem_sim && !parq.liberado ? `<p class="small muted" style="margin-top:8px">Mesmo validado, o treino só libera depois da liberação de saúde.</p>` : ""}`
    : `<p class="small muted" style="margin-top:8px">O aluno ainda não terminou o quiz.</p>`}</div>

    <div class="card"><b>Dados</b><div style="margin-top:6px">
    <div class="list-row"><span>Objetivo</span><span class="muted">${(GOALS[p.objetivo] || {}).n || "–"}</span></div>
    <div class="list-row"><span>Dias por semana</span><span class="muted">${p.dias || "–"}</span></div>
    <div class="list-row"><span>Limitações</span><span class="muted">${p.limites.length ? p.limites.join(", ") : "nenhuma"}</span></div>
    <div class="list-row"><span>Idade</span><span class="muted">${idade !== null ? idade + " anos" : "–"}</span></div>
    <div class="list-row"><span>WhatsApp</span><span class="muted">${esc(p.whatsapp || "–")}</span></div></div></div>
  </div>
  <div class="stack">
    <div class="card"><b>Treino que o app monta (${LEVELS[lv]})</b>
    ${plano.length ? plano.map(t => `<p class="eyebrow" style="margin:14px 0 6px">${t.nome} · ${t.foco}</p><table class="tbl"><tbody>${t.items.map(x => `<tr><td>${esc(C.S.cat.ex[x.id].nome)}${x.motivo ? ` <span class="swap" title="${esc(x.motivo)}">trocado</span>` : ""}</td><td class="small muted" style="white-space:nowrap">${x.series} × ${x.reps}</td></tr>`).join("")}</tbody></table>`).join("") : `<p class="small muted" style="margin-top:8px">Aparece quando o aluno terminar o cadastro.</p>`}</div>
    <div class="card"><b>Últimos treinos</b>
    ${treinos.length ? `<table class="tbl" style="margin-top:6px"><thead><tr><th>Data</th><th>Treino</th><th>Feito</th><th>Esforço</th></tr></thead><tbody>${treinos.slice(0, 10).map(t => `<tr><td>${fmtData(t.created_at)}</td><td>${esc(t.treino)}</td><td>${t.exercicios_feitos}/${t.exercicios_total}</td><td>${t.rpe}/5</td></tr>`).join("")}</tbody></table>` : `<p class="small muted" style="margin-top:8px">Nenhum treino registrado.</p>`}
    ${pesos.length ? `<p class="small" style="margin-top:12px"><b>Peso:</b> ${kg(pesos[pesos.length - 1].kg)} kg em ${fmtData(pesos[pesos.length - 1].created_at)}${pesos.length > 1 ? ` (${pesos[pesos.length - 1].kg - pesos[0].kg <= 0 ? "▼" : "▲"} ${kg(Math.abs(pesos[pesos.length - 1].kg - pesos[0].kg))} kg desde ${fmtData(pesos[0].created_at)})` : ""}</p>` : ""}</div>
  </div></div>`;
}

/* =========================================================
   ACADEMIAS
   ========================================================= */
function vAcademias() {
  return `<div class="top"><h1>Academias</h1><button type="button" class="btn sm" data-a="pEdGym" data-v="">+ Nova academia</button></div>
  <p class="muted" style="margin:-8px 0 16px;max-width:640px">Cada academia diz onde fica cada tipo de aparelho e quais ela não tem. O treino do aluno troca sozinho o que faltar.</p>
  <div class="grid3">${C.S.cat.lista.map(g => {
    const z = Object.values(g.zonas || {}).filter(Boolean).length;
    const vids = Object.values(C.S.cat.ex).filter(e => e.loc[g.id] && e.loc[g.id].video_url).length;
    return `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(g.nome)}</b>${g.ativo ? "" : '<span class="chip">oculta</span>'}</div>
    <p class="small muted">${esc(g.sub)}</p>
    <p class="small" style="margin:10px 0">${g.unidades.length} unidade${g.unidades.length === 1 ? "" : "s"} · ${z}/6 zonas mapeadas · ${vids} vídeos "onde fica" · ${P.alunos.filter(a => a.gym_id === g.id).length} alunos</p>
    ${g.sem.length ? `<p class="small muted">Não tem: ${g.sem.map(s => EQUIPAMENTOS[s] || s).join(", ")}</p>` : ""}
    <button type="button" class="btn sm ghost" style="margin-top:12px" data-a="pEdGym" data-v="${esc(g.id)}">Editar</button></div>`;
  }).join("")}</div>`;
}
function vEdGym() {
  const f = P.form, novo = !P.ed.id;
  return `<div class="top"><button type="button" class="iconbtn" data-a="pFecharEd" aria-label="Voltar">${I.back}</button><span></span></div>
  <h1 style="margin-bottom:16px">${novo ? "Nova academia" : esc(f.nome)}</h1>
  <div class="grid2"><div class="card">
  <div class="field"><label for="g-nome">Nome</label><input id="g-nome" data-p="nome" value="${esc(f.nome || "")}" maxlength="80"></div>
  <div class="field"><label for="g-sub">Descrição curta</label><input id="g-sub" data-p="sub" value="${esc(f.sub || "")}" placeholder="Ex.: Academia de bairro, 2 andares"></div>
  <div class="field"><label for="g-uni">Unidades (separe por vírgula)</label><input id="g-uni" data-p="unidades" value="${esc(f.unidades || "")}" placeholder="Centro, Gilberto Machado"></div>
  <label class="check" style="margin-bottom:16px"><input type="checkbox" data-p="ativo" ${f.ativo !== false ? "checked" : ""}><span>Aparece para os alunos</span></label>
  <p class="lbl" style="margin-bottom:8px">Aparelhos que essa academia NÃO tem</p>
  <div class="eqgrid">${Object.entries(EQUIPAMENTOS).map(([k, n]) => `<label class="check small"><input type="checkbox" data-p="sem:${k}" ${f["sem:" + k] ? "checked" : ""}><span>${n}</span></label>`).join("")}</div></div>
  <div class="card"><p class="lbl">Onde fica cada área (o aluno lê isso no exercício)</p><p class="small muted" style="margin:4px 0 12px">Escreva como você explicaria pra quem nunca entrou lá. Em branco aparece "em mapeamento".</p>
  ${Object.entries(ZONAS).map(([k, n]) => `<div class="field"><label for="z-${k}">${n}</label><input id="z-${k}" data-p="zona:${k}" value="${esc(f["zona:" + k] || "")}" placeholder="Ex.: fundo do salão, à esquerda da recepção"></div>`).join("")}</div></div>
  <button type="button" class="btn lime" style="margin-top:16px;max-width:360px" data-a="pSalvarGym">Salvar academia</button>`;
}

/* =========================================================
   EXERCÍCIOS
   ========================================================= */
function vExercicios() {
  const gyms = C.S.cat.lista, lista = Object.values(C.S.cat.ex).sort((a, b) => a.grupo.localeCompare(b.grupo) || a.nome.localeCompare(b.nome));
  const comExec = lista.filter(e => e.video_url).length;
  return `<h1>Exercícios</h1>
  <p class="muted" style="margin:6px 0 16px;max-width:680px">O vídeo de execução é um só pra todas as academias. O vídeo "onde fica" é por academia. ${comExec}/${lista.length} exercícios já têm vídeo de execução.</p>
  <div class="card" style="overflow-x:auto"><table class="tbl"><thead><tr><th>Exercício</th><th>Grupo</th><th>Execução</th>${gyms.map(g => `<th>${esc(g.nome)}</th>`).join("")}<th></th></tr></thead><tbody>
  ${lista.map(e => `<tr><td><b>${esc(e.nome)}</b>${e.ativo ? "" : ' <span class="chip">desativado</span>'}</td><td class="muted">${esc(e.grupo)}</td><td>${e.video_url ? "✅" : "—"}</td>
  ${gyms.map(g => `<td>${e.loc[g.id] && e.loc[g.id].video_url ? "✅" : (g.sem || []).includes(e.eq) ? '<span class="muted small">não tem</span>' : "—"}</td>`).join("")}
  <td><button type="button" class="btn sm ghost" data-a="pEdEx" data-v="${e.id}">Editar</button></td></tr>`).join("")}</tbody></table></div>`;
}
function vEdEx() {
  const f = P.form, e = C.S.cat.ex[P.ed.id];
  const blocoVideo = (rot, chave, url) => `<div class="field"><span class="lbl">${rot}</span>
    <div class="upl"><input type="url" data-p="${chave}" value="${esc(url || "")}" placeholder="Link do vídeo (MP4) ou envie o arquivo" aria-label="${rot}: link">
    <label class="btn sm ghost" style="cursor:pointer">Enviar<input type="file" accept="video/mp4,video/webm,video/quicktime" data-p="up:${chave}" class="sr"></label></div>
    ${url ? `<video class="mini-vid" src="${esc(url)}" controls preload="metadata" playsinline></video>` : ""}</div>`;
  return `<div class="top"><button type="button" class="iconbtn" data-a="pFecharEd" aria-label="Voltar">${I.back}</button><span></span></div>
  <h1 style="margin-bottom:16px">${esc(e.nome)}</h1>
  <div class="grid2"><div class="card">
  <div class="field"><label for="e-nome">Nome</label><input id="e-nome" data-p="nome" value="${esc(f.nome)}"></div>
  <div class="field"><label for="e-grupo">Grupo muscular</label><input id="e-grupo" data-p="grupo" value="${esc(f.grupo)}"></div>
  <div class="field"><label for="e-dicas">Dicas (uma por linha)</label><textarea id="e-dicas" data-p="dicas">${esc(f.dicas)}</textarea></div>
  <label class="check" style="margin-bottom:16px"><input type="checkbox" data-p="ativo" ${f.ativo !== false ? "checked" : ""}><span>Ativo (desativado some de todos os treinos)</span></label>
  ${blocoVideo("Vídeo de execução", "video_url", f.video_url)}
  <p class="small muted">Vídeo vertical, até 50 MB, sem música ambiente e sem outras pessoas reconhecíveis.</p></div>
  <div class="card"><p class="lbl" style="margin-bottom:12px">Onde fica, em cada academia</p>
  ${C.S.cat.lista.map(g => (g.sem || []).includes(e.eq) ? `<p class="small muted" style="margin-bottom:14px"><b>${esc(g.nome)}</b>: não tem esse aparelho${e.alt ? " (troca por " + esc(C.S.cat.ex[e.alt] ? C.S.cat.ex[e.alt].nome : e.alt) + ")" : ""}.</p>`
    : `<div style="border-bottom:1px solid var(--line);margin-bottom:14px;padding-bottom:4px"><p style="font-weight:800;margin-bottom:8px">${esc(g.nome)}</p>
      ${blocoVideo('Vídeo "onde fica"', "loc:" + g.id + ":video_url", f["loc:" + g.id + ":video_url"])}
      <div class="field"><label for="d-${g.id}">Texto de onde fica (opcional)</label><input id="d-${g.id}" data-p="loc:${g.id}:descricao" value="${esc(f["loc:" + g.id + ":descricao"] || "")}" placeholder="${esc((g.zonas || {})[e.zona] || "Em branco usa a área da academia")}"></div></div>`).join("")}</div></div>
  <button type="button" class="btn lime" style="margin-top:16px;max-width:360px" data-a="pSalvarEx">Salvar exercício</button>`;
}
async function enviar(input, chave) {
  const arq = input.files && input.files[0]; if (!arq) return;
  if (arq.size > 50 * 1024 * 1024) return toast("Vídeo acima de 50 MB. Comprima antes de enviar.");
  toast("Enviando vídeo…");
  await C.tentar(async () => {
    const ext = (arq.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
    const caminho = chave === "video_url" ? `execucao/${P.ed.id}.${ext}` : `onde-fica/${chave.split(":")[1]}/${P.ed.id}.${ext}`;
    P.form[chave] = await C.db.enviarVideo(arq, caminho);
    toast(C.db.demo ? "Vídeo carregado (no modo demonstração ele some ao recarregar)." : "Vídeo enviado. Falta salvar o exercício.");
  });
}

/* =========================================================
   PEDIDOS e MEUS DADOS
   ========================================================= */
function vPedidos() {
  return `<h1>Pedidos de mapeamento</h1><p class="muted" style="margin:6px 0 16px">Alunos que treinam numa academia que ainda não está no app. Cada pedido é uma visita (e um lead).</p>
  ${P.pedidos.length ? `<div class="card" style="overflow-x:auto"><table class="tbl"><thead><tr><th>Data</th><th>Academia</th><th>Aluno</th><th>Status</th></tr></thead><tbody>
  ${P.pedidos.map(r => { const a = P.alunos.find(x => x.id === r.user_id); return `<tr><td>${fmtData(r.created_at)}</td><td><b>${esc(r.texto)}</b></td>
  <td>${a ? `${esc(a.nome)}${a.whatsapp ? ` <a class="link small" target="_blank" rel="noopener" href="${esc(waLink(a.whatsapp, "Oi " + primeiro(a.nome) + "! Vi seu pedido pra mapear a " + r.texto + ". Vou marcar a visita e te aviso 💪"))}">WhatsApp</a>` : ""}` : '<span class="muted">conta excluída</span>'}</td>
  <td><select data-p="status:${r.id}" aria-label="Status do pedido">${Object.entries(statusPedido).map(([k, l]) => `<option value="${k}" ${r.status === k ? "selected" : ""}>${l}</option>`).join("")}</select></td></tr>`; }).join("")}
  </tbody></table></div>` : `<p class="muted">Nenhum pedido ainda.</p>`}`;
}
function vEu() {
  const f = P.form;
  return `<h1>Meus dados</h1><p class="muted" style="margin:6px 0 16px">Aparecem pro aluno: no treino validado ("Validado por… CREF…") e no botão de WhatsApp.</p>
  <div class="card" style="max-width:520px">
  <div class="field"><label for="m-nome">Nome que o aluno vê</label><input id="m-nome" data-p="nome" value="${esc(f.nome || "")}" maxlength="80"></div>
  <div class="field"><label for="m-cref">CREF</label><input id="m-cref" data-p="cref" value="${esc(f.cref || "")}" placeholder="000000-G/ES" maxlength="30"></div>
  <div class="field"><label for="m-wa">WhatsApp de atendimento (de preferência o número da empresa)</label><input id="m-wa" data-p="whatsapp" type="tel" value="${esc(f.whatsapp || "")}" placeholder="(28) 9 9999-9999"></div>
  <button type="button" class="btn" data-a="pSalvarEu">Salvar</button></div>`;
}

/* =========================================================
   AÇÕES
   ========================================================= */
const acoes = {
  pAba(v) {
    P.aba = v; P.det = null; P.ed = null; P.form = {}; C.S.erro = "";
    if (v === "eu") { const p = C.S.perfil; P.form = { nome: p.nome, cref: p.cref || "", whatsapp: p.whatsapp || "" }; }
    C.render(); scrollTo(0, 0);
  },
  pFiltro(v) { P.filtro = v; C.render(); },
  pAluno(id) { C.tentar(async () => { P.det = await C.db.aluno(id); P.nivelSel = null; P.form = {}; scrollTo(0, 0); }); },
  pFecharAluno() { P.det = null; C.tentar(async () => { await painel.abrir(); }); },
  pNivel(v) { P.nivelSel = v; C.render(); },
  pValidar(nivel) {
    C.tentar(async () => {
      const id = P.det.perfil.id;
      await C.db.validarAluno(id, nivel); P.det = await C.db.aluno(id); P.nivelSel = null;
      toast("Nível validado. Avise o aluno no WhatsApp que o treino está liberado.");
    });
  },
  pLiberar(sid) {
    if ((P.form.obs || "").trim().length < 5) return toast("Escreva como conferiu a liberação (fica registrado).");
    C.tentar(async () => { await C.db.liberarParq(sid, P.form.obs.trim()); P.det = await C.db.aluno(P.det.perfil.id); P.form.obs = ""; toast("Liberado."); });
  },
  pEdGym(id) {
    const g = id ? C.S.cat.gyms[id] : { nome: "", sub: "", unidades: [], sem: [], zonas: {}, ativo: true };
    P.ed = { id: id || null };
    P.form = { nome: g.nome, sub: g.sub, unidades: g.unidades.join(", "), ativo: g.ativo };
    for (const s of g.sem) P.form["sem:" + s] = true;
    for (const [k, v] of Object.entries(g.zonas || {})) P.form["zona:" + k] = v;
    C.render(); scrollTo(0, 0);
  },
  pSalvarGym() {
    const f = P.form;
    if ((f.nome || "").trim().length < 2) return toast("Dê um nome pra academia.");
    let id = P.ed.id;
    if (!id) {
      const base = f.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 34) || "academia";
      id = base; let n = 2; while (C.S.cat.gyms[id]) id = base + "-" + n++;
    }
    const g = {
      id, nome: f.nome.trim(), sub: (f.sub || "").trim(), ativo: f.ativo !== false,
      unidades: (f.unidades || "").split(",").map(s => s.trim()).filter(Boolean),
      sem: Object.keys(EQUIPAMENTOS).filter(k => f["sem:" + k]),
      zonas: Object.fromEntries(Object.keys(ZONAS).map(k => [k, (f["zona:" + k] || "").trim()]).filter(([, v]) => v)),
      ordem: P.ed.id ? C.S.cat.gyms[id].ordem : C.S.cat.lista.length + 1
    };
    C.tentar(async () => { await C.db.salvarAcademia(g); C.S.cat = await C.db.catalogo(); P.ed = null; P.form = {}; toast("Academia salva."); });
  },
  pEdEx(id) {
    const e = C.S.cat.ex[id];
    P.ed = { id };
    P.form = { nome: e.nome, grupo: e.grupo, dicas: (e.dicas || []).join("\n"), ativo: e.ativo !== false, video_url: e.video_url || "" };
    for (const g of C.S.cat.lista) { const l = e.loc[g.id] || {}; P.form["loc:" + g.id + ":video_url"] = l.video_url || ""; P.form["loc:" + g.id + ":descricao"] = l.descricao || ""; }
    C.render(); scrollTo(0, 0);
  },
  pSalvarEx() {
    const f = P.form, e = C.S.cat.ex[P.ed.id];
    const url = u => { u = (u || "").trim(); if (u && !/^(https:\/\/|blob:)/.test(u)) throw new Error("O link do vídeo precisa começar com https://"); return u; };
    C.tentar(async () => {
      await C.db.salvarExercicio({ id: e.id, nome: f.nome.trim() || e.nome, grupo: (f.grupo || "").trim(), ativo: f.ativo !== false,
        dicas: (f.dicas || "").split("\n").map(s => s.trim()).filter(Boolean), video_url: url(f.video_url) });
      for (const g of C.S.cat.lista) {
        const v = url(f["loc:" + g.id + ":video_url"]), d = (f["loc:" + g.id + ":descricao"] || "").trim(), antes = e.loc[g.id] || {};
        if (v !== (antes.video_url || "") || d !== (antes.descricao || "")) await C.db.salvarLocal(e.id, g.id, { video_url: v, descricao: d });
      }
      C.S.cat = await C.db.catalogo(); P.ed = null; P.form = {}; toast("Exercício salvo.");
    });
  },
  pFecharEd() { P.ed = null; P.form = {}; C.render(); },
  pSalvarEu() {
    const f = P.form;
    C.tentar(async () => {
      if ((f.nome || "").trim().length < 2) throw new Error("Escreva seu nome.");
      C.S.perfil = await C.db.salvarPerfil({ nome: f.nome.trim(), cref: (f.cref || "").trim() || null, whatsapp: (f.whatsapp || "").replace(/\D/g, "").slice(0, 15) });
      C.S.equipe = await C.db.equipe(); toast("Dados salvos.");
    });
  }
};
