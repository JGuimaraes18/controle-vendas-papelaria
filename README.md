# CIVEN – Centralização e Inteligência de Vendas e Negócios

Projeto de desenvolvimento de uma aplicação robusta e escalável para controle de vendas e relatórios de comissões, projetada com uma arquitetura moderna dividida entre cliente e servidor, e empacotada em containers para máxima portabilidade.

---

## Arquitetura da Aplicação

O sistema foi modularizado em duas camadas independentes (Frontend e Backend), permitindo isolamento de responsabilidades e facilidade na manutenção do ecossistema de dados.

### Níveis de Acesso (Perfis)
*   **Administrador (Admin):** Acesso total ao sistema, incluindo criação, edição e exclusão de vendas, além de visualização completa do relatório de comissões de todos os colaboradores.
*   **Vendedor (Seller):** Perfil restrito. Pode visualizar a listagem e os detalhes das vendas, mas possui permissões bloqueadas para edição ou exclusão de registros.

### Frontend
Uma interface de usuário (UI) responsiva e componentizada.
*   **Tecnologias:** React, TypeScript e TailwindCSS.
*   **Destaques:** Filtros avançados em tempo real na listagem, tratamento visual para inputs de data/calendário e controle de renderização condicional baseado nas permissões do usuário logado.

### Backend
Uma API REST estruturada, segura e tipada para as regras de negócio.
*   **Tecnologias:** Django (Python).
*   **Destaques:** 
    *   **Autenticação Stateless com JWT:** Comunicação segura entre cliente/servidor baseada em tokens de acesso e refresh.
    *   **Documentação Interativa (Swagger):** Endpoints mapeados.
    *   **Controle de Permissões Rígido:** Separação de escopo por grupos corporativos (`ADMIN` e `SELLER`) protegendo as rotas da API.
    *   **Fechamento Automático:** Relatórios precisos de faturamento e cálculo de comissões.
---

## Infraestrutura & Docker

Toda a aplicação é orquestrada via **Docker Containers**, garantindo que o comportamento do sistema seja idêntico em qualquer ambiente de desenvolvimento ou produção. O projeto conta com duas esteiras de execução:
1.  **Ambiente de Desenvolvimento (`dev`):** Configurado com *hot-reload* no frontend e modo *debug* ativo no backend para agilidade no código diário.
2.  **Ambiente de Produção (`prod`):** Configurações otimizadas, sem código fonte exposto para edição direta e preparado para performance.

---

## Como Levantar o Ambiente Local

Siga os passos abaixo para clonar, configurar e rodar o projeto na sua máquina.

### 1. Clonar o Repositório
Abra o seu terminal e execute:

```bash
git clone https://github.com/JGuimaraes18/controle-vendas-papelaria.git controle-vendas-papelaria
cd controle-vendas-papelaria
```

### 2. Configurar as Variáveis de Ambiente (`.env`)

O projeto utiliza variáveis de ambiente para gerenciar credenciais de forma segura. Os arquivos de exemplo estão na raiz do projeto. Basta duplicá-los e remover o `.example` do nome e ajustar os parâmetros de acordo com seu ambiente:

```bash
# Para o ambiente de Desenvolvimento:
cp .env.dev.example .env.dev

# Para o ambiente de Produção:
cp .env.prod.example .env.prod
```

### 3. Iniciar a aplicação em modo Dev e Prod

Para construir e levantar o ambiente de desenvolvimento local:

```bash
# Se for a primeira execução ou houver novas dependências:
make build-dev

# Para apenas iniciar os containers no modo Dev:
make start-dev

# Se for a primeira execução ou houver novas dependências:
make build-prod

# Para apenas iniciar os containers no modo Dev:
make start-prod

# Para parar todos os containers ativos do projeto:
make stop
```

### 4. Acessando a Aplicação

Independentemente do modo escolhido (Desenvolvimento ou Produção), a infraestrutura do Docker foi desenhada para centralizar e expor o ecossistema diretamente nas portas web padrão.

Abra o seu navegador e acesse:

Frontend: http://localhost:80 (ou apenas http://localhost)

Backend: http://localhost:80/admin

API REST: http://localhost:80/api/

Documentação da API: http://localhost:80/docs/
