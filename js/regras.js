/* =========================================================
   Regras de prescrição — o "cérebro" do treino.
   Mudou a regra, muda aqui. Catálogo (academias e exercícios)
   fica no banco; o ponto de partida dele está em catalogo-seed.js.
   ========================================================= */

export const LEVELS = { iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado" };
export const LEVEL_KEYS = ["iniciante", "intermediario", "avancado"];

export const GOALS = {
  hipertrofia:   { n: "Ganhar massa muscular", em: "💪", s: { iniciante: [3, "12"], intermediario: [3, "10 a 12"], avancado: [4, "8 a 10"] }, rest: 75 },
  emagrecimento: { n: "Emagrecer",             em: "🔥", s: { iniciante: [3, "15"], intermediario: [3, "12 a 15"], avancado: [4, "12 a 15"] }, rest: 45 },
  saude:         { n: "Saúde e disposição",    em: "🌿", s: { iniciante: [2, "12"], intermediario: [3, "12"], avancado: [3, "10 a 12"] }, rest: 60 },
  forca:         { n: "Ficar mais forte",      em: "🏋️", s: { iniciante: [3, "10"], intermediario: [4, "6 a 8"], avancado: [5, "5 a 6"] }, rest: 120 }
};

/* Divisões por nível (ids de exercício) */
export const TEMPLATES = {
  iniciante: [
    { nome: "Treino A", foco: "Corpo todo", ex: ["leg_press", "supino_maq", "puxada", "cad_ext", "desenv", "prancha"] },
    { nome: "Treino B", foco: "Corpo todo", ex: ["goblet", "mesa_flex", "remada_baixa", "crucifixo", "elev_pelvica", "abdominal"] }
  ],
  intermediario: [
    { nome: "Treino A", foco: "Peito · ombro · tríceps", ex: ["supino_maq", "supino_reto", "crucifixo", "desenv", "elev_lat", "triceps"] },
    { nome: "Treino B", foco: "Costas · bíceps · core", ex: ["puxada", "remada_baixa", "remada_curv", "rosca", "prancha", "abdominal"] },
    { nome: "Treino C", foco: "Pernas · glúteo", ex: ["agach_smith", "leg_press", "cad_ext", "mesa_flex", "abdutora", "panturrilha"] }
  ],
  avancado: [
    { nome: "Treino A", foco: "Peito · tríceps", ex: ["supino_reto", "supino_maq", "crucifixo", "triceps", "prancha"] },
    { nome: "Treino B", foco: "Costas · bíceps", ex: ["puxada", "remada_curv", "remada_baixa", "rosca", "abdominal"] },
    { nome: "Treino C", foco: "Quadríceps", ex: ["agach_smith", "leg_press", "afundo", "cad_ext", "panturrilha"] },
    { nome: "Treino D", foco: "Ombro · posterior · glúteo", ex: ["desenv", "elev_lat", "stiff", "mesa_flex", "elev_pelvica", "abdutora"] }
  ]
};

/* Trocas por limitação: exercício que força a região → opções em ordem de preferência */
export const LIMITS = {
  joelho: { afundo: ["elev_pelvica", "stiff"], agach_smith: ["leg_press", "elev_pelvica"], goblet: ["mesa_flex", "elev_pelvica"] },
  lombar: { stiff: ["mesa_flex", "elev_pelvica"], remada_curv: ["remada_baixa", "puxada"], agach_smith: ["leg_press", "cad_ext"], goblet: ["leg_press", "cad_ext"] },
  ombro:  { desenv: ["elev_lat", "crucifixo"], supino_reto: ["supino_maq", "crucifixo"] }
};
export const LIMIT_OPTS = [["joelho", "🦵", "Joelho"], ["lombar", "🔙", "Lombar / coluna"], ["ombro", "💪", "Ombro"]];

/* Onde cada tipo de aparelho fica — cada academia descreve as suas zonas */
export const ZONAS = {
  maq_inf: "Máquinas de perna",
  maq_sup: "Máquinas de peito, costas e ombro",
  polia: "Polias / crossover",
  livre: "Pesos livres (halteres e bancos)",
  smith: "Smith",
  solo: "Colchonetes / funcional"
};

/* Aparelhos que uma academia pode NÃO ter (o treino troca sozinho) */
export const EQUIPAMENTOS = {
  legpress: "Leg press 45°", extensora: "Cadeira extensora", flexora: "Mesa flexora", abdutora: "Cadeira abdutora",
  smith: "Smith", panturrilha: "Panturrilha em pé", chestpress: "Supino máquina", peckdeck: "Peck deck",
  desenvolvimento: "Desenvolvimento máquina", polia: "Polia (corda)", pulley: "Pulley (puxada)", remada: "Remada baixa",
  halter: "Halteres", banco: "Banco", elastico: "Elástico", colchonete: "Colchonete"
};

export const PARQ = [
  "Algum médico já disse que você tem problema no coração e só deve fazer atividade física recomendada por ele?",
  "Você sente dor no peito quando faz atividade física?",
  "No último mês, sentiu dor no peito mesmo sem fazer atividade física?",
  "Você perde o equilíbrio por tontura ou já desmaiou?",
  "Tem algum problema ósseo ou articular que pode piorar com exercício?",
  "Toma remédio para pressão ou para o coração?",
  "Sabe de algum outro motivo para não fazer atividade física?"
];

export const QUIZ = [
  { q: "Há quanto tempo você treina sem parar mais de um mês?", o: [["Nunca treinei ou menos de 6 meses", 0], ["De 6 meses a 2 anos", 1], ["Mais de 2 anos", 2]] },
  { q: "Quantas vezes por semana você treina hoje?", o: [["0 ou 1 vez", 0], ["2 ou 3 vezes", 1], ["4 vezes ou mais", 2]] },
  { q: "Você consegue regular os aparelhos sozinho(a)? Banco, pino de carga, encosto…", o: [["Não, sempre peço ajuda", 0], ["Alguns eu sei", 1], ["Sei regular todos", 2]] },
  { q: "Como é seu agachamento livre?", o: [["Nunca fiz", 0], ["Faço, mas tenho dificuldade", 1], ["Faço com carga e boa técnica", 2]] },
  { q: "Já seguiu treino dividido (A, B, C)?", o: [["Nunca", 0], ["Já, mas parei", 1], ["Sigo hoje", 2]] },
  { q: "No dia seguinte ao treino, você costuma ficar:", o: [["Muito dolorido(a) por dias", 0], ["Cansado(a), mas recupero rápido", 1], ["Querendo mais volume", 2]] }
];

export const RPE = [["😮‍💨", "Leve"], ["🙂", "Ok"], ["😤", "Puxado"], ["🥵", "Pesado"], ["💀", "No limite"]];
