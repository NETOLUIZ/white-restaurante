const ExcelJS = require('exceljs');

const LIMITE_LINHAS = 500;

// Faixa Unicode dos acentos combinantes (U+0300–U+036F) — montada por código
// em vez de literal no arquivo-fonte pra não depender da codificação do
// editor/terminal preservar o caractere corretamente.
const COMBINING_MARKS_RE = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g');

/**
 * Cabeçalho → campo, comparado depois de normalizar (sem acento, minúsculo,
 * sem "*"). Assim "Nome*", "nome" e "NOME" batem com a mesma planilha
 * modelo mesmo que o dono do negócio reordene ou capitalize diferente.
 */
const ALIAS_CABECALHO = {
  nome: 'nome',
  preco: 'preco',
  categoria: 'categoria',
  'descricao curta': 'descricaoCurta',
  descricao: 'descricaoCurta',
  estoque: 'estoque',
  'vendido por peso': 'vendidoPorPeso',
};

function normalizarCabecalho(raw) {
  return String(raw || '')
    .normalize('NFD')
    .replace(COMBINING_MARKS_RE, '')
    .toLowerCase()
    .replace(/\*/g, '')
    .trim();
}

/**
 * Uma célula do exceljs pode vir como texto puro, número, texto rico
 * (richText — colar de outro lugar com formatação), fórmula (guarda o
 * resultado em `.result`) ou hyperlink (guarda o texto em `.text`). Reduz
 * tudo isso pra uma string simples.
 */
function celulaParaTexto(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((t) => t.text).join('').trim();
    if ('result' in value) return celulaParaTexto(value.result);
    if ('text' in value) return String(value.text).trim();
  }
  return '';
}

/**
 * Preço aceita "29,90" (padrão BR) e "29.90". Também cobre o caso clássico
 * do Excel: quem digita "29,90" numa planilha em português vê a vírgula na
 * tela, mas o exceljs entrega o NÚMERO 29.9 já convertido — por isso vírgula
 * só é tratada como separador decimal quando a célula chega como texto.
 */
function parsePreco(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return null;
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  const texto = celulaParaTexto(value);
  if (!texto) return null;
  const normalizado = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto;
  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) return null;
  return Number(normalizado);
}

function parseEstoque(value) {
  if (value === null || value === undefined) return { tipo: 'vazio' };
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0 ? { tipo: 'valor', valor: value } : { tipo: 'invalido' };
  const texto = celulaParaTexto(value);
  if (!texto) return { tipo: 'vazio' };
  return /^\d+$/.test(texto) ? { tipo: 'valor', valor: Number(texto) } : { tipo: 'invalido' };
}

function parseVendidoPorPeso(value) {
  const texto = celulaParaTexto(value)
    .normalize('NFD')
    .replace(COMBINING_MARKS_RE, '')
    .toLowerCase()
    .trim();
  if (!texto || texto === 'nao' || texto === 'n') return false;
  if (texto === 'sim' || texto === 's') return true;
  return null; // inválido — nem vazio, nem sim/não reconhecido
}

/**
 * Sem I/O nem banco — só transforma um Workbook já carregado numa lista de
 * linhas válidas + erros linha-a-linha. Duplicata (mesmo nome já existente
 * no banco, ou duas vezes na própria planilha) é checada depois, no
 * controller, que é quem tem acesso ao banco.
 */
function parsePlanilha(workbook) {
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    const erro = new Error('A planilha está vazia — nenhuma aba encontrada.');
    erro.status = 400;
    throw erro;
  }

  const colunaPorCampo = new Map();
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const campo = ALIAS_CABECALHO[normalizarCabecalho(celulaParaTexto(cell.value))];
    if (campo) colunaPorCampo.set(campo, colNumber);
  });

  if (!colunaPorCampo.has('nome')) {
    const erro = new Error('Coluna "Nome" não encontrada — baixe a planilha modelo pra conferir os nomes das colunas.');
    erro.status = 400;
    throw erro;
  }
  if (!colunaPorCampo.has('preco')) {
    const erro = new Error('Coluna "Preço" não encontrada — baixe a planilha modelo pra conferir os nomes das colunas.');
    erro.status = 400;
    throw erro;
  }

  const linhas = [];
  const erros = [];
  let totalLinhasComDado = 0;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const celula = (campo) => {
      const col = colunaPorCampo.get(campo);
      return col ? row.getCell(col).value : undefined;
    };

    const temAlgumValor = [...colunaPorCampo.keys()].some((campo) => celulaParaTexto(celula(campo)).length > 0);
    if (!temAlgumValor) return; // linha "vazia com formatação" — comum em planilha reeditada

    totalLinhasComDado++;
    if (totalLinhasComDado > LIMITE_LINHAS) {
      erros.push({ linha: rowNumber, erro: `Limite de ${LIMITE_LINHAS} linhas por importação excedido.` });
      return;
    }

    const nome = celulaParaTexto(celula('nome'));
    if (!nome) {
      erros.push({ linha: rowNumber, erro: 'Nome é obrigatório.' });
      return;
    }

    const preco = parsePreco(celula('preco'));
    if (preco === null) {
      erros.push({ linha: rowNumber, erro: 'Preço inválido — use 29,90 ou 29.90.' });
      return;
    }

    const estoqueResultado = parseEstoque(celula('estoque'));
    if (estoqueResultado.tipo === 'invalido') {
      erros.push({ linha: rowNumber, erro: 'Estoque inválido — use um número inteiro (ex: 10).' });
      return;
    }

    const vendidoPorPeso = parseVendidoPorPeso(celula('vendidoPorPeso'));
    if (vendidoPorPeso === null) {
      erros.push({ linha: rowNumber, erro: 'Vendido por peso inválido — deixe em branco, ou escreva "Sim" ou "Não".' });
      return;
    }

    // categoriaId é obrigatório no schema (Produto.categoriaId não é nullable) — diferente
    // de deixar "sem categoria" silenciosamente, a planilha precisa dizer qual usar.
    const categoriaNome = celulaParaTexto(celula('categoria'));
    if (!categoriaNome) {
      erros.push({ linha: rowNumber, erro: 'Categoria é obrigatória.' });
      return;
    }

    linhas.push({
      linha: rowNumber,
      nome,
      preco,
      categoriaNome,
      // Sem descrição curta na planilha, usa o próprio nome — evita obrigar
      // o dono do negócio a preencher uma coluna a mais pra cada linha.
      descricaoCurta: celulaParaTexto(celula('descricaoCurta')) || nome,
      estoque: estoqueResultado.tipo === 'valor' ? estoqueResultado.valor : 0,
      vendidoPorPeso,
    });
  });

  if (totalLinhasComDado === 0 && erros.length === 0) {
    const erro = new Error('A planilha não tem nenhuma linha de produto preenchida.');
    erro.status = 400;
    throw erro;
  }

  return { linhas, erros };
}

/** Gera o .xlsx que o dono do negócio baixa e preenche. */
async function gerarPlanilhaModelo() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Produtos');

  sheet.columns = [
    { header: 'Nome*', key: 'nome', width: 28 },
    { header: 'Preço*', key: 'preco', width: 12 },
    { header: 'Categoria*', key: 'categoria', width: 20 },
    { header: 'Descrição curta', key: 'descricaoCurta', width: 32 },
    { header: 'Estoque', key: 'estoque', width: 12 },
    { header: 'Vendido por peso', key: 'vendidoPorPeso', width: 16 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
  });

  sheet.addRow({ nome: 'X-Salada', preco: '24,90', categoria: 'Lanches', descricaoCurta: 'Pão, carne, queijo, alface e tomate', estoque: 50 });
  sheet.addRow({ nome: 'Refrigerante Lata', preco: '6,00', categoria: 'Bebidas', estoque: 100 });
  sheet.addRow({ nome: 'Picanha', preco: '89,90', categoria: 'Carnes', vendidoPorPeso: 'Sim' });

  sheet.getCell('A1').note = 'Obrigatório. Se duas linhas tiverem o mesmo nome, a importação inteira é rejeitada.';
  sheet.getCell('B1').note = 'Obrigatório. Use vírgula ou ponto — "24,90" ou "24.90". Nunca inclua "R$".';
  sheet.getCell('C1').note = 'Obrigatório. Se a categoria não existir ainda, ela é criada automaticamente com esse nome.';
  sheet.getCell('F1').note = 'Deixe em branco para "Não", ou escreva "Sim" — o preço vira por kg e quem compra informa o peso.';

  // Dropdown na coluna "Vendido por peso" (F) — evita erro de digitação pra quem for editar a planilha depois.
  for (let row = 2; row <= LIMITE_LINHAS + 1; row++) {
    sheet.getCell(`F${row}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Sim,Não"'] };
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

module.exports = { parsePlanilha, gerarPlanilhaModelo, LIMITE_LINHAS };
