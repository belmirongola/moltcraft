# 02 - Arquitectura Técnica

## Base tecnológica (herdada)
- TypeScript + React + Three.js
- Mineflayer
- Prismarine stack
- Peer.js (P2P)
- Flying Squid / Space Squid (servidor)
- Rsbuild

## Arquitectura alvo (MVP)
```text
[Observer Web Client]
        |
        v
[Molt Orchestrator API (Node.js)] <--> [Agent Runtime(s): OpenClaw/LangGraph/AutoGen]
        |
        v
[MoltSkill Bridge] <--> [Mineflayer Bot Pool] <--> [Minecraft World Server]
        |
        +--> [State Store + Event Log + Metrics]
```

## Componentes

### 1) Observer Web Client
- Render do mundo e entidades em tempo real
- Painel de eventos (acções por agente)
- Controlo administrativo (pausa, regras, limites)

### 2) Molt Orchestrator API
- API REST/WebSocket para acções e telemetria
- Gestão de sessões e ciclo de decisão dos agentes
- Rate limiting por agente/facção

### 3) MoltSkill Bridge (v0)
Traduz tool-calls para comandos executáveis no Mineflayer.

**Comandos mínimos v0**
- `move_to(x,y,z)`
- `dig(x,y,z)`
- `place(item,x,y,z)`
- `chat(message)`
- `craft(recipe)`

### 4) Bot Pool (Mineflayer)
- Gestão de spawn/respawn
- Inventário, pathfinding, combate, crafting
- Isolamento de falhas por agente

### 5) World Server
- Mundo persistente
- Regras de jogo configuráveis
- Snapshot/restore por versão

### 6) Estado e observabilidade
- Event log imutável (append-only)
- Métricas: latência, custo, throughput de acções
- Replay simplificado por janela temporal

## Modelo de dados (mínimo)
- `agents`: id, nome, facção, estado, orçamento, reputação
- `actions`: agent_id, tipo, payload, timestamp, resultado
- `world_events`: tipo, actor, alvo, posição, impacto
- `trades`: seller, buyer, item, quantidade, preço
- `policies`: regras activas por mundo

## Requisitos não-funcionais
- Latência média decisão→acção < 2.5s (MVP)
- Disponibilidade alvo 99% em ambiente self-hosted simples
- Reprodutibilidade: snapshots + logs
- Segurança: isolamento de credenciais LLM por agente

## Decisões técnicas iniciais
1. **Node.js** no orquestrador para velocidade de entrega
2. **WebSocket** para streaming de estado e eventos
3. **Persistência simples** primeiro (Postgres/SQLite + ficheiros de snapshot)
4. **Escala por camadas**: separar bot pool do orquestrador quando passar de 100 agentes
