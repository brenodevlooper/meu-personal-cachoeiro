/* Adaptador de produção: Supabase (Auth + Postgres com RLS + Storage).
   Mesma interface do adaptador local (local.js). */
import { CONFIG } from "../config.js";

let sb;
async function cli() {
  if (!sb) {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
    sb = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  }
  return sb;
}
const ok = ({ data, error }) => { if (error) throw error; return data; };
async function uid() { const { data } = await (await cli()).auth.getSession(); return data.session && data.session.user.id; }

export const db = {
  demo: false,

  /* ---------- conta ---------- */
  async sessao() {
    const { data } = await (await cli()).auth.getSession();
    return data.session ? { id: data.session.user.id, email: data.session.user.email } : null;
  },
  async aoMudarSessao(cb) { (await cli()).auth.onAuthStateChange((ev) => cb(ev)); },
  async cadastrar({ email, senha, nome, whatsapp, nascimento }) {
    const r = ok(await (await cli()).auth.signUp({
      email, password: senha,
      options: { data: { nome, whatsapp, nascimento, termos: "true" }, emailRedirectTo: location.origin + location.pathname }
    }));
    return { precisaConfirmar: !r.session };
  },
  async entrar(email, senha) { ok(await (await cli()).auth.signInWithPassword({ email, password: senha })); },
  async sair() { await (await cli()).auth.signOut(); },
  async recuperarSenha(email) { ok(await (await cli()).auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + "?nova-senha" })); },
  async novaSenha(senha) { ok(await (await cli()).auth.updateUser({ password: senha })); },

  /* ---------- aluno ---------- */
  async perfil() { return ok(await (await cli()).from("profiles").select("*").eq("id", await uid()).single()); },
  async salvarPerfil(patch) {
    return ok(await (await cli()).from("profiles").update(patch).eq("id", await uid()).select().single());
  },
  async catalogo() {
    const c = await cli();
    const [g, e, l] = await Promise.all([
      c.from("gyms").select("*").order("ordem"),
      c.from("exercises").select("*").order("nome"),
      c.from("exercise_locations").select("*")
    ]);
    return montarCatalogo(ok(g), ok(e), ok(l));
  },
  async equipe() { return ok(await (await cli()).from("equipe").select("*")); },
  async ultimoParq(userId) {
    const r = ok(await (await cli()).from("health_screenings").select("*").eq("user_id", userId || await uid()).order("created_at", { ascending: false }).limit(1));
    return r[0] || null;
  },
  async salvarParq(respostas) {
    return ok(await (await cli()).from("health_screenings").insert({ user_id: await uid(), respostas, consentimento_em: new Date().toISOString() }).select().single());
  },
  async treinos(userId) {
    return ok(await (await cli()).from("workout_logs").select("*").eq("user_id", userId || await uid()).order("created_at", { ascending: false }).limit(200));
  },
  async registrarTreino(t) { return ok(await (await cli()).from("workout_logs").insert({ ...t, user_id: await uid() }).select().single()); },
  async pesos(userId) {
    return ok(await (await cli()).from("weights").select("*").eq("user_id", userId || await uid()).order("created_at", { ascending: true }).limit(200));
  },
  async registrarPeso(kg) { return ok(await (await cli()).from("weights").insert({ user_id: await uid(), kg }).select().single()); },
  async pedirAcademia(texto) { ok(await (await cli()).from("gym_requests").insert({ user_id: await uid(), texto })); },
  async retirarConsentimento() { ok(await (await cli()).rpc("retirar_consentimento_saude")); },
  async excluirConta() { ok(await (await cli()).rpc("excluir_minha_conta")); await (await cli()).auth.signOut(); },

  /* ---------- personal ---------- */
  async painelAlunos() { return ok(await (await cli()).from("painel_alunos").select("*").order("nome")); },
  async aluno(id) {
    const c = await cli();
    const [p, s, t, w] = await Promise.all([
      c.from("profiles").select("*").eq("id", id).single(),
      c.from("health_screenings").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(1),
      this.treinos(id), this.pesos(id)
    ]);
    return { perfil: ok(p), parq: ok(s)[0] || null, treinos: t, pesos: w };
  },
  async validarAluno(id, nivel) { ok(await (await cli()).rpc("validar_aluno", { aluno: id, nivel })); },
  async liberarParq(id, obs) { ok(await (await cli()).rpc("liberar_parq", { screening: id, observacao: obs || null })); },
  async pedidos() { return ok(await (await cli()).from("gym_requests").select("*").order("created_at", { ascending: false })); },
  async statusPedido(id, status) { ok(await (await cli()).from("gym_requests").update({ status }).eq("id", id)); },
  async salvarAcademia(g) {
    const { id, nome, sub, unidades, sem, zonas, ativo, ordem } = g;
    ok(await (await cli()).from("gyms").upsert({ id, nome, sub, unidades, sem, zonas, ativo, ordem }));
  },
  async salvarExercicio(e) {
    const { id, nome, grupo, dicas, video_url, ativo } = e;
    ok(await (await cli()).from("exercises").update({ nome, grupo, dicas, video_url: video_url || null, ativo }).eq("id", id));
  },
  async salvarLocal(exercise_id, gym_id, { video_url, descricao }) {
    ok(await (await cli()).from("exercise_locations").upsert({ exercise_id, gym_id, video_url: video_url || null, descricao: descricao || null }));
  },
  async enviarVideo(arquivo, caminho) {
    const c = await cli();
    ok(await c.storage.from("videos").upload(caminho, arquivo, { upsert: true, contentType: arquivo.type, cacheControl: "604800" }));
    return c.storage.from("videos").getPublicUrl(caminho).data.publicUrl + "?v=" + Date.now();
  }
};

export function montarCatalogo(gyms, exs, locs) {
  const ex = Object.fromEntries(exs.map(e => [e.id, { ...e, loc: {} }]));
  for (const l of locs) if (ex[l.exercise_id]) ex[l.exercise_id].loc[l.gym_id] = l;
  return { gyms: Object.fromEntries(gyms.map(g => [g.id, g])), lista: gyms, ex };
}
