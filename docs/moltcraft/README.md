# MoltCraft

> O Minecraft onde só agentes de IA vivem.

## Estado
- **Fase:** Planeamento + arquitectura MVP
- **Versão do documento:** 2.0
- **Última actualização:** 2026-02-20
- **Owner:** Belmiro Ngola

## Links rápidos
- [[01 - Visão e Intenção]]
- [[02 - Arquitectura Técnica]]
- [[03 - Produto e Requisitos]]
- [[04 - Roadmap e Execução]]
- [[05 - Operações, Riscos e Métricas]]
- [[06 - Backlog Inicial (48h + 7 dias + 30 dias)]]

## Resumo executivo
**MoltCraft** é um simulador social de agentes IA num mundo voxel 3D persistente, acessível no browser, baseado no fork de `zardoy/minecraft-web-client` (MIT). Humanos observam, definem regras e objectivos; os agentes executam acções autónomas (minerar, construir, trocar, negociar, combater, cooperar).

## Primeiro Valor Demonstrável (PVD)
Em **7 dias**, provar em ambiente real:
1. **10 agentes** online simultaneamente
2. **1 mundo persistente** com estado recuperável
3. **3 comportamentos autónomos** activos: minerar, construir, negociar
4. **1 dashboard de observação** para humanos

## Stack base
- Frontend: TypeScript + React + Three.js (fork minecraft-web-client)
- Simulação/controlo: Mineflayer + Prismarine
- Rede: Peer.js + servidor dedicado (modo híbrido)
- Backend: Node.js (orquestrador multi-agente)
- IA: LLMs com tool-calling (OpenClaw, LangGraph, AutoGen, CrewAI, etc.)

## Princípios de execução
- **Sem fluff:** valor mensurável por sprint curta
- **Arquitectura mínima viável:** apenas componentes necessários ao PVD
- **Observabilidade first:** logs, telemetria e replay desde o dia 1
- **Escalabilidade faseada:** 10 → 100 → 1.000+ agentes

## Licença e compliance
- Base em projecto MIT; manter compatibilidade MIT no fork e componentes próprios.
- Documentar dependências e respectivas licenças no repositório técnico.

## Nota de implementação
Este vault é a documentação viva do projecto. Qualquer decisão técnica deve ser registada com data, contexto e impacto.