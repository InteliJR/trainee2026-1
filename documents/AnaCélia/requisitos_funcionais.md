# Requisitos funcionais cruciais

| ID | Requisito funcional | Prioridade |
|:---:|---|:---:|
| RF01 | Permitir cadastro e login de usuários | Essencial |
| RF02 | Permitir identificar o perfil do usuário: morador ou coletor | Essencial |
| RF03 | Permitir ao morador cadastrar ou selecionar um endereço | Essencial |
| RF04 | Permitir ao morador solicitar uma coleta | Essencial |
| RF05 | Permitir informar o material e a data desejada | Essencial |
| RF06 | Permitir acompanhar o status da coleta | Essencial |
| RF07 | Permitir localizar pontos ou coletores disponíveis | Essencial |
| RF08 | Permitir ao coletor visualizar as coletas atribuídas | Essencial |
| RF09 | Permitir ao coletor visualizar os detalhes da coleta | Essencial |
| RF10 | Permitir ao coletor confirmar ou concluir uma coleta | Essencial |
| RF11 | Permitir o cancelamento de uma coleta | Essencial |
| RF12 | Registrar o histórico de coletas do morador | Essencial |
| RF13 | Dar retorno ao morador após a conclusão de uma coleta | Essencial |
| RF14 | Integrar as solicitações com a API EcoRota | Essencial |
| RF15 | Sincronizar o status da coleta entre o sistema e a API EcoRota | Essencial |
| RF16 | Garantir que pontos ou recompensas sejam concedidos somente após a conclusão da coleta | Importante |
| RF17 | Permitir visualizar saldo, pontos ou reconhecimento | Importante |
| RF18 | Permitir à EcoRota acompanhar informações básicas da operação em um dashboard | Não definida |


### Fluxo de Telas 


ECOROTA
│
├── Login- dados de contato, telefone
├── Cadastro
│
├── MORADOR
│   │
│   ├── Home
│   │
│   ├── Nova coleta
│   │   ├── Endereço-com foto
│   │   ├── Material
│   │   ├── Data
│   │   ├── Revisão
│   │   └── Confirmação
│   │
│   ├── Acompanhar coleta
│   │   ├── Status da coleta
│   │   ├── Dados da coleta
│   │   └── Coletor responsável
│   │
│   ├── Explorar
│   │   ├── Mapa
│   │   ├── Pontos
│   │   
│   │
│   ├── Histórico
│   │   ├── Lista de coletas
│   │   └── Detalhes
│   │
│   └── EcoPontos- Ranking

│
├── COLETOR
│   │
│   ├── Home 
│   ├── Coletas do dia
│   ├── Detalhes
│   ├── Atendimento
│   │   ├── Iniciar atendimento
│   │   ├── Atualizar status
│   │   └── Registrar atendimento-foto da coleta
│   └── Conclusão / Cancelamento
│
└── ECOROTA / OPERAÇÃO
    │
    ├── Dashboard operacional
    ├── Solicitações
    ├── Ver perfis  de Coletores de moradores
    └── Visão geral da operação e Ranking dos usuários e dos coletores.




### Adiciona divisão das tarefas 


Frente
O que precisa ser feito





1. Requisitos e Regras de Negócio
Definir o que o sistema precisa fazer para morador, coletor e EcoRota


2. UX/UI
Fluxos de Telas;


3. Tecnologias
Escolher frontend, backend, banco de dados, autenticação, mapa e deploy;


4. Arquitetura
Definir como Frontend → Backend → API EcoRota irão se comunicar


5. API EcoRota
Entender endpoints, autenticação, coletores, solicitações, localização, rotas e status.


6. Backend
Criar regras, autenticação, endpoints internos, validações e integração com a API


7. Frontend Morador
Solicitar coleta, acompanhar status, visualizar pontos/coletores, histórico e recompensas


8. Frontend Coletor
Visualizar coletas, confirmar, cancelar, atualizar status e concluir atendimento


9. Integração
Conectar frontend, backend e API da EcoRota


10. Testes
Testar o fluxo completo, erros, cancelamentos, histórico e atualização dos dados


11. Deploy
Colocar frontend e backend disponíveis online;


12. Documentação
Explicar arquitetura, tecnologias, execução, limitações e decisões;










