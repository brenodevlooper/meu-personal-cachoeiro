# Meu Personal Cachoeiro

App (PWA) de treino montado para a academia do aluno, validado e acompanhado por personal com CREF.
O aluno faz cadastro, responde PAR-Q e quiz, escolhe a academia e recebe o treino com vídeo de execução +
vídeo "onde fica o aparelho" naquela academia. O personal valida o nível, libera quem marcou "sim" no PAR-Q
e acompanha pelo painel e pelo WhatsApp.

## Rodar

```bash
npm install          # só para os testes (PGlite)
npm run dev          # http://127.0.0.1:5620
npm test             # regras de treino + banco (RLS) num Postgres em memória
```

Sem chaves em `js/config.js` o app roda em **modo demonstração** (dados no navegador). Contas de exemplo:
`aluno@demo.com` e `personal@demo.com`, senha `demo1234` (ou os botões na tela inicial).

## Estrutura

| Arquivo | O que é |
|---|---|
| `index.html` | Casca do app (sem build: ES modules direto no navegador) |
| `js/config.js` | **Único arquivo a mexer pra pôr no ar** (chaves do Supabase, regras gerais) |
| `js/regras.js` | Prescrição: divisões por nível, objetivos, trocas por lesão, PAR-Q, quiz |
| `js/plano.js` | Monta o treino (função pura, testada em `tests/plano.test.mjs`) |
| `js/catalogo-seed.js` | Exercícios e academias iniciais → gera `supabase/seed.sql` (`npm run seed`) |
| `js/app.js` | App do aluno + roteamento |
| `js/painel.js` | Painel do personal |
| `js/db/supabase.js` · `js/db/local.js` | Mesma interface: produção e demonstração |
| `supabase/migrations/` | Schema, RLS, funções e bucket de vídeos |
| `termos.html` · `privacidade.html` | Textos legais (faltam os dados da empresa: procurar `[`) |
| `prototipo.html` | Protótipo da apresentação de 28/10 (referência) |

## Pôr no ar (Supabase)

1. Criar projeto em supabase.com, **região São Paulo (sa-east-1)**.
2. SQL Editor → rodar, nesta ordem: `supabase/migrations/0001_schema.sql`, `0002_storage.sql`, `supabase/seed.sql`.
3. Authentication → URL Configuration: Site URL = endereço onde o app vai ficar.
4. Project Settings → API: copiar **Project URL** e **anon public key** para `js/config.js`. Nunca a `service_role`.
5. Criar a conta do personal pelo próprio app (cadastro normal) e promover no SQL Editor:
   ```sql
   update public.profiles set role = 'personal' where id = (select id from auth.users where email = 'EMAIL_DO_PERSONAL');
   ```
6. Entrar como personal → **Meus dados**: nome, CREF e WhatsApp (aparecem para o aluno).
7. Publicar a pasta em hospedagem estática com HTTPS (GitHub Pages, Netlify, Vercel). Colocar no servidor o
   cabeçalho `Content-Security-Policy: frame-ancestors 'none'` (não funciona via `<meta>`).

## Segurança (o que o banco garante — não o app)

- RLS em todas as tabelas: aluno lê e grava só o que é dele; personal lê tudo.
- Aluno **não** muda o próprio papel, o nível validado nem a liberação do PAR-Q (sem GRANT nessas colunas;
  só as funções `validar_aluno` e `liberar_parq`, que conferem se quem chama é personal).
- "Marcou sim no PAR-Q" e o nível sugerido são calculados por trigger no banco.
- Menor de 18 é barrado no cadastro pelo banco.
- Retirar consentimento (`retirar_consentimento_saude`) e excluir conta (`excluir_minha_conta`) apagam os dados na hora.
- Tudo isso está coberto em `tests/banco.test.mjs` (11 testes tentando furar as regras).

## Regras de produto que vieram do jurídico

- Nenhum treino libera sem um personal validar o nível (`exigirValidacao: true`). Cada treino mostra
  "Validado por [nome] · CREF [nº] · em [data]".
- PAR-Q com "sim" bloqueia o treino até o personal registrar como conferiu a liberação (sem anexar laudo).
- Consentimento específico para dado de saúde em tela própria, antes do PAR-Q.
- Nome da academia só em texto, sem logo, com aviso de que não há parceria.
