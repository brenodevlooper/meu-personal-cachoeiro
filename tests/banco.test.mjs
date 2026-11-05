// Roda o schema real num Postgres em memória (PGlite) com um "Supabase de mentira"
// (roles anon/authenticated + auth.users + auth.uid()) e tenta furar as regras de acesso.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const ler = f => readFileSync(new URL("../supabase/" + f, import.meta.url), "utf8");
const db = new PGlite();
const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const P = "00000000-0000-0000-0000-0000000000ff";

async function como(uid, fn) {
  await db.exec(uid ? `set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`
                    : `set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  try { return await fn(); } finally { await db.exec("reset role;"); }
}
const falha = async (p, re) => { await assert.rejects(p, re); };
const linhas = async sql => (await db.query(sql)).rows;

before(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await db.exec(ler("migrations/0001_schema.sql"));
  await db.exec(ler("seed.sql"));
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${A}', 'a@x.com', '{"nome":"Ana","whatsapp":"(28) 99999-0001","nascimento":"1995-03-10","termos":"true"}'),
      ('${B}', 'b@x.com', '{"nome":"Bia","whatsapp":"28999990002"}'),
      ('${P}', 'p@x.com', '{"nome":"Personal"}');
    update public.profiles set role = 'personal', cref = '000000-G/ES' where id = '${P}';
  `);
});

test("cadastro cria perfil de aluno com WhatsApp só com dígitos e termos carimbados", async () => {
  const [a] = await linhas(`select role, whatsapp, termos_aceitos_em is not null as t from profiles where id = '${A}'`);
  assert.deepEqual(a, { role: "aluno", whatsapp: "28999990001", t: true });
});

test("menor de 18 não consegue se cadastrar", async () => {
  await falha(db.exec(`insert into auth.users (id, raw_user_meta_data) values (gen_random_uuid(), '{"nascimento":"2012-01-01"}')`), /18 anos/);
});

test("anônimo lê o catálogo e não lê ninguém", async () => {
  await como(null, async () => {
    assert.equal((await linhas("select id from gyms")).length, 1);
    assert.equal((await linhas("select id from exercises")).length, 23);
    await falha(db.query("select * from profiles"), /permission denied/);
    await falha(db.query("select * from equipe"), /permission denied/);
  });
});

test("aluno só enxerga o próprio perfil", async () => {
  await como(A, async () => {
    const r = await linhas("select id from profiles");
    assert.deepEqual(r.map(x => x.id), [A]);
  });
});

test("aluno não vira personal nem valida o próprio nível", async () => {
  await como(A, async () => {
    await falha(db.query("update profiles set role = 'personal' where id = auth.uid()"), /permission denied/);
    await falha(db.query("update profiles set nivel_validado = 'avancado' where id = auth.uid()"), /permission denied/);
    await falha(db.query(`select validar_aluno('${A}', 'avancado')`), /sem permissão/);
    await db.query("update profiles set quiz = '{\"0\":2,\"1\":2,\"2\":2,\"3\":2,\"4\":2,\"5\":2}', objetivo = 'forca', dias = 4 where id = auth.uid()");
  });
  const [a] = await linhas(`select nivel_quiz, nivel_validado from profiles where id = '${A}'`);
  assert.deepEqual(a, { nivel_quiz: "avancado", nivel_validado: null }); // nível calculado no banco
});

test("aluno não altera o perfil de outro aluno", async () => {
  await como(A, async () => {
    const r = await db.query(`update profiles set nome = 'hack' where id = '${B}'`);
    assert.equal(r.affectedRows, 0);
  });
  assert.equal((await linhas(`select nome from profiles where id = '${B}'`))[0].nome, "Bia");
});

test("PAR-Q: o banco decide o 'sim' e o aluno não se auto-libera", async () => {
  await como(A, async () => {
    await falha(db.query(`insert into health_screenings (user_id, respostas, consentimento_em, liberado) values ('${A}', '{"0":true}', now(), true)`), /permission denied/);
    await db.query(`insert into health_screenings (user_id, respostas, consentimento_em) values ('${A}', '{"0":false,"4":true}', now())`);
    await falha(db.query(`insert into health_screenings (user_id, respostas, consentimento_em) values ('${B}', '{"0":false}', now())`), /row-level security/);
  });
  const [s] = await linhas(`select tem_sim, liberado from health_screenings where user_id = '${A}'`);
  assert.deepEqual(s, { tem_sim: true, liberado: false });
});

test("aluno não registra treino nem peso no nome de outro", async () => {
  await como(A, async () => {
    await db.query(`insert into workout_logs (user_id, treino, rpe) values ('${A}', 'Treino A', 3)`);
    await db.query(`insert into weights (user_id, kg) values ('${A}', 70.5)`);
    await falha(db.query(`insert into workout_logs (user_id, treino, rpe) values ('${B}', 'Treino A', 3)`), /row-level security/);
    await falha(db.query(`insert into weights (user_id, kg) values ('${A}', 900)`), /check constraint/);
  });
  await como(B, async () => {
    assert.equal((await linhas("select * from workout_logs")).length, 0);
    assert.equal((await linhas("select * from health_screenings")).length, 0);
  });
});

test("personal vê todos, valida nível, libera PAR-Q e aparece na equipe", async () => {
  await como(P, async () => {
    const painel = await linhas("select nome, treinos_total, parq_sim, parq_liberado from painel_alunos order by nome");
    assert.deepEqual(painel.map(x => x.nome), ["Ana", "Bia"]);
    assert.equal(painel[0].treinos_total, 1);
    await db.query(`select validar_aluno('${A}', 'intermediario')`);
    const [s] = await linhas(`select id from health_screenings where user_id = '${A}'`);
    await db.query(`select liberar_parq('${s.id}', 'liberação médica conferida por telefone')`);
    await falha(db.query("update profiles set role = 'aluno' where id = auth.uid()"), /permission denied/);
  });
  const [a] = await linhas(`select nivel_validado, validado_por from profiles where id = '${A}'`);
  assert.deepEqual(a, { nivel_validado: "intermediario", validado_por: P });
  await como(A, async () => {
    assert.deepEqual(await linhas("select nome, cref from equipe"), [{ nome: "Personal", cref: "000000-G/ES" }]);
    assert.equal((await linhas("select liberado from health_screenings"))[0].liberado, true);
  });
});

test("catálogo: só o personal escreve", async () => {
  await como(A, async () => {
    await falha(db.query("update gyms set nome = 'x' where id = 'smartfit'").then(r => { if (!r.affectedRows) throw new Error("row-level security: 0 linhas"); }), /row-level security/);
    await falha(db.query("insert into gyms (id, nome) values ('fake', 'Fake')"), /row-level security/);
  });
  await como(P, async () => {
    await db.query("insert into gyms (id, nome, sem) values ('bairro', 'Academia do Bairro', '{smith}')");
    await db.query("insert into exercise_locations (exercise_id, gym_id, video_url) values ('leg_press', 'bairro', 'https://x/v.mp4')");
  });
});

test("retirar consentimento apaga PAR-Q; excluir conta apaga tudo do aluno", async () => {
  await como(A, async () => {
    await db.query("select retirar_consentimento_saude()");
    assert.equal((await linhas("select * from health_screenings")).length, 0);
    await db.query("select excluir_minha_conta()");
  });
  assert.equal((await linhas(`select * from profiles where id = '${A}'`)).length, 0);
  assert.equal((await linhas(`select * from workout_logs where user_id = '${A}'`)).length, 0);
  assert.equal((await linhas(`select * from auth.users where id = '${A}'`)).length, 0);
});
