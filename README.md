# NEXA

Plataforma de estudos com IA que transforma materiais acadêmicos em resumos, questões, flashcards e revisões espaçadas.

**Status: Beta - v0.1.0**

[Acessar a aplicação](https://nexaai-gamma.vercel.app)

## Sobre o NEXA

O NEXA organiza materiais acadêmicos em uma experiência de estudo contínua. Depois de enviar um PDF ou colar anotações, o estudante pode gerar conteúdo contextual, praticar com questões, revisar flashcards e acompanhar sua evolução sem perder o vínculo com o material original.

## Funcionalidades

- Autenticação, recuperação de senha e rotas protegidas com Supabase Auth.
- Upload e extração de texto de arquivos PDF.
- Materiais persistentes criados a partir de texto colado.
- Resumos contextuais gerados por IA.
- Questões de múltipla escolha vinculadas ao material.
- Prática direcionada aos erros anteriores (Practice My Mistakes).
- Flashcards persistentes com modo de estudo e navegação.
- Revisão espaçada determinística com avaliações Errei, Difícil, Bom e Fácil.
- Overview com contagem e recomendação de revisões pendentes.
- Sessões de estudo, histórico de desempenho e progresso real.
- Interface e conteúdo gerado persistente em português brasileiro e inglês.
- Limite diário de gerações de IA por usuário.
- Cache por material e idioma para evitar gerações desnecessárias.

## Como funciona

```text
Material
  -> processamento
  -> resumo
  -> questões / flashcards
  -> sessões / revisão
  -> progresso
```

O material enviado é a fonte de verdade para o conteúdo gerado. Resumos, questões e flashcards existentes são reutilizados quando possível.

## Arquitetura

### Frontend

- React 19
- TypeScript
- Tailwind CSS
- TanStack Start
- Vite

### Backend e plataforma

- Supabase Auth
- PostgreSQL
- Supabase Storage privado
- Row Level Security (RLS)
- Server Functions do TanStack Start

### IA

- NVIDIA NIM como provedor principal.
- OpenRouter como fallback.
- Gateway centralizado para seleção e normalização dos provedores.
- Uma única reserva de quota por ação do usuário, independentemente de fallback.
- Prompts e parsers próprios para conteúdo acadêmico em Markdown.

O agendamento dos flashcards é determinístico e executado no servidor. Ele foi projetado para oferecer intervalos previsíveis no Beta, sem afirmar eficácia científica além do comportamento implementado.

## Segurança

- Documentos são armazenados em bucket privado.
- Políticas RLS isolam documentos, conteúdo gerado e sessões por usuário.
- Chaves dos provedores de IA permanecem no servidor.
- Nenhuma chave `service_role` é usada pelo frontend ou exigida pela aplicação.
- Server Functions autenticadas validam identidade e propriedade dos documentos.
- Quotas e bloqueios transacionais protegem gerações concorrentes e uso excessivo.

## Internacionalização

O NEXA oferece interface em português brasileiro (`pt-BR`) e inglês (`en`). Resumos, conjuntos de questões e flashcards são persistidos separadamente por idioma. Alterar o idioma não regenera conteúdo nem consome quota automaticamente.

## Rodando localmente

### Pré-requisitos

- Node.js compatível com o projeto
- npm
- Projeto Supabase configurado
- Credencial de pelo menos um provedor de IA compatível

### Instalação

```bash
npm install
```

Crie seu arquivo local de ambiente a partir de `.env.example` e preencha somente com as credenciais do seu próprio projeto:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Execute as migrações em ordem:

1. `0001_initial_schema.sql`
2. `0002_allow_text_materials.sql`
3. `0003_ai_generation_rate_limits.sql`
4. `0004_flashcards.sql`
5. `0005_flashcard_spaced_repetition.sql`
6. `0006_multilingual_generated_content.sql`

Consulte [`supabase/README.md`](supabase/README.md) para configurar Auth, Storage, SMTP e URLs de redirecionamento.

Inicie o ambiente local:

```bash
npm run dev
```

## Scripts

Scripts definidos em `package.json`:

- `npm run dev`: inicia o servidor de desenvolvimento.
- `npm run build`: cria o build de produção.
- `npm run build:dev`: cria um build em modo de desenvolvimento.
- `npm run preview`: executa o preview do build.
- `npm run lint`: executa o ESLint.
- `npm run format`: formata o projeto com Prettier.

Os testes unitários atuais podem ser executados com:

```bash
node --test --experimental-strip-types src/lib/*.test.ts
```

## Estrutura do projeto

```text
src/                  aplicação React, rotas, serviços e funções de servidor
public/               arquivos públicos estáticos
scripts/              ferramentas locais de compatibilidade dos provedores
supabase/migrations/  esquema PostgreSQL, RLS, Storage e RPCs
supabase/README.md     configuração do projeto Supabase
```

## Limitações do Beta

- PDF é o único formato de arquivo aceito; texto pode ser adicionado por colagem.
- Conteúdo gerado por IA pode conter imprecisões e deve ser revisado pelo estudante.
- Disponibilidade e limites dos provedores externos podem afetar novas gerações.
- O produto está em validação ativa e alguns fluxos ainda podem evoluir.

## Roadmap

- Recomendações mais profundas no Overview.
- Análises ampliadas de revisão e retenção.
- Suporte a mais formatos de material.
- Melhorias contínuas de acessibilidade e experiência de estudo.

Não há datas prometidas para esses itens.

## Feedback

Relatos de bugs e sugestões são bem-vindos por meio das Issues deste repositório. Não inclua materiais privados, credenciais ou informações pessoais ao abrir uma issue.

## Licença

O código-fonte está publicamente visível para fins de demonstração e portfólio. Nenhuma licença de código aberto foi concedida neste momento. O uso, a cópia, a modificação ou a redistribuição dependem de autorização expressa do autor, salvo quando exigido por lei. Uma licença poderá ser adicionada explicitamente em uma versão futura.
