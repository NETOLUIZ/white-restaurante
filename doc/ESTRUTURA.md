# Estrutura de Pastas - Bel do Frango

## 📁 Organização do Projeto

```
BELDOFRANGO ATU/
├── src/
│   ├── app/                 # Páginas principais da aplicação
│   │   ├── login/          # Página de login
│   │   ├── cliente/        # App do cliente (Delivery)
│   │   ├── cardapio/       # Cardápio digital / QR Mesa
│   │   ├── mesas/          # Gerenciamento de mesas
│   │   └── admin/          # Painel de administração
│   │
│   ├── components/          # Componentes reutilizáveis
│   │   ├── ui/             # Componentes base (Button, Input, etc)
│   │   ├── cards/          # Cards (Produto, Pedido, etc)
│   │   ├── forms/          # Formulários (Login, Endereço, etc)
│   │   └── layout/         # Componentes de layout (Header, Footer, etc)
│   │
│   ├── hooks/               # Custom React Hooks
│   │   ├── useAuth.ts      # Hook de autenticação
│   │   └── (outros hooks)
│   │
│   ├── services/            # Serviços de API e lógica
│   │   ├── api.ts          # Cliente HTTP
│   │   ├── auth.ts         # Autenticação
│   │   └── pedidos.ts      # Gerenciamento de pedidos
│   │
│   ├── store/               # Gerenciamento de estado global
│   │   └── index.ts        # Store, actions, reducers
│   │
│   ├── types/               # Definições de tipos TypeScript
│   │   └── index.ts        # Interfaces e tipos
│   │
│   ├── utils/               # Funções utilitárias
│   │   ├── validators.ts   # Validações de dados
│   │   └── formatters.ts   # Formatação de dados
│   │
│   └── styles/              # Estilos globais
│       └── main.css        # CSS extraído do HTML
│
├── scripts/
│   └── support.js          # Runtime DC/React
│
├── assets/                  # Imagens e recursos estáticos
│   └── logo-icon.png
│
├── node_modules/           # Dependências npm
├── index.html              # Página de entrada
├── package.json            # Dependências e scripts
├── package-lock.json       # Lock file de dependências
├── tsconfig.json           # Configuração TypeScript
├── .env.example            # Variáveis de ambiente exemplo
├── README.md               # Documentação geral
└── ESTRUTURA.md            # Este arquivo

```

## 📝 Descrição das Pastas

### `src/app/`
Contém as páginas/módulos principais da aplicação:
- **login/**: Tela de autenticação
- **cliente/**: Aplicativo do cliente com cardápio e delivery
- **cardapio/**: Cardápio digital (QR das mesas)
- **mesas/**: Gerenciamento de mesas do salão
- **admin/**: Painel de administração

### `src/components/`
Componentes reutilizáveis organizados por tipo:
- **ui/**: Componentes base (Button, Input, etc)
- **cards/**: Cards de produtos, pedidos, etc
- **forms/**: Formulários de login, endereço, etc
- **layout/**: Header, Footer, Sidebar, etc

### `src/hooks/`
Custom React Hooks para lógica compartilhada:
- `useAuth()`: Gerencia autenticação e sessão

### `src/services/`
Serviços de comunicação e lógica de negócio:
- `api.ts`: Cliente HTTP com métodos GET, POST, PUT, DELETE
- `auth.ts`: Autenticação, login, logout, token refresh
- `pedidos.ts`: CRUD de pedidos e comandas

### `src/store/`
Estado global da aplicação (pode usar Redux, Zustand, etc):
- Gerencia estado do usuário
- Carrinho/comanda ativa
- Pedidos
- UI state (loading, errors)

### `src/types/`
Definições centralizadas de tipos TypeScript:
- `User`, `AuthSession`
- `Produto`, `Comanda`, `Pedido`
- `ApiResponse`, `Paginacao`
- etc

### `src/utils/`
Funções utilitárias reutilizáveis:
- **validators.ts**: Validação de email, telefone, CEP, senha, etc
- **formatters.ts**: Formatação de moeda, data, telefone, CEP, etc

## 🔄 Fluxo de Dados

```
UI (Components)
    ↓
Hooks (useAuth, etc)
    ↓
Services (auth.ts, api.ts, pedidos.ts)
    ↓
Store (Estado global)
    ↓
API Backend
    ↓
Database
```

## 💡 Como Usar

### Adicionar um novo componente
1. Crie em `src/components/[categoria]/MeuComponente.tsx`
2. Exporte de um `index.ts` se necessário
3. Importe e use nas páginas

### Adicionar uma nova página
1. Crie em `src/app/[modulo]/MeuModuloPage.tsx`
2. Exporte o componente
3. Link da página raiz (index.html)

### Adicionar um novo serviço
1. Crie em `src/services/meu-servico.ts`
2. Implemente a classe com métodos
3. Exporte uma instância singleton

### Adicionar um novo tipo
1. Defina a interface em `src/types/index.ts`
2. Use em tipos, componentes e serviços

## 🚀 Tecnologias Utilizadas

- **React 18**: Library para UI
- **TypeScript**: Type safety
- **Tailwind CSS**: Estilização
- **DC Runtime**: Sistema de componentes navegável
- **Fetch API**: Requisições HTTP
- **LocalStorage**: Persistência de dados local

## 📦 Instalação e Uso

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run start

# Verificar tipos TypeScript
npm run type-check

# Fazer lint do código
npm run lint
```

## 🔐 Autenticação

O fluxo de autenticação funciona assim:

1. Usuário faz login (LoginPage)
2. `authService.login()` envia credenciais à API
3. API retorna `token` e `usuario`
4. Token é salvo em localStorage
5. Subsquentes requisições incluem Authorization header
6. Hook `useAuth()` fornece estado de autenticação
