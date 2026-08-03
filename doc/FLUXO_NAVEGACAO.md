# 🔄 Fluxo de Navegação - Bel do Frango

## Estrutura de Rotas

```
/                 → ClientePage (HOME - Página Inicial)
/cardapio         → CardapioPage (Cardápio Completo)
/checkout         → CheckoutPage (Resumo + Endereço + Confirmação)
/login            → LoginPage (Autenticação)
/admin            → AdminPage (Painel Admin - Requer autenticação)
/mesas            → MesasPage (Gerenciamento de mesas)
```

---

## Fluxo Principal: Cliente

### 1️⃣ **Página Inicial (ClientePage) - Rota: `/`**
```
- Página de boas-vindas com destaques
- Mostra alguns produtos em destaque
- Botão principal: "Ver Cardápio Completo"
- CTA para navegar ao cardápio
```

### 2️⃣ **Cardápio (CardapioPage) - Rota: `/cardapio`**
```
- Exibe todos os produtos
- Filtro por categoria (todos, principais, bebidas, sobremesas)
- Botão em cada produto: "Adicionar ao Carrinho"
- Contador de itens no carrinho (flutuante)
- Botão flutuante clicável leva ao checkout
```

### 3️⃣ **Checkout (CheckoutPage) - Rota: `/checkout`**
```
Etapa 1: Resumo
  - Lista todos os itens do carrinho
  - Mostra subtotal, taxa, total
  - Botões: "Voltar ao Cardápio" | "Continuar"

Etapa 2: Endereço
  - Formulário com: rua, número, CEP, complemento, bairro, cidade
  - Botões: "Voltar" | "Finalizar Pedido"

Etapa 3: Confirmação
  - Mensagem de sucesso
  - Número do pedido
  - Prazo estimado
  - Botão: "Continuar Comprando" (volta para /cardapio)
```

---

## Implementação Técnica

### Navegação
```typescript
import { navigateTo } from '@/router/routes';

// Navegar
navigateTo('/cardapio');
navigateTo('/checkout');
```

### Hook useRouter
```typescript
import { useRouter } from '@/hooks';

const { rota, navegar, estaEm } = useRouter();

// Usar
navegar('/checkout');
estaEm('/'); // boolean
estaEm(['/', '/cardapio']); // verifica múltiplas
```

### App.tsx (Gerenciador de Rotas)
```typescript
// Renderiza componente baseado na rota
// Redireciona /admin e /login se não autenticado
// Sincroniza rota com URL
```

---

## Arquivos Principais

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/App.tsx` | Gerenciador de rotas |
| `src/router/routes.ts` | Definição de rotas |
| `src/hooks/useRouter.ts` | Hook de roteamento |
| `src/app/cliente/ClientePage.tsx` | Página inicial |
| `src/app/cardapio/CardapioPage.tsx` | Cardápio |
| `src/app/checkout/CheckoutPage.tsx` | Checkout |

---

## Exemplo de Fluxo Completo

```
1. Usuário abre a app
   └─ [/] ClientePage (página inicial)

2. Usuário clica em "Ver Cardápio Completo"
   └─ [/cardapio] CardapioPage

3. Usuário adiciona produtos ao carrinho
   └─ Contador de itens aumenta

4. Usuário clica no carrinho (botão flutuante)
   └─ [/checkout] CheckoutPage - Etapa 1: Resumo

5. Usuário clica "Continuar"
   └─ CheckoutPage - Etapa 2: Endereço

6. Usuário preenche endereço e clica "Finalizar Pedido"
   └─ CheckoutPage - Etapa 3: Confirmação

7. Usuário vê "Pedido Confirmado!" e clica "Continuar Comprando"
   └─ [/cardapio] CardapioPage (volta ao cardápio)
```

---

## Como Adicionar Nova Rota

### 1. Adicione em `src/router/routes.ts`
```typescript
export const routes = {
  // ... rotas existentes
  '/minha-rota': {
    path: '/minha-rota',
    label: 'Minha Página',
    component: 'MinhaPage',
  },
};
```

### 2. Crie a página em `src/app/minha-rota/MinhaPage.tsx`
```typescript
export const MinhaPage: React.FC = () => {
  const { navegar } = useRouter();
  return (
    <div>
      <button onClick={() => navegar('/')}>Voltar</button>
    </div>
  );
};
```

### 3. Adicione em `src/App.tsx`
```typescript
case '/minha-rota':
  return <MinhaPage />;
```

---

## State Management

### Carrinho (Comanda)
```typescript
// Armazenado em localStorage via authService
// Estrutura: Comanda { id, itens[], total, etc }

// Adicionar item
const comanda = await pedidosService.adicionarItem(...);

// Obter carrinho ativo
const comanda = await pedidosService.obterComanda(comandaId);
```

### Autenticação
```typescript
// Hook useAuth
const { usuario, autenticado, login, logout } = useAuth();

// Se não autenticado, / é home do cliente
// Se autenticado, /admin abre o painel
```

---

## Proteção de Rotas

```typescript
// /admin e /login redirecionam para / se não autenticado
if ((rota === '/admin' || rota === '/login') && !autenticado) {
  navigateTo('/');
}
```

---

## Próximas Funcionalidades

- [ ] Persistência do carrinho em localStorage
- [ ] Histórico de pedidos
- [ ] Rastreamento em tempo real
- [ ] Sistema de notificações
- [ ] Integração com Google Maps
- [ ] Avaliações e comentários
