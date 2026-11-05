/* =========================================================
   CONFIG — único arquivo a mexer na hora de pôr no ar.
   Sem supabaseUrl/supabaseAnonKey o app roda em MODO DEMONSTRAÇÃO:
   tudo funciona, mas os dados ficam só no navegador de quem abriu.
   A anon key é pública por natureza (a segurança está no RLS do banco).
   NUNCA colocar aqui a service_role key.
   ========================================================= */
export const CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",

  app: "Meu Personal Cachoeiro",
  cidade: "Cachoeiro de Itapemirim",

  // Treino só libera depois que um personal com CREF valida o nível (recomendação jurídica).
  exigirValidacao: true,

  // WhatsApp de contato quando a equipe ainda não cadastrou o dela (só dígitos, com 55 + DDD)
  whatsappContato: "",

  // Aluno some do radar do personal depois de quantos dias sem treinar
  diasSumido: 5
};

export const MODO_DEMO = !CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey;
