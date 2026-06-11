# Testing Guide — HOA Portal

Stack: **Vitest** para unitários/integração, **Playwright** para E2E, **GitHub Actions** para CI.

---

## Estrutura de arquivos

| Tipo | Localização | Convenção de nome |
|---|---|---|
| Unitário / Integração | `src/**/*.test.ts` | Co-locado com o fonte |
| E2E | `e2e/**/*.spec.ts` | Por fluxo de usuário |
| Mock reutilizável | `src/test/mocks/` | `nome-da-lib.ts` |
| Setup global | `src/test/setup.ts` | Não editar por teste |

**Atenção:** Vitest só lê `src/**/*.test.ts`. Arquivos em `e2e/` são ignorados por ele e lidos apenas pelo Playwright.

---

## Comandos

```bash
npm run test             # watch mode (desenvolvimento)
npm run test:run         # uma vez — para CI
npm run test:coverage    # relatório de cobertura (lcov + text)
npm run test:e2e         # E2E Playwright (precisa do servidor rodando)
npm run test:e2e:ui      # E2E com interface visual do Playwright
```

---

## Checklist para nova feature

### Nova server action (`actions.ts`)

```ts
// Crie src/app/(app)/admin/actions.test.ts  (ou adicione ao existente)
// @vitest-environment node

it('retorna {} no caminho de sucesso', async () => {
  setupAdmin()  // usa buildSupabaseMock({ dbResult: { error: null } })
  const result = await minhaNovaAction('id', dados)
  expect(result).toEqual({})
})

it('retorna { error } quando DB falha', async () => {
  setupDbError('mensagem de erro')
  const result = await minhaNovaAction('id', dados)
  expect(result).toEqual({ error: 'mensagem de erro' })
})

it('redireciona para /chat quando usuário não é admin', async () => {
  setupResident()
  await expect(minhaNovaAction('id', dados)).rejects.toThrow('REDIRECT:/chat')
})
```

### Nova API route (`route.ts`)

```ts
// Crie route.test.ts na mesma pasta que route.ts
// @vitest-environment node

it('retorna 401 sem autenticação', async () => {
  mockCreateClient.mockResolvedValue(buildSupabaseMock({ user: null }) as any)
  const res = await POST(makeRequest({}))
  expect(res.status).toBe(401)
})

it('retorna 403 para role resident', async () => {
  mockCreateClient.mockResolvedValue(
    buildSupabaseMock({ profile: { role: 'resident', hoa_id: 'hoa-1' } }) as any
  )
  const res = await POST(makeRequest({}))
  expect(res.status).toBe(403)
})
```

### Nova lib function com API externa

```ts
// Crie src/lib/nome/funcao.test.ts
// Use vi.hoisted() para libs instanciadas com `new` (OpenAI, Resend, Twilio)

const { mockMethod } = vi.hoisted(() => ({ mockMethod: vi.fn() }))

vi.mock('nome-da-lib', () => ({
  default: vi.fn(function MockLib() {
    return { method: mockMethod }
  }),
}))

it('chama a API externa com os parâmetros corretos', async () => {
  mockMethod.mockResolvedValue({ data: 'resposta' })
  await minhaFuncao('input')
  expect(mockMethod).toHaveBeenCalledWith(expect.objectContaining({ param: 'valor' }))
})
```

---

## Receitas de mock

### Supabase — server actions e API routes

```ts
// 1. No topo do arquivo de teste:
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
import { createClient } from '@/lib/supabase/server'
import { buildSupabaseMock } from '@/test/mocks/supabase'

const mockCreateClient = vi.mocked(createClient)

// 2. Helper functions reutilizáveis no describe block:
function setupAdmin(dbResult = { data: null, error: null }) {
  mockCreateClient.mockResolvedValue(buildSupabaseMock({ dbResult }) as any)
}
function setupResident() {
  mockCreateClient.mockResolvedValue(
    buildSupabaseMock({ profile: { role: 'resident', hoa_id: 'hoa-1' } }) as any
  )
}
function setupDbError(message: string) {
  setupAdmin({ data: null, error: { message } })
}
```

### redirect() em server actions

```ts
// setup.ts já configura redirect() para lançar Error('REDIRECT:/path')
// Padrão de asserção:
await expect(serverAction('id')).rejects.toThrow('REDIRECT:/chat')   // não admin
await expect(serverAction('id')).rejects.toThrow('REDIRECT:/login')  // não autenticado
```

### Mock de constructor (vi.hoisted obrigatório)

```ts
// ERRADO — arrow function não pode ser usada como constructor:
vi.mock('openai', () => ({ default: vi.fn(() => ({ ... })) }))

// CERTO — função nomeada + vi.hoisted para variáveis compartilhadas:
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))
vi.mock('openai', () => ({
  default: vi.fn(function MockOpenAI() {
    return { embeddings: { create: mockCreate } }
  }),
}))
```

### Supabase @supabase/supabase-js direto (ex: route de signup)

```ts
// Para rotas que usam createClient de @supabase/supabase-js (não do SSR wrapper)
const mockFrom = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
    auth: { admin: { createUser: vi.fn(), deleteUser: vi.fn() } },
  })),
}))
```

---

## Mocks globais disponíveis (src/test/setup.ts)

Não precisa declarar em cada arquivo:

| Módulo | Mock |
|---|---|
| `next/navigation` | `redirect` lança `Error('REDIRECT:/path')`, `useRouter`, `usePathname` |
| `next/cache` | `revalidatePath`, `revalidateTag` como `vi.fn()` |
| `next/headers` | `cookies` retorna objeto vazio |

`vi.clearAllMocks()` é chamado automaticamente após cada teste.

---

## Padrões críticos aprendidos

### Por que vi.hoisted()?

`vi.mock()` é hoisted para o topo do módulo antes das declarações de variáveis. Se você referencia uma variável definida com `const` dentro do factory do `vi.mock()`, ela ainda não existe. `vi.hoisted()` cria variáveis que sobem junto com o mock:

```ts
// Isso quebra silenciosamente:
const mockFn = vi.fn()
vi.mock('lib', () => ({ fn: mockFn }))  // mockFn é undefined aqui

// Isso funciona:
const { mockFn } = vi.hoisted(() => ({ mockFn: vi.fn() }))
vi.mock('lib', () => ({ fn: mockFn }))
```

### Por que o Supabase mock usa .then?

O Supabase query builder é encadeável: `supabase.from('x').update({}).eq('id', '1')` — isso retorna o próprio builder, não uma Promise. Para que `await builder` funcione, o builder precisa ter uma propriedade `.then` (tornando-o "thenable"). O `makeChain()` em `src/test/mocks/supabase.ts` faz exatamente isso.

---

## CI — GitHub Actions

O arquivo `.github/workflows/ci.yml` roda automaticamente em cada push/PR para `main`:

1. **Job `test`:** `type-check` → `lint` → `test:run`
2. **Job `e2e`:** `build` → `playwright test` (apenas em PRs para `main` e pushes para `main`)

Para E2E funcionar em CI, adicione no GitHub → Settings → Secrets:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY`
- `TEST_ADMIN_EMAIL` + `TEST_ADMIN_PASSWORD` (conta admin de testes no Supabase)
