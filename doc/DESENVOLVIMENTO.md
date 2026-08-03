# Guia de Desenvolvimento - Bel do Frango

## 🚀 Começar Rápido

### 1. Instalar Dependências
```bash
npm install
```

### 2. Iniciar o Servidor
```bash
npm run start
```
A aplicação abrirá em `http://localhost:5000`

### 3. Estrutura de Pastas
Veja [ESTRUTURA.md](./ESTRUTURA.md) para detalhes completos da organização do projeto.

---

## 💻 Exemplos de Código

### Usando o Hook `useAuth()`
```typescript
import { useAuth } from '@/hooks/useAuth';

function MeuComponente() {
  const { usuario, autenticado, login, logout } = useAuth();

  const handleLogin = async () => {
    const sucesso = await login('email@example.com', 'senha123');
    if (sucesso) {
      console.log('Login realizado!');
    }
  };

  return (
    <>
      {autenticado ? (
        <>
          <p>Bem-vindo, {usuario?.nome}!</p>
          <button onClick={logout}>Sair</button>
        </>
      ) : (
        <button onClick={handleLogin}>Fazer Login</button>
      )}
    </>
  );
}
```

### Usando o Serviço `authService`
```typescript
import { authService } from '@/services/auth';

// Fazer login
const session = await authService.login('email@example.com', 'senha123');

// Obter usuário atual
const usuario = authService.obterUsuarioAtual();

// Fazer logout
authService.logout();

// Verificar se está autenticado
if (authService.estaAutenticado()) {
  console.log('Usuário autenticado!');
}

// Mudar senha
const sucesso = await authService.mudarSenha('senhaAntiga', 'senhaNova');
```

### Usando o Serviço `pedidosService`
```typescript
import { pedidosService } from '@/services/pedidos';

// Criar comanda para mesa
const comanda = await pedidosService.criarComanda(mesaId);

// Adicionar item à comanda
const comandaAtualizada = await pedidosService.adicionarItem(
  comandaId,
  produtoId,
  quantidade,
  observacoes
);

// Criar pedido de delivery
const pedido = await pedidosService.criarPedido({
  clienteId: usuario.id,
  endereco: { ... },
  itens: [ ... ]
});

// Listar pedidos
const { pedidos, total } = await pedidosService.listarPedidos({
  status: 'pendente',
  pagina: 1,
  limit: 10
});

// Atualizar status
const pedidoAtualizado = await pedidosService.atualizarStatusPedido(
  pedidoId,
  'em_prep'
);
```

### Usando Validadores
```typescript
import { validarEmail, validarTelefone, validarSenha, validarCEP } from '@/utils';

if (!validarEmail(email)) {
  console.error('Email inválido');
}

if (!validarTelefone(telefone)) {
  console.error('Telefone inválido');
}

if (!validarSenha(senha)) {
  console.error('Senha fraca');
}

if (!validarCEP(cep)) {
  console.error('CEP inválido');
}
```

### Usando Formatadores
```typescript
import {
  formatarMoeda,
  formatarData,
  formatarDataHora,
  formatarTelefone,
  formatarCEP,
  truncarTexto
} from '@/utils';

const preco = formatarMoeda(49.90); // R$ 49,90
const data = formatarData('2024-01-15'); // 15/01/2024
const dataHora = formatarDataHora(new Date()); // 15/01/2024 10:30:45
const tel = formatarTelefone('11987654321'); // (11) 98765-4321
const cepFormatado = formatarCEP('01310100'); // 01310-100
const texto = truncarTexto('Descrição bem longa...', 20); // Descrição bem lon...
```

### Criando um Componente
```typescript
import React from 'react';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui';

interface MeuComponenteProps {
  titulo: string;
  onSubmit: (dados: any) => void;
}

/**
 * Componente MeuComponente: descrição breve.
 */
export const MeuComponente: React.FC<MeuComponenteProps> = ({
  titulo,
  onSubmit,
}) => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">{titulo}</h1>
      <Input label="Email" type="email" placeholder="seu@email.com" />
      <Button variant="primary" onClick={() => onSubmit({})}>
        Enviar
      </Button>
    </div>
  );
};
```

### Criando uma Página
```typescript
import React from 'react';
import { Header } from '@/components/layout';
import { useAuth } from '@/hooks';

/**
 * Página MeuModulo: descrição breve.
 */
export const MeuModuloPage: React.FC = () => {
  const { usuario, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header usuario={usuario} onLogout={logout} />
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Conteúdo */}
      </main>
    </div>
  );
};
```

---

## 🎨 Estilização

O projeto usa **Tailwind CSS** para estilização. Classes úteis:

```typescript
// Layout
<div className="flex gap-4">           // Flex com gap
<div className="grid grid-cols-3">     // Grid com 3 colunas
<div className="max-w-7xl mx-auto">    // Largura máxima centralizada

// Espaçamento
<div className="p-4">                  // Padding
<div className="mb-8">                 // Margin bottom
<div className="gap-6">                // Gap entre itens

// Cores
<div className="bg-orange-600">        // Background orange
<div className="text-gray-800">        // Text color gray
<div className="border-red-500">       // Border color

// Responsividade
<div className="md:grid-cols-2">       // 2 colunas em mobile+
<div className="lg:flex">              // Flex em desktop+

// Estados
<div className="hover:bg-gray-300">    // Hover
<div className="disabled:opacity-50">  // Disabled
```

---

## 🔐 Autenticação

### Fluxo de Login
1. Usuário insere email e senha
2. `authService.login()` valida e faz requisição
3. API retorna token + usuário
4. Token é salvo em localStorage
5. `useAuth()` atualiza estado
6. Componentes se re-renderizam

### Token Management
```typescript
// Token é automaticamente adicionado aos headers
// Exemplo de requisição:
const response = await apiClient.get('/pedidos');
// Header automaticamente inclui: Authorization: Bearer {token}
```

---

## 📚 Tipos Principais

```typescript
// Usuário
interface User {
  id: string;
  nome: string;
  email: string;
  role: 'admin' | 'gerente' | 'garcom' | 'caixa' | 'cliente' | 'entregador';
}

// Produto
interface Produto {
  id: string;
  nome: string;
  preco: number;
  categoria: string;
  disponivel: boolean;
  estoque: number;
}

// Comanda
interface Comanda {
  id: string;
  mesaId?: string;
  status: 'aberta' | 'em_prep' | 'pronto' | 'entregue' | 'cancelada';
  itens: ItemComanda[];
  total: number;
}

// Pedido
interface Pedido {
  id: string;
  clienteId: string;
  status: 'pendente' | 'confirmado' | 'preparando' | 'entregue' | 'cancelado';
  total: number;
  endereco: { rua, numero, cidade, cep };
}
```

---

## 🔌 API Endpoints Esperados

```
POST   /auth/login              - Fazer login
POST   /auth/refresh            - Renovar token
POST   /auth/mudar-senha        - Mudar senha

GET    /produtos                - Listar produtos
GET    /produtos/{id}           - Obter produto

POST   /comandas                - Criar comanda
GET    /comandas/{id}           - Obter comanda
POST   /comandas/{id}/itens     - Adicionar item
DELETE /comandas/{id}/itens/{itemId} - Remover item
PUT    /comandas/{id}/finalizar - Finalizar comanda

POST   /pedidos                 - Criar pedido
GET    /pedidos                 - Listar pedidos
GET    /pedidos/{id}            - Obter pedido
PUT    /pedidos/{id}            - Atualizar pedido
PUT    /pedidos/{id}/cancelar   - Cancelar pedido

GET    /mesas                   - Listar mesas
GET    /mesas/{id}              - Obter mesa
PUT    /mesas/{id}              - Atualizar mesa
```

---

## 🛠 Checklist de Desenvolvimento

- [ ] Criar novo componente em `src/components/`
- [ ] Usar TypeScript com tipos corretos
- [ ] Adicionar comentários JSDoc
- [ ] Exportar de `index.ts` da pasta
- [ ] Testar responsividade (mobile, tablet, desktop)
- [ ] Validar dados antes de enviar à API
- [ ] Tratar erros e mostrar mensagens ao usuário
- [ ] Usar serviços para lógica de API
- [ ] Usar hooks para estado compartilhado
- [ ] Manter código bem organizado e comentado

---

## 🐛 Troubleshooting

### "support.js não encontrado"
Verifique se o caminho em `<script src="scripts/support.js"></script>` está correto.

### "React não está definido"
O arquivo support.js carrega React automaticamente via CDN. Aguarde o carregamento.

### "Erro ao fazer requisição"
Verifique se a API está rodando em `http://localhost:3000/api`.

### Token expirou
O token é automaticamente renovado pelo `authService`. Se falhar, o usuário será desconectado.

---

## 📞 Suporte

Para dúvidas ou problemas, consulte a documentação ou os comentários no código.
