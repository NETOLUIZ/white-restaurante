const { Prisma } = require('@prisma/client');

const HORARIO_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Ordem alinhada com Date.getDay() (0 = domingo) — usada por estaAberto().
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

const MAX_TURNOS_POR_DIA = 2;

class ErroValidacaoHorario extends Error {}

function horarioParaMinutos(horario) {
  const [h, m] = horario.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Valida e normaliza o objeto de horário de funcionamento vindo do painel.
 * Formato esperado: { seg: [{inicio,fim}, ...], ter: [...], ... } — chave
 * ausente ou array vazio = loja fechada nesse dia. Lança ErroValidacaoHorario
 * (400) na primeira inconsistência.
 */
function validarHorarioFuncionamento(valor) {
  // Prisma exige Prisma.DbNull (não o `null` do JS) pra gravar SQL NULL num
  // campo Json — passar `null` puro lança em runtime. Limpar o cadastro
  // = "sempre aberto" (ver comentário do model).
  if (valor === null) return Prisma.DbNull;
  if (typeof valor !== 'object' || Array.isArray(valor)) {
    throw new ErroValidacaoHorario('Horário de funcionamento inválido');
  }

  const normalizado = {};
  for (const dia of Object.keys(valor)) {
    if (!DIAS.includes(dia)) {
      throw new ErroValidacaoHorario(`Dia "${dia}" inválido — use: ${DIAS.join(', ')}`);
    }
    const turnos = valor[dia];
    if (!Array.isArray(turnos)) {
      throw new ErroValidacaoHorario(`Turnos de "${dia}" precisam ser uma lista`);
    }
    if (turnos.length > MAX_TURNOS_POR_DIA) {
      throw new ErroValidacaoHorario(`"${dia}" pode ter no máximo ${MAX_TURNOS_POR_DIA} turnos`);
    }

    let fimAnterior = -1;
    const turnosValidados = [];
    for (const turno of turnos) {
      const inicio = turno && turno.inicio;
      const fim = turno && turno.fim;
      if (!HORARIO_REGEX.test(inicio) || !HORARIO_REGEX.test(fim)) {
        throw new ErroValidacaoHorario(`Horário de "${dia}" inválido — use o formato HH:MM`);
      }
      const inicioMin = horarioParaMinutos(inicio);
      const fimMin = horarioParaMinutos(fim);
      if (inicioMin >= fimMin) {
        throw new ErroValidacaoHorario(`Em "${dia}", o horário inicial precisa ser antes do final`);
      }
      // Turnos vêm ordenados por início (tela sempre manda manhã antes de tarde) —
      // basta comparar contra o fim do turno anterior pra pegar sobreposição.
      if (inicioMin < fimAnterior) {
        throw new ErroValidacaoHorario(`Os turnos de "${dia}" não podem se sobrepor`);
      }
      fimAnterior = fimMin;
      turnosValidados.push({ inicio, fim });
    }
    normalizado[dia] = turnosValidados;
  }
  return normalizado;
}

/**
 * A loja está aberta agora? `horarioFuncionamento` no formato validado acima.
 * null/undefined = sem restrição cadastrada, sempre aberta (compatível com
 * quem nunca configurou isto). Usa hora local do processo Node — mesmo
 * critério que o resto do projeto usa pra "agora" (ver index.html:saudacao()).
 */
function estaAberto(horarioFuncionamento, agora = new Date()) {
  if (!horarioFuncionamento) return true;

  const dia = DIAS[agora.getDay()];
  const turnos = horarioFuncionamento[dia];
  if (!Array.isArray(turnos) || turnos.length === 0) return false;

  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
  return turnos.some((t) => minutosAgora >= horarioParaMinutos(t.inicio) && minutosAgora <= horarioParaMinutos(t.fim));
}

module.exports = { DIAS, validarHorarioFuncionamento, estaAberto, ErroValidacaoHorario };
