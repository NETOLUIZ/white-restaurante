# white- label — Front-end

Protótipo front-end do sistema Bel do Frango.

## Estrutura
- `index.html`: página de entrada com navegação para os módulos.
- `styles/main.css`: estilos extraídos do HTML principal.
- `scripts/support.js`: runtime do DC que carrega React e inicializa os componentes.
- `assets/`: imagens e ícones usados pelo front-end.

## Como usar
1. Instale dependências:
   ```bash
   npm install
   ```
2. Inicie o servidor:
   ```bash
   npm run start
   ```
3. Abra `http://127.0.0.1:5000` no navegador.

## Observações
- `support.js` é um arquivo gerado pelo DC runtime e não deve ser editado manualmente.
- O protótipo usa React via runtime e páginas `.dc.html` para renderizar os módulos do sistema.
