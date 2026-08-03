const { validarHorarioFuncionamento, estaAberto, ErroValidacaoHorario } = require('../utils/horarioFuncionamento');

const HORARIO_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Gera a lista de horários de 30 em 30 min entre inicio e fim (inclusive), formato "HH:MM". */
function gerarHorarios(inicio, fim) {
  const [hIni, mIni] = inicio.split(':').map(Number);
  const [hFim, mFim] = fim.split(':').map(Number);
  const minutosIni = hIni * 60 + mIni;
  const minutosFim = hFim * 60 + mFim;
  const horarios = [];
  for (let m = minutosIni; m <= minutosFim; m += 30) {
    const h = String(Math.floor(m / 60)).padStart(2, '0');
    const min = String(m % 60).padStart(2, '0');
    horarios.push(`${h}:${min}`);
  }
  return horarios;
}

function comHorariosGaleto(config) {
  return {
    ...config,
    galetoHorarios: gerarHorarios(config.galetoHorarioInicio, config.galetoHorarioFim),
    // Calculado no servidor pra não depender do relógio/fuso do navegador do cliente.
    abertoAgora: estaAberto(config.horarioFuncionamento),
  };
}

/** Lê a configuração da loja (1 registro por tenant) — cria com o padrão se ainda não existir. */
async function obter(req, res) {
  try {
    // where/create vazios: a extension injeta tenantId (único, ver schema) —
    // já basta pra identificar/criar a linha certa, sem id fixo (Fase 1).
    const config = await req.prisma.configuracao.upsert({
      where: {},
      update: {},
      create: {},
    });
    res.json({ ...comHorariosGaleto(config), tenant: { tipo: req.tenant ? req.tenant.tipo : 'RESTAURANTE', slug: req.tenant ? req.tenant.slug : '', nome: req.tenant ? req.tenant.nome : '' } });
  } catch (err) {
    console.error('Erro ao obter configuração:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Atualiza taxa de entrega, janela de retirada dos Galetos e/ou horário de funcionamento — painel admin. */
async function atualizar(req, res) {
  try {
    const data = {};
    if (req.body.horarioFuncionamento !== undefined) {
      try {
        data.horarioFuncionamento = validarHorarioFuncionamento(req.body.horarioFuncionamento);
      } catch (err) {
        if (err instanceof ErroValidacaoHorario) {
          return res.status(400).json({ erro: err.message });
        }
        throw err;
      }
    }
    if (req.body.taxaEntrega !== undefined) {
      const taxaEntrega = Number(req.body.taxaEntrega);
      if (!Number.isFinite(taxaEntrega) || taxaEntrega < 0) {
        return res.status(400).json({ erro: 'Taxa de entrega inválida' });
      }
      data.taxaEntrega = taxaEntrega;
    }
    if (req.body.galetoHorarioInicio !== undefined || req.body.galetoHorarioFim !== undefined) {
      const inicio = req.body.galetoHorarioInicio;
      const fim = req.body.galetoHorarioFim;
      if (!HORARIO_REGEX.test(inicio) || !HORARIO_REGEX.test(fim)) {
        return res.status(400).json({ erro: 'Horário inválido — use o formato HH:MM' });
      }
      if (inicio >= fim) {
        return res.status(400).json({ erro: 'Horário inicial precisa ser antes do horário final' });
      }
      data.galetoHorarioInicio = inicio;
      data.galetoHorarioFim = fim;
    }

    const config = await req.prisma.configuracao.upsert({
      where: {},
      update: data,
      create: { ...data },
    });
    res.json(comHorariosGaleto(config));
  } catch (err) {
    console.error('Erro ao atualizar configuração:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { obter, atualizar };
