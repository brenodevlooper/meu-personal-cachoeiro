/* =========================================================
   Ponto de partida do catálogo. Vai pro banco pelo seed.sql
   (gerado por: node scripts/gerar-seed.mjs) e alimenta o modo
   demonstração. Depois do lançamento, quem edita é o personal,
   pelo painel — não este arquivo.
   ========================================================= */

/* Exercícios. zona = onde costuma ficar; eq = aparelho; alt = troca se a academia não tiver o aparelho */
export const EXERCICIOS = [
  { id: "leg_press", nome: "Leg Press 45°", grupo: "Pernas", zona: "maq_inf", eq: "legpress", icone: "leg", dicas: ["Lombar inteira encostada no banco", "Desça até o joelho formar 90°", "Não trave o joelho na subida"] },
  { id: "cad_ext", nome: "Cadeira Extensora", grupo: "Quadríceps", zona: "maq_inf", eq: "extensora", icone: "leg", dicas: ["Ajuste o encosto: joelho alinhado ao eixo da máquina", "Suba em 1s, desça em 3s"] },
  { id: "mesa_flex", nome: "Mesa Flexora", grupo: "Posterior", zona: "maq_inf", eq: "flexora", icone: "leg", dicas: ["Quadril colado no banco", "Rolo logo acima do calcanhar"] },
  { id: "abd_elastico", nome: "Abdução com Elástico", grupo: "Glúteo", zona: "solo", eq: "elastico", icone: "leg", dicas: ["Elástico acima do joelho", "Movimento lento e controlado"] },
  { id: "abdutora", nome: "Cadeira Abdutora", grupo: "Glúteo", zona: "maq_inf", eq: "abdutora", icone: "leg", alt: "abd_elastico", dicas: ["Tronco levemente à frente para pegar mais glúteo", "Segure 1s aberto"] },
  { id: "goblet", nome: "Agachamento Goblet", grupo: "Pernas", zona: "livre", eq: "halter", icone: "leg", dicas: ["Halter colado no peito", "Joelhos acompanham a ponta dos pés"] },
  { id: "agach_smith", nome: "Agachamento no Smith", grupo: "Pernas", zona: "smith", eq: "smith", icone: "leg", alt: "goblet", dicas: ["Pés um pouco à frente da barra", "Desça com o peito aberto"] },
  { id: "afundo", nome: "Afundo com Halteres", grupo: "Pernas", zona: "livre", eq: "halter", icone: "leg", dicas: ["Passo longo", "Joelho de trás quase encosta no chão"] },
  { id: "elev_pelvica", nome: "Elevação Pélvica", grupo: "Glúteo", zona: "livre", eq: "banco", icone: "leg", dicas: ["Escápulas apoiadas no banco", "Contraia o glúteo 1s em cima"] },
  { id: "stiff", nome: "Stiff com Halteres", grupo: "Posterior", zona: "livre", eq: "halter", icone: "leg", dicas: ["Coluna neutra o tempo todo", "Halteres rentes à perna"] },
  { id: "panturrilha", nome: "Panturrilha em Pé", grupo: "Panturrilha", zona: "maq_inf", eq: "panturrilha", icone: "leg", dicas: ["Amplitude total", "Pausa de 1s embaixo"] },
  { id: "supino_maq", nome: "Supino Máquina", grupo: "Peito", zona: "maq_sup", eq: "chestpress", icone: "push", dicas: ["Pegada na linha do meio do peito", "Ombros para trás e para baixo"] },
  { id: "supino_reto", nome: "Supino Reto com Halteres", grupo: "Peito", zona: "livre", eq: "halter", icone: "push", dicas: ["Escápulas encaixadas", "Desça até a linha do peito"] },
  { id: "crucifixo", nome: "Crucifixo Máquina (Peck Deck)", grupo: "Peito", zona: "maq_sup", eq: "peckdeck", icone: "push", dicas: ["Cotovelos levemente flexionados", "Abra devagar"] },
  { id: "desenv", nome: "Desenvolvimento Máquina", grupo: "Ombro", zona: "maq_sup", eq: "desenvolvimento", icone: "push", dicas: ["Não arqueie a lombar", "Pare a descida na linha da orelha"] },
  { id: "elev_lat", nome: "Elevação Lateral", grupo: "Ombro", zona: "livre", eq: "halter", icone: "push", dicas: ["Suba até a linha do ombro", "Sem balanço do tronco"] },
  { id: "triceps", nome: "Tríceps na Polia (corda)", grupo: "Tríceps", zona: "polia", eq: "polia", icone: "push", dicas: ["Cotovelos colados no corpo", "Abra a corda no final"] },
  { id: "puxada", nome: "Puxada Frontal", grupo: "Costas", zona: "polia", eq: "pulley", icone: "pull", dicas: ["Puxe a barra até o peito", "Peito aberto, sem jogar o corpo para trás"] },
  { id: "remada_baixa", nome: "Remada Baixa", grupo: "Costas", zona: "polia", eq: "remada", icone: "pull", dicas: ["Coluna reta", "Cotovelos rente ao corpo"] },
  { id: "remada_curv", nome: "Remada Unilateral com Halter", grupo: "Costas", zona: "livre", eq: "halter", icone: "pull", dicas: ["Mão e joelho apoiados no banco", "Puxe o cotovelo em direção ao quadril"] },
  { id: "rosca", nome: "Rosca Direta com Halteres", grupo: "Bíceps", zona: "livre", eq: "halter", icone: "pull", dicas: ["Cotovelos parados", "Desça em 3s"] },
  { id: "prancha", nome: "Prancha", grupo: "Core", zona: "solo", eq: "colchonete", icone: "core", dicas: ["Corpo em linha reta", "Contraia abdômen e glúteo"] },
  { id: "abdominal", nome: "Abdominal Supra", grupo: "Core", zona: "solo", eq: "colchonete", icone: "core", dicas: ["Tire só as escápulas do chão", "Solte o ar na subida"] }
];

/* Academias que entram no banco de verdade. As zonas ficam VAZIAS de propósito:
   só se preenche depois da visita de mapeamento (o app mostra "em mapeamento"). */
export const ACADEMIAS = [
  { id: "smartfit", nome: "Smart Fit", sub: "Rede · aparelhos padronizados", unidades: ["Cachoeiro"], sem: [], zonas: {}, ordem: 1 }
];

/* Só no modo demonstração: zonas inventadas pra apresentação. NUNCA vão pro banco. */
export const ACADEMIAS_DEMO = [
  { id: "smartfit", nome: "Smart Fit", sub: "Rede · aparelhos padronizados", unidades: ["Cachoeiro"], sem: [], ordem: 1,
    zonas: { maq_inf: "Área de máquinas de perna, ao fundo à esquerda da recepção", maq_sup: "Fileira central de máquinas de peito, costas e ombro", polia: "Torre de polias, ao lado do espelho grande", livre: "Área de pesos livres, rack de halteres", smith: "Smith, ao lado dos racks de agachamento", solo: "Área de colchonetes / funcional, perto dos bebedouros" } },
  { id: "bairro", nome: "Academia do Bairro", sub: "Exemplo de academia local", unidades: ["Centro", "Gilberto Machado"], sem: ["smith", "abdutora"], ordem: 2,
    zonas: { maq_inf: "Salão de baixo, fileira encostada na parede da janela", maq_sup: "Salão de baixo, perto da escada", polia: "Crossover no fundo do salão", livre: "Mezanino, prateleira de halteres", solo: "Sala de ginástica, colchonetes no armário" } }
];
