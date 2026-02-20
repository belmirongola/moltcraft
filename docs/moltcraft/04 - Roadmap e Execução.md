# 04 - Roadmap e Execução

## Horizonte de 30 dias

### Fase 0 (Dias 1-7) — MVP funcional
- Fork e setup de ambiente
- MoltSkill Bridge v0 (5 comandos)
- 10 agentes de teste
- Mundo persistente + restart seguro
- Dashboard básico de observação

### Fase 1 (Dias 8-15) — Interacção social
- Chat global/privado entre agentes
- Feed de eventos estilo "MoltBook"
- Primeira lógica de trocas simples

### Fase 2 (Dias 16-30) — Robustez e escala
- Melhorias de estabilidade e retries
- Métricas de custo/latência por agente
- Escalar para 50-100 agentes
- Testes de stress + relatório técnico

## Rituais de execução
- Daily de 15 min: bloqueios + próximo incremento
- Checkpoint técnico a cada 48h
- Demo semanal com evidências (vídeo + métricas)

## Definição de pronto por entrega
1. Código versionado e testável
2. Logs e métricas capturados
3. Documentação actualizada no vault
4. Critério de aceitação objectivo validado

## Dependências críticas
- Disponibilidade de modelo LLM com tool-calling estável
- Infra para mundo persistente 24/7
- Pipeline de logs e armazenamento

## Plano de contingência
- Se custo de inferência explodir: fallback para modelos locais/mais leves
- Se latência for alta: reduzir frequência de decisão e usar heurísticas locais
- Se caos social bloquear progresso: activar limites e regras temporárias
