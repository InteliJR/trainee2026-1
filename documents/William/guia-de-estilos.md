# Guia de Estilos — EcoRota

Este guia define a base visual editável do EcoRota para acelerar a construção das telas de morador, coletor e dashboard. Ele deve evoluir junto com o produto, mas sempre preservando três prioridades: clareza, acessibilidade e demonstração funcionando no prazo.

Para montar a biblioteca visual no Figma, use também `documents/figma-guia-de-estilos.md` e `documents/figma-tokens.tokens.json`.

## Identidade visual

O EcoRota deve parecer simples, confiável e humano. A marca nasce da ideia de transformar reciclagem em uma ação cotidiana fácil, acompanhável e recompensadora.

- **Personalidade:** próxima, prática, otimista e socialmente consciente.
- **Promessa visual:** reciclagem sem confusão, coleta rastreável e impacto visível.
- **Sensação desejada:** "sei exatamente o que fazer agora".
- **Evitar:** aparência de landing page genérica, excesso de verde, textos longos em fluxos operacionais e componentes decorativos que atrasem a demo.

## Princípios de design

1. **Ação principal evidente:** cada tela deve ter uma ação primária clara.
2. **Mobile primeiro:** morador e coletor devem funcionar como app no celular.
3. **Poucos passos:** o morador deve conseguir solicitar coleta em até 3 telas.
4. **Campo sem fricção:** o coletor precisa de botões grandes, alto contraste e leitura rápida.
5. **Operação escaneável:** o dashboard deve priorizar KPIs, mapa e listas legíveis.
6. **Status traduzido:** nunca mostrar status técnico ao usuário final quando houver tradução amigável.
7. **Feedback imediato:** ações importantes devem confirmar sucesso, erro ou próximo passo.

## Tokens editáveis

Os tokens técnicos ficam em `apps/web/src/styles/design-tokens.ts` e são importados pelo `apps/web/tailwind.config.ts`.

### Cores

| Token | Uso | Valor base |
|---|---|---|
| `brand` | Marca, CTAs principais, confirmação ambiental | `#238e58` |
| `operational` | Dashboard, mapas, tempo real, links úteis | `#06b6d4` |
| `reward` | Pontos, streak, metas, atenção positiva | `#f59e0b` |
| `danger` | Cancelamento, erro, ações destrutivas | `#ef4444` |
| `neutral` | Fundo, texto, bordas, superfícies | `#142019` até `#ffffff` |

Exemplos Tailwind:

```tsx
<button className="bg-brand-600 text-white hover:bg-brand-700">
  Solicitar coleta
</button>

<span className="bg-reward-100 text-reward-800">
  Meta do mês
</span>
```

### Status

| Status técnico | Texto na interface | Cor sugerida |
|---|---|---|
| `pending` | Aguardando coletor | `status-pending` |
| `assigned` | Coletor a caminho | `status-assigned` |
| `in_service` | Coletor no local | `status-in-service` |
| `completed` | Concluída | `status-completed` |
| `cancelled` | Cancelada | `status-cancelled` |

Use `translateStatus` de `packages/shared/src/status.ts` sempre que renderizar status de solicitação.

### Tipografia

- Fonte padrão: system UI (`Inter` pode ser adotada depois, mas não é obrigatória para a demo).
- Títulos de telas mobile: `text-2xl` ou `text-3xl`.
- Títulos internos de cards: `text-base` ou `text-lg`.
- Labels e metadados: `text-sm`.
- Evitar textos menores que `text-sm` nos fluxos do coletor.
- Não usar espaçamento negativo entre letras.

### Espaçamento, grid e breakpoints

- Margem lateral mobile: `px-screen` (`1rem`).
- Espaço entre seções mobile: `gap-section` (`1.5rem`).
- Área máxima mobile/app: `max-w-app` (`28rem`).
- Dashboard: `max-w-dashboard` (`90rem`) com grid responsivo.
- Tamanho mínimo tocável: `min-h-touch` (`2.75rem`) e, para coletor, `min-h-touch-lg` (`3.5rem`).

### Bordas, sombras e radius

- Cards e painéis: `rounded-md` ou `rounded-lg`.
- Botões: `rounded-md`; use `rounded-full` só para chips, badges e avatares.
- Cards operacionais: `shadow-card`.
- KPIs do dashboard: `shadow-kpi`.
- Foco acessível: usar anel visível (`focus-visible:ring-2 focus-visible:ring-operational-500`) ou `shadow-focus` em componentes customizados.

## Ícones e linguagem visual

- Usar ícones claros para ações rápidas: mapa, calendário, check, cancelar, rota, histórico, pontos.
- Preferir biblioteca de ícones quando for adicionada ao projeto, como `lucide-react`.
- Ícone nunca deve ser o único sinal de uma ação crítica; combine com texto curto.
- Mapas e marcadores devem diferenciar ponto de coleta, coletor disponível, coletor indisponível e telemetria desatualizada.

## Componentes base

### Botões

- Primário: ações principais como "Solicitar coleta", "Confirmar coleta" e "Salvar endereço".
- Secundário: navegação, filtros e ações complementares.
- Perigo: cancelar coleta ou confirmar ausência.
- Coletor: botões maiores, texto direto, ícone à esquerda e estado pressionado evidente.

Classes base sugeridas:

```tsx
const buttonBase = 'inline-flex min-h-touch items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-operational-500';
```

### Inputs

- Labels sempre visíveis.
- Mensagem de erro abaixo do campo.
- Altura mínima `min-h-touch`.
- Placeholder ajuda, mas não substitui label.
- Em mobile, inputs devem ocupar largura total.

### Cards

- Usar cards para itens repetidos: coleta, ponto, KPI, histórico.
- Não colocar card dentro de card.
- Cada card deve ter título, dado principal e ação/status quando necessário.

### Badges e status

- Badges devem ser curtos e legíveis.
- Status de coleta sempre usa texto amigável.
- Nunca depender apenas de cor: inclua texto e, se possível, ícone.

### Navegação mobile

- Morador: navegação inferior com Início, Solicitar, Acompanhar, Histórico.
- Coletor: navegação mínima com Hoje, Disponível, Perfil.
- Área tocável ampla e rótulos curtos.
- Evitar menus escondidos em fluxos essenciais.

### KPIs do dashboard

- Cada KPI deve mostrar: título curto, valor grande, variação/contexto e estado quando aplicável.
- Exemplos: "Ativas agora", "Concluídas hoje", "Cancelamento", "Coletores disponíveis".
- Usar visual denso e organizado, sem hero ou composição promocional.

### Cards de coleta

Campos mínimos:

- Status traduzido.
- Material.
- Ponto ou endereço.
- Data/horário.
- Coletor responsável quando houver.
- Ação principal compatível com o perfil.

### Estados

- **Vazio:** orientar próxima ação. Ex.: "Nenhuma coleta agendada. Solicite uma coleta para começar."
- **Loading:** skeleton simples ou texto curto. Ex.: "Carregando coletas..."
- **Erro:** explicar o problema e oferecer retry. Ex.: "Não foi possível atualizar o status. Tentar novamente."
- **Sucesso:** confirmar resultado. Ex.: "Coleta agendada. Vamos avisar quando um coletor assumir."

## Regras por perfil

### Morador

- Tom acolhedor e motivador.
- Fluxo de solicitação curto.
- Status com linguagem de entrega: "Aguardando coletor", "Coletor a caminho".
- Gamificação visível, mas sem atrapalhar a tarefa principal.
- Histórico deve reforçar impacto: quantidade reciclada, pontos e sequência.

### Coletor

- Priorizar acessibilidade e uso em campo.
- Botões grandes, alto contraste e textos curtos.
- Evitar tabelas no celular; preferir cards de tarefa.
- Ações críticas devem ter confirmação clara.
- Fluxos importantes: painel do dia, detalhe, confirmar coleta, cancelar/morador ausente e disponibilidade.

### Dashboard operacional

- Visual de ferramenta de operação.
- Densidade maior que mobile, mas com hierarquia clara.
- KPIs no topo, mapa em destaque, lista de solicitações recentes abaixo ou ao lado.
- Cores operacionais (`operational`) ajudam a separar dashboard da experiência do morador.
- Não usar linguagem promocional; usar dados e estados.

## Acessibilidade

- Contraste mínimo AA para texto.
- Alvos tocáveis de pelo menos 44px.
- Foco visível em todos os controles.
- Não transmitir estado apenas por cor.
- Labels persistentes nos inputs.
- Textos curtos para o coletor, evitando dependência de leitura longa.
- Confirmar cancelamentos com dupla confirmação.
- Mensagens de erro devem dizer o que aconteceu e como seguir.

## Microcopy

### Morador

- "Solicitar coleta"
- "Escolha o material"
- "Aguardando coletor"
- "Coletor a caminho"
- "Sua coleta foi concluída"
- "Faltam 2 descartes para bater sua meta do mês"
- "Você manteve sua sequência por 4 semanas"

### Coletor

- "Começar rota"
- "Ver detalhes"
- "Confirmar coleta"
- "Morador ausente"
- "Estou disponível"
- "Finalizar tarefa"
- "Chamar suporte"

### Dashboard

- "Ativas agora"
- "Concluídas hoje"
- "Taxa de cancelamento"
- "Coletores disponíveis"
- "Demanda por região"
- "Solicitações recentes"
- "Telemetria desatualizada"

## Gamificação

- Pontos devem ser creditados apenas após `completed`.
- Streak semanal deve reforçar hábito, não punir usuário.
- Meta mensal deve mostrar progresso e próxima ação.
- Confete ou animação curta pode aparecer após coleta agendada ou concluída.
- Mascote pode ser usado como apoio leve em estados vazios, dicas de reciclagem e comemorações. Não deve disputar atenção com botões principais.

## Checklist para novas telas

- A ação principal está óbvia?
- A tela funciona bem em celular?
- Há estado vazio, loading, erro e sucesso?
- O status usa `translateStatus`?
- Botões têm área tocável suficiente?
- Cancelamentos têm confirmação dupla quando necessário?
- A paleta usa marca, neutros e cores semânticas sem virar tudo verde?
- O coletor consegue entender a tela com leitura mínima?
- O dashboard mostra dados de forma escaneável?
- As classes usam tokens do Tailwind em vez de valores soltos?
