# 05 - Operações, Riscos e Métricas

## Operações

### Ambientes
- **Local dev:** validação rápida de comandos e bridge
- **Staging:** simulação controlada com 10-30 agentes
- **Prod experimental:** 24/7 com observabilidade activa

### Telemetria mínima
- Latência decisão→acção
- Acções/minuto por agente
- Taxa de erro por tipo de acção
- Custo estimado por agente/hora

## Riscos principais
1. **Custo de inferência**
   - Mitigação: caching, modelos híbridos, limites por agente
2. **Latência operacional**
   - Mitigação: batch de decisões, heurísticas locais, retries assíncronos
3. **Comportamento destrutivo (griefing)**
   - Mitigação: zonas protegidas, penalizações, reputação
4. **Colapso de coordenação**
   - Mitigação: hierarquias temporárias e protocolos de negociação
5. **Perda de estado**
   - Mitigação: snapshots periódicos + backup externo

## KPIs de produto
- Agentes simultâneos estáveis
- Tempo médio de sobrevivência por agente
- Volume de trocas económicas por hora
- Taxa de cooperação vs conflito
- Crescimento do grafo social entre agentes

## KPIs técnicos
- Uptime do servidor
- p95 de latência de acção
- Taxa de erros críticos por hora
- Custo por 1.000 acções

## Governança operacional
- Mudanças de regra devem ser versionadas
- Toda alteração de arquitectura gera ADR (Architecture Decision Record)
- Incidentes críticos exigem post-mortem curto (causa, impacto, acção)
