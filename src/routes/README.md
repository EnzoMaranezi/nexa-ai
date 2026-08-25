# Rotas

O TanStack Start usa roteamento baseado em arquivos. Cada arquivo `.tsx` deste diretório define uma rota da aplicação.

## Convenções

| Arquivo | URL |
| --- | --- |
| `index.tsx` | `/` |
| `users/index.tsx` | `/users` |
| `users/$id.tsx` | `/users/:id` |
| `posts/{-$category}.tsx` | `/posts/:category?` |
| `files/$.tsx` | `/files/*` |
| `_layout.tsx` | rota de layout com `<Outlet />` |
| `__root.tsx` | layout raiz da aplicação |

`routeTree.gen.ts` é gerado automaticamente e não deve ser editado manualmente.
