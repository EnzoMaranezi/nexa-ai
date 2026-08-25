# Configuração do Supabase

## Criar o projeto

1. Crie um projeto no painel do Supabase.
2. Em **Project Settings > API**, obtenha a URL e a chave publicável do projeto.
3. Configure essas informações no arquivo local `.env`; não versione esse arquivo.

O NEXA não exige `SUPABASE_SERVICE_ROLE_KEY` em seu runtime.

## Aplicar as migrações

Com a CLI do Supabase vinculada ao seu projeto, execute:

```bash
supabase db push
```

As migrações devem ser aplicadas na ordem numérica:

1. `0001_initial_schema.sql`: documentos, resumos, questões, sessões, Storage e políticas iniciais.
2. `0002_allow_text_materials.sql`: permite materiais persistidos a partir de texto colado.
3. `0003_ai_generation_rate_limits.sql`: quota diária de IA e reservas concorrentes.
4. `0004_flashcards.sql`: conjuntos e cartões persistentes.
5. `0005_flashcard_spaced_repetition.sql`: agendamento e histórico de revisões.
6. `0006_multilingual_generated_content.sql`: conteúdo persistente separado por idioma.

Não pule migrações e não altere a ordem em um projeto vazio.

## Configurar autenticação

1. Em **Authentication > Providers**, habilite Email.
2. Mantenha autenticação por senha habilitada.
3. Configure a confirmação de e-mail conforme o ambiente.
4. Preserve os links de recuperação gerados pelo Supabase Auth.

O NEXA usa Supabase Auth para cadastro, confirmação de e-mail, login, recuperação de senha, sessões e tokens.

## Configurar SMTP personalizado

Para produção, configure o SMTP diretamente em:

```text
Authentication > Emails > SMTP Settings
```

Campos necessários:

- Host
- Porta
- Usuário
- Senha
- E-mail do remetente
- Nome do remetente

Credenciais SMTP pertencem somente às configurações do Supabase. Nunca as adicione a variáveis `VITE_*`, ao frontend ou ao repositório.

## Configurar Storage

A migração inicial cria o bucket privado `documents`. Arquivos devem usar o ID do usuário autenticado como primeiro segmento do caminho:

```text
{user_id}/{file_name}
```

As políticas de Storage permitem acesso apenas quando esse segmento corresponde a `auth.uid()`.

## Configurar URLs de redirecionamento

Em **Authentication > URL Configuration**, configure a Site URL da aplicação e autorize as URLs usadas por cada ambiente.

Desenvolvimento local:

```text
http://localhost:8080/app
http://localhost:8080/auth/reset
```

Produção:

```text
https://seu-dominio/app
https://seu-dominio/auth/reset
```

A confirmação de e-mail usa `/app`; a recuperação de senha exige `/auth/reset` autorizado.

## Variáveis de ambiente

Cliente:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Servidor:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
NVIDIA_API_KEY
OPENROUTER_API_KEY
OPENROUTER_MODEL
```

As chaves NVIDIA e OpenRouter são exclusivamente de servidor. Não use prefixo `VITE_` para elas.
