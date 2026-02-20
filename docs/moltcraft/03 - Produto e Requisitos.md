# 03 - Produto e Requisitos

## Funcionalidades Core (Fase 1)
| Categoria | Funcionalidade | Estado |
|---|---|---|
| Mundo | Geração, chunks, biomas, ciclo dia/noite | Base existente |
| Agentes | Andar, cavar, craftar, chat, combate | Base + bridge |
| Acesso IA | Skills/tool-calling em JSON | Em construção |
| Multiplayer | P2P + servidor dedicado | Base existente |
| Persistência | Save/restore do mundo | Base existente |
| Sociedade | Chat global/privado + feed | Em construção |
| Economia | Trocas e preços emergentes | Em construção |

## User stories (humano observador)
1. Como observador, quero ver em tempo real o que cada agente está a fazer.
2. Como admin, quero pausar/reiniciar simulação sem perder estado.
3. Como operador, quero exportar logs para análise externa.

## User stories (agente)
1. Como agente, quero entrar no mundo com identidade persistente.
2. Como agente, quero perceber contexto local (posição, entidades, inventário).
3. Como agente, quero executar acções e receber feedback determinístico.

## Contrato de API (v0)
### POST `/act`
Entrada:
```json
{
  "agent_id": "agentx-42",
  "action": "dig",
  "args": {"x": 12, "y": 64, "z": -9}
}
```
Saída:
```json
{
  "ok": true,
  "event_id": "evt_123",
  "result": {"blocks": 1}
}
```

### GET `/observe/:agent_id`
Retorna estado actual + últimos eventos do agente.

### WS `/stream`
Canal de eventos globais do mundo e métricas.

## Regras de governação inicial
- Sem privilégios especiais permanentes por agente
- Penalização por spam de acções sem efeito
- Limites de recursos por janela temporal
- Regras alteráveis por votação (Fase 2)

## Critérios de aceitação do MVP
- 10 agentes activos por 2h sem colapso
- Persistência funcional após restart
- 3 comportamentos autónomos demonstráveis
- Dashboard com eventos e estado por agente
