# 📚 Índice de Documentação - Bel do Frango

## 🎯 Comece Por Aqui

Se você é novo no projeto, comece nesta ordem:

1. **[README.md](./README.md)** - Visão geral e como iniciar
2. **[ESTRUTURA.md](./ESTRUTURA.md)** - Entenda a organização das pastas
3. **[RESUMO_ORGANIZACAO.md](./RESUMO_ORGANIZACAO.md)** - Veja o que foi criado
4. **[DESENVOLVIMENTO.md](./DESENVOLVIMENTO.md)** - Exemplos práticos de código
5. **[ARVORE_COMPLETA.md](./ARVORE_COMPLETA.md)** - Referência visual completa

---

## 📖 Documentação Detalhada

### Iniciante
- **Como instalar?** → [README.md](./README.md#instalação)
- **Como iniciar servidor?** → [README.md](./README.md#como-usar)
- **Qual é a estrutura?** → [ESTRUTURA.md](./ESTRUTURA.md)

### Desenvolvedor
- **Como criar um componente?** → [DESENVOLVIMENTO.md](./DESENVOLVIMENTO.md#criando-um-componente)
- **Como usar hooks?** → [DESENVOLVIMENTO.md](./DESENVOLVIMENTO.md#usando-o-hook-useauth)
- **Como fazer requisições?** → [DESENVOLVIMENTO.md](./DESENVOLVIMENTO.md#usando-o-serviço-apiclient)
- **Como validar dados?** → [DESENVOLVIMENTO.md](./DESENVOLVIMENTO.md#usando-validadores)

### Arquiteto / Líder
- **Estatísticas do projeto** → [RESUMO_ORGANIZACAO.md](./RESUMO_ORGANIZACAO.md#total-34-arquivos)npm run start

- **Fluxos de dados** → [ARVORE_COMPLETA.md](./ARVORE_COMPLETA.md#🔄-fluxos-de-dados-principais)
- **Próximos passos** → [RESUMO_ORGANIZACAO.md](./RESUMO_ORGANIZACAO.md#próximos-passos)

### DevOps / Deploy
- **Dependências** → [package.json](./package.json)
- **Configuração TypeScript** → [tsconfig.json](./tsconfig.json)
- **Variáveis de ambiente** → [.env.example](./.env.example)
- **Build & scripts** → [package.json](./package.json#scripts)

---

## 🗂️ Guia de Pastas

| Pasta | Propósito | Arquivos |
|-------|-----------|----------|
| `src/app/` | Páginas principais | Login, Cliente, Admin, Mesas, Cardápio |
| `src/components/` | Componentes reutilizáveis | UI, Cards, Forms, Layout |
| `src/services/` | Serviços e API | HTTP, Auth, Pedidos |
| `src/hooks/` | Custom React Hooks | useAuth |
| `src/types/` | Tipos TypeScript | Interfaces |
| `src/utils/` | Funções utilitárias | Validadores, Formatadores |
| `src/store/` | Estado global | Redux/Zustand |
| `styles/` | Estilos CSS | main.css |
| `scripts/` | JavaScript de runtime | support.js (DC/React) |
| `assets/` | Imagens e recursos | logo-icon.png |

---

## 💡 Exemplos Rápidos

### Autenticação
```typescript
import { useAuth } from '@/hooks';

const { usuario, autenticado, login } = useAuth();
const sucesso = await login('email@test.com', 'senha');
```

### Requisições HTTP
```typescript
import { apiClient } from '@/services';

const response = await apiClient.get('/produtos');
const data = await apiClient.post('/pedidos', {...});
```

### Validação & Formatação
```typescript
import { validarEmail, formatarMoeda } from '@/utils';

validarEmail('test@test.com');
formatarMoeda(99.90); // R$ 99,90
```

### Criar Componente
```typescript
import React from 'react';
import { Button } from '@/components/ui';

export const MeuComponente = () => {
  return <Button variant="primary">Clique Aqui</Button>;
};
```

---

## 📋 Checklist de Setup Inicial

- [ ] Ler [README.md](./README.md)
- [ ] Ler [ESTRUTURA.md](./ESTRUTURA.md)
- [ ] Executar `npm install`
- [ ] Executar `npm run start`
- [ ] Abrir `http://localhost:5000`
- [ ] Explorar os arquivos em `src/`
- [ ] Ler exemplos em [DESENVOLVIMENTO.md](./DESENVOLVIMENTO.md)
- [ ] Criar um componente de teste

---

## 🔍 Encontre Rapidamente

### Por Linguagem
- **TypeScript**: `src/**/*.ts`
- **React**: `src/**/*.tsx`
- **CSS**: `styles/main.css`

### Por Feature
- **Autenticação**: `src/services/auth.ts`, `src/hooks/useAuth.ts`
- **API**: `src/services/api.ts`
- **Pedidos**: `src/services/pedidos.ts`
- **UI**: `src/components/ui/`
- **Forms**: `src/components/forms/`

### Por Tipo de Arquivo
- **Páginas**: `src/app/*/[Nome]Page.tsx`
- **Componentes**: `src/components/*/*` 
- **Hooks**: `src/hooks/use*.ts`
- **Serviços**: `src/services/*.ts`
- **Tipos**: `src/types/index.ts`
- **Utilitários**: `src/utils/*.ts`

---

## 🆘 Troubleshooting

### "npm install falhou"
→ [README.md](./README.md#instalação)

### "Como conectar com backend?"
→ [.env.example](./.env.example), [DESENVOLVIMENTO.md](./DESENVOLVIMENTO.md#api-endpoints-esperados)

### "Como criar novo componente?"
→ [DESENVOLVIMENTO.md](./DESENVOLVIMENTO.md#criando-um-componente)

### "Como fazer requisição à API?"
→ [DESENVOLVIMENTO.md](./DESENVOLVIMENTO.md#usando-o-serviço-apiclient)

### "Como validar dados?"
→ [DESENVOLVIMENTO.md](./DESENVOLVIMENTO.md#usando-validadores)

---

## 📞 Suporte Rápido

```
❓ Pergunta: Como começo?
✅ Resposta: Leia o README.md e execute npm run start

❓ Pergunta: Como crio um componente?
✅ Resposta: Veja exemplos em DESENVOLVIMENTO.md

❓ Pergunta: Quais tipos tenho disponível?
✅ Resposta: Veja src/types/index.ts

❓ Pergunta: Como valido dados?
✅ Resposta: Use src/utils/validators.ts

❓ Pergunta: Qual é a estrutura?
✅ Resposta: Leia ESTRUTURA.md e ARVORE_COMPLETA.md
```

---

## 📊 Status do Projeto

```
✅ Estrutura            - Pronta
✅ Componentes          - Prontos (12 componentes)
✅ Serviços             - Prontos (3 serviços)
✅ Hooks                - Prontos (1 hook customizado)
✅ Tipos TypeScript     - Prontos (13+ interfaces)
✅ Utilitários          - Prontos (12 funções)
✅ Documentação         - Completa (5 arquivos)
✅ Testes              - Estrutura pronta
⏳ Backend              - Aguardando integração
⏳ CI/CD                - Aguardando configuração
```

---

## 🎓 Próximas Lições

1. **Backend Integration** - Conectar com API real
2. **State Management** - Implementar Redux/Zustand
3. **Testing** - Adicionar testes unitários
4. **Performance** - Otimizar componentes
5. **Mobile Responsive** - Garantir versão mobile
6. **PWA** - Tornar aplicativo offline-first
7. **Analytics** - Adicionar tracking
8. **Security** - Implementar proteções

---

## 🚀 Deploy

Quando pronto para produção:
1. Configure variáveis em `.env`
2. Execute `npm run build`
3. Faça deploy usando seu hosting preferido
4. Monitore e mantenha atualizado

---

## 📝 Resumo

| Item | Status | Localização |
|------|--------|-------------|
| Estrutura | ✅ | src/ |
| Componentes | ✅ | src/components/ |
| Páginas | ✅ | src/app/ |
| Serviços | ✅ | src/services/ |
| Tipos | ✅ | src/types/ |
| Utilitários | ✅ | src/utils/ |
| Documentação | ✅ | ./*.md |
| Dependências | ✅ | package.json |

---

## 🎉 Parabéns!

Seu projeto está **totalmente organizado** e pronto para desenvolvimento profissional.

**Boa sorte!** 🚀
