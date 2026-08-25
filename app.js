       const API_BASE_URL = window.location.origin;
       let roleAtiva = 'admin';
       let filtroPeriodo = 'Mês Atual'; 

        const dtHoje = new Date();
        const dtOntem = new Date(dtHoje); dtOntem.setDate(dtHoje.getDate() - 1);
        const formatDt = (d) => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');

        let planoSelecionado = { nome: '', preco: 0 };
        let dadosClinica = {};
        let colaboradoresCheckout = [];
        let clinicaLogada = null; 
        let clinicaId = null; 
        
        let equipe = [];
        let estoque = [];
        let transacoes = [];
        let agendamentos = [];
        let prontuarios = [];
        let especialidadesClinica = [];

        function temMudancaEmLista(novaLista, listaAnterior) {
            if (!Array.isArray(novaLista) || !Array.isArray(listaAnterior)) {
               return novaLista !== listaAnterior;
            }

            if (novaLista.length !== listaAnterior.length) {
               return true;
            }

            for (let i = 0; i < novaLista.length; i += 1) {
               if (JSON.stringify(novaLista[i]) !== JSON.stringify(listaAnterior[i])) {
                   return true;
               }
            }

            return false;
        }

        async function sincronizarDados() {
            if (!clinicaId) return;

            const endpoints = [
               { key: 'colaboradores', url: `/api/colaboradores/${clinicaId}` },
               { key: 'transacoes', url: `/api/transacoes/${clinicaId}` },
               { key: 'estoque', url: `/api/estoque/${clinicaId}` },
               { key: 'agenda', url: `/api/agenda/${clinicaId}` },
               { key: 'prontuarios', url: `/api/prontuarios/${clinicaId}` },
               { key: 'clientes', url: `/api/clientes/${clinicaId}` },
               { key: 'especialidades', url: `/api/especialidades/${clinicaId}` },
               { key: 'clinica', url: `/api/clinica/${clinicaId}` }
            ];

            try {
               const respostas = await Promise.all(endpoints.map(async (endpoint) => {
                   try {
                       const response = await fetch(endpoint.url);
                       if (!response || !response.ok) {
                           return { key: endpoint.key, data: null };
                       }

                       const data = await response.json();
                       return { key: endpoint.key, data };
                   } catch (error) {
                       console.warn(`Falha ao buscar ${endpoint.url}:`, error);
                       return { key: endpoint.key, data: null };
                   }
               }));

               const dados = Object.fromEntries(respostas.map((item) => [item.key, item.data]));

               if (Array.isArray(dados.especialidades)) {
                   especialidadesClinica = dados.especialidades;
               }

               if (dados.clinica && typeof dados.clinica === 'object') {
                   const clinicaDados = dados.clinica;
                   if (clinicaLogada) {
                       clinicaLogada.nomeClinica = clinicaDados.nome || clinicaLogada.nomeClinica;
                       clinicaLogada.logo = clinicaDados.logotipo || clinicaLogada.logo;
                       clinicaLogada.cnpj = clinicaDados.cnpj || clinicaLogada.cnpj || '';
                       clinicaLogada.telefone = clinicaDados.telefone || clinicaLogada.telefone || '';
                       clinicaLogada.endereco = clinicaDados.endereco || clinicaLogada.endereco || '';
                       clinicaLogada.email_contato = clinicaDados.email_contato || clinicaLogada.email_contato || '';
                   }
               }

               atualizarSelectsEspecialidades();

               if (Array.isArray(dados.colaboradores)) {
                   equipe = dados.colaboradores;
               }

               if (Array.isArray(dados.estoque)) {
                   estoque = dados.estoque;
               }

               if (Array.isArray(dados.prontuarios)) {
                   prontuarios = dados.prontuarios;
               }

               let mudouRecepcao = false;

               if (Array.isArray(dados.transacoes) && temMudancaEmLista(dados.transacoes, transacoes)) {
                   transacoes = dados.transacoes;
                   mudouRecepcao = true;
               }

               if (Array.isArray(dados.agenda) && temMudancaEmLista(dados.agenda, agendamentos)) {
                   agendamentos = dados.agenda;
                   mudouRecepcao = true;
               }

               const clientesAtuais = Array.isArray(window.clientesLista) ? window.clientesLista : [];
               if (Array.isArray(dados.clientes) && temMudancaEmLista(dados.clientes, clientesAtuais)) {
                   window.clientesLista = dados.clientes;
                   mudouRecepcao = true;
               }

               if (mudouRecepcao && clinicaLogada && clinicaLogada.role === 'Recepção') {
                   const modAtivo = document.querySelector('.sidebar-item.active');
                   if (modAtivo) {
                       const nomeMod = modAtivo.innerText;

                       if (nomeMod.includes('Dashboard')) {
                           navegarModulo('recepcao-dashboard');
                       } else if (nomeMod.includes('Fila')) {
                           navegarModulo('fila');
                       } else if (nomeMod.includes('Caixa')) {
                           navegarModulo('caixa');
                       } else if (nomeMod.includes('Relatórios')) {
                           navegarModulo('relatorios');
                       } else if (nomeMod.includes('Agenda') && typeof window.renderizarCalendario === 'function') {
                           window.renderizarCalendario();
                       } else if (nomeMod.includes('Clientes') && document.getElementById('busca-cliente')?.value === '') {
                           if (typeof renderClientes === 'function') {
                               renderClientes(window.clientesLista);
                           }
                       } else if (nomeMod.includes('Pets') && document.getElementById('busca-pet')?.value === '') {
                           if (typeof renderPets === 'function') {
                               renderPets(window.clientesLista);
                           }
                       }
                   }
               }
            } catch (error) {
               console.error('Erro ao sincronizar dados:', error);
            }
        }

        function mascaraMoeda(i) {
            let v = i.value.replace(/\D/g,'');
            if(v === '') { i.value = ''; return; }
            v = (v/100).toFixed(2) + '';
            v = v.replace(".", ",");
            v = v.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,");
            v = v.replace(/(\d)(\d{3}),/g, "$1.$2,");
            i.value = 'R$ ' + v;
        }

        function mascaraCPF(i) {
            let v = i.value.replace(/\D/g, "");
            if (v.length > 11) v = v.substring(0, 11);
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
            i.value = v;
        }

        function mascaraCNPJ(i) {
            let v = i.value.replace(/\D/g, "");
            if (v.length > 14) v = v.substring(0, 14);
            v = v.replace(/(\d{2})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{4})(\d{1,2})$/, "$1-$2");
            i.value = v;
        }

        function mascaraTelefone(i) {
            let v = i.value.replace(/\D/g, "");
            if (v.length > 11) v = v.substring(0, 11);
            v = v.replace(/(\d{2})(\d)/, "($1) $2");
            v = v.replace(/(\d{5})(\d)/, "$1-$2");
            i.value = v;
        }

        function mascaraCartao(i) {
            let v = i.value.replace(/\D/g, "");
            if (v.length > 16) v = v.substring(0, 16);
            v = v.replace(/(\d{4})(\d)/, "$1 $2");
            v = v.replace(/(\d{4})(\d)/, "$1 $2");
            v = v.replace(/(\d{4})(\d)/, "$1 $2");
            i.value = v;
        }

        function mascaraValidade(i) {
            let v = i.value.replace(/\D/g, "");
            if (v.length > 4) v = v.substring(0, 4);
            v = v.replace(/(\d{2})(\d)/, "$1/$2");
            i.value = v;
        }

        function mascaraCVV(i) {
            let v = i.value.replace(/\D/g, "");
            if (v.length > 4) v = v.substring(0, 4);
            i.value = v;
        }

        function irPara(id) {
            document.querySelectorAll('body > div').forEach(d => d.classList.add('hidden'));
            document.getElementById(id).classList.remove('hidden');
        }

        function selecionarPlano(n, p) {
            planoSelecionado = { nome: n, preco: p };
            document.getElementById('info-plano-etapa1').innerText = `Plano ${n} Selecionado - R$ ${p}/mês`;
            irPara('tela-checkout');
        }

        function mudarPerfil(r) {
            roleAtiva = r;
            document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
            document.getElementById('tab-'+r).classList.add('active');
        }

        async function processarAssinatura() { irPara('tela-login'); }

        // Função utilitária para buscar cabeçalhos comuns em rotas seguras
        function getAuthHeaders() {
            return {
                'Content-Type': 'application/json',
                'X-Clinic-Id': clinicaId,
                'X-Usuario-Nome': clinicaLogada.nome
            };
        }

        async function efetuarLogin() {
            const email = document.getElementById('login-email').value;
            const senha = document.getElementById('login-senha').value;

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ email, senha })
                });

                const data = await res.json();

                if (data.success) {
                    clinicaId = data.user.clinic_id;
                    clinicaLogada = { nome: data.user.nome, id: data.user.clinic_id, email: data.user.email, role: data.user.role };
                    
                    try {
                        const clinicaRes = await fetch(`/api/clinica/${clinicaId}`);
                        if(clinicaRes.ok) {
                            const clinicaDados = await clinicaRes.json();
                            clinicaLogada.nomeClinica = clinicaDados.nome;
                            clinicaLogada.logo = clinicaDados.logotipo;
                            clinicaLogada.cnpj = clinicaDados.cnpj || '';
                            clinicaLogada.telefone = clinicaDados.telefone || '';
                            clinicaLogada.endereco = clinicaDados.endereco || '';
                            clinicaLogada.email_contato = clinicaDados.email_contato || '';
                        }

                        const colabRes = await fetch(`/api/colaboradores/${clinicaId}`);
                        if(colabRes.ok) equipe = await colabRes.json();

                        const transRes = await fetch(`/api/transacoes/${clinicaId}`);
                        if(transRes.ok) transacoes = await transRes.json();

                        const estRes = await fetch(`/api/estoque/${clinicaId}`);
                        if(estRes.ok) estoque = await estRes.json();

                    } catch (error) {
                        console.error('Erro ao buscar dados iniciais:', error);
                    }
                    
                    irPara('app-container');
                    document.getElementById('clinica-tag').innerText = clinicaLogada.nomeClinica || `Clínica ${clinicaId}`;
                    
                    if (clinicaLogada.role === 'Administrador' || clinicaLogada.role === 'Recepção' || clinicaLogada.role === 'Veterinário') {
                        document.getElementById('menu-configuracoes').classList.remove('hidden');
                    } else {
                        document.getElementById('menu-configuracoes').classList.add('hidden');
                    }

                    atualizarLogoSidebar();
                    montarMenu();
                   if (clinicaLogada.role === 'Administrador') {
                    montarMenuAdmin();
                    navegarModulo('financeiro');
                } else if (clinicaLogada.role === 'Recepção') {
                    montarMenuRecepcao();
                    navegarModulo('recepcao-dashboard');
                } else if (clinicaLogada.role === 'Veterinário') {
                    montarMenuVet();
                    navegarModulo('agenda');
}
                } else {
                    mostrarPopup('❌ Erro de Login', data.error || "Usuário ou senha incorretos");
                }
            } catch (e) {
                mostrarPopup('🔌 Erro de Conexão', "Erro: O servidor não está rodando na porta 8080.");
            }
        }

        setInterval(sincronizarDados, 3000);

        function montarMenu() {
            document.getElementById('menu-lateral').innerHTML = `
                <div onclick="navegarModulo('financeiro')" class="sidebar-item" id="m-financeiro">💰 Financeiro</div>
                <div onclick="navegarModulo('equipe')" class="sidebar-item" id="m-equipe">👥 Equipe</div>
                <div onclick="navegarModulo('estoque')" class="sidebar-item" id="m-estoque">📦 Estoque</div>
                <div onclick="navegarModulo('auditoria')" class="sidebar-item" id="m-auditoria">📜 Auditoria</div>
            `;
        }
        function montarMenuAdmin() {
            document.getElementById('menu-lateral').innerHTML = `
                <div onclick="navegarModulo('financeiro')" class="sidebar-item">💰 Financeiro</div>
                <div onclick="navegarModulo('equipe')" class="sidebar-item">👥 Equipe</div>
                <div onclick="navegarModulo('estoque')" class="sidebar-item">📦 Estoque</div>
                <div onclick="navegarModulo('auditoria')" class="sidebar-item">📜 Auditoria</div>
            `;
        }

        function montarMenuRecepcao() {
            document.getElementById('menu-lateral').innerHTML = `
                <div onclick="navegarModulo('recepcao-dashboard')" class="sidebar-item">📊 Dashboard</div>
                <div onclick="navegarModulo('agenda')" class="sidebar-item">📅 Agenda</div>
                <div onclick="navegarModulo('clientes')" class="sidebar-item">👤 Clientes</div>
                <div onclick="navegarModulo('pets')" class="sidebar-item">🐶 Pets</div>
                <div onclick="navegarModulo('fila')" class="sidebar-item">⏳ Fila</div>
                <div onclick="navegarModulo('caixa')" class="sidebar-item">💰 Caixa</div>
                <div onclick="navegarModulo('relatorios')" class="sidebar-item">📄 Relatórios</div>
            `;
        }

        function montarMenuVet() {
            document.getElementById('menu-lateral').innerHTML = `
                <div onclick="navegarModulo('agenda')" class="sidebar-item" id="m-agenda">📅 Agenda</div>
                <div onclick="navegarModulo('prontuario')" class="sidebar-item" id="m-prontuario">📋 Prontuário</div>
            `;
        }

        async function navegarModulo(mod) {
            await sincronizarDados();
            const cont = document.getElementById('conteudo-dinamico');
            const tit = document.getElementById('modulo-titulo');
            const actions = document.getElementById('header-actions');
            
            document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
            if(document.getElementById('m-'+mod)) document.getElementById('m-'+mod).classList.add('active');
            actions.innerHTML = "";

            if(mod === 'financeiro') {
                tit.innerText = "Visão de Negócio";
                actions.innerHTML = `
                    <select id="filtro-data" class="p-2 border rounded-lg text-sm font-bold bg-white cursor-pointer hover:bg-gray-50" onchange="mudarFiltroPeriodo(this.value)">
                        <option value="Hoje" ${filtroPeriodo === 'Hoje' ? 'selected' : ''}>Hoje</option>
                        <option value="Últimos 7 dias" ${filtroPeriodo === 'Últimos 7 dias' ? 'selected' : ''}>Últimos 7 dias</option>
                        <option value="Mês Atual" ${filtroPeriodo === 'Mês Atual' ? 'selected' : ''}>Mês Atual</option>
                    </select>
                    <button onclick="abrirModalTransacao()" class="btn-principal px-4 py-2 rounded-lg font-bold text-sm">+ Nova Transação</button>
                    <button onclick="window.print()" class="bg-white border px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-50">📥 Exportar PDF</button>
                `;
                atualizarDOMFinanceiro(cont);
            
            } else if(mod === 'equipe') {
                tit.innerText = "Recursos Humanos";
                actions.innerHTML = `<button onclick="abrirModalColaborador()" class="btn-principal px-6 py-2 rounded-xl font-bold">+ Novo Colaborador</button>`;
                cont.innerHTML = `
                    <div class="mb-6"><input id="busca-equipe" onkeyup="filtrarEquipe()" placeholder="Buscar por nome ou CPF..." class="input-pet !w-full max-w-md"></div>
                    <div class="card">
                        <table>
                            <thead><tr><th>Nome</th><th>Cargo</th><th>E-mail</th><th>Status</th><th>Último Acesso</th><th>Ações</th></tr></thead>
                            <tbody id="tabela-equipe-corpo">${renderEquipe(equipe)}</tbody>
                        </table>
                    </div>
                `;
            
            } else if(mod === 'estoque') {
                tit.innerText = "Estoque Estratégico";
                actions.innerHTML = `<button onclick="abrirModalEstoque()" class="btn-principal px-6 py-2 rounded-xl font-bold">+ Novo Item</button>`;
                cont.innerHTML = `
                    <div class="bg-red-50 border border-red-200 p-4 rounded-xl mb-6 flex gap-4 items-center">
                        <span class="text-2xl">⚠️</span>
                        <div><p class="font-bold text-red-800 text-sm">Alerta de Suprimentos Baixos</p><p class="text-xs text-red-600">Itens com quantidade abaixo de 5 precisam ser repostos.</p></div>
                    </div>
                    <div class="card">
                        <table>
                            <thead><tr><th>Produto</th><th>Lote</th><th>Validade</th><th>Qtd</th><th class="text-right">Ações Rápidas</th></tr></thead>
                            <tbody id="tabela-estoque-corpo">${renderEstoque()}</tbody>
                        </table>
                    </div>
                `;
            
            } else if(mod === 'auditoria') {
                tit.innerText = "Logs de Auditoria";
                actions.innerHTML = `<button onclick="carregarAuditoria()" class="btn-principal px-4 py-2 rounded-lg font-bold text-sm">Atualizar Logs</button>`;
                cont.innerHTML = `Carregando logs de segurança...`;
                carregarAuditoria(); // Fetch automático 
            
            } else if(mod === 'configuracoes') {
                // --- INÍCIO DO CÓDIGO DA RECEPÇÃO E VETERINÁRIO ---
                if (clinicaLogada.role === 'Recepção' || clinicaLogada.role === 'Veterinário') {
                    tit.innerText = clinicaLogada.role === 'Veterinário' ? "Configurações da Conta" : "Configurações da Recepção";
                    cont.innerHTML = `
                        <div class="max-w-2xl">
                            <div class="card mb-6">
                                <h3 class="text-xl font-bold mb-4 border-b pb-2">Meu Perfil</h3>
                                <div class="space-y-4">
                                    <div>
                                        <label class="text-xs font-bold text-gray-500 mb-1 block">Nome do Colaborador</label>
                                        <input value="${clinicaLogada.nome}" class="input-pet bg-gray-100 cursor-not-allowed" readonly>
                                    </div>
                                    <div>
                                        <label class="text-xs font-bold text-gray-500 mb-1 block">E-mail de Acesso</label>
                                        <input value="${clinicaLogada.email}" class="input-pet bg-gray-100 cursor-not-allowed" readonly>
                                    </div>
                                    <div>
                                        <label class="text-xs font-bold text-gray-500 mb-1 block">Nível de Permissão</label>
                                        <input value="${clinicaLogada.role}" class="input-pet bg-gray-100 font-bold text-blue-600 cursor-not-allowed" readonly>
                                    </div>
                                </div>
                            </div>
                            <div class="card">
                                <h3 class="text-xl font-bold mb-4 border-b pb-2">Segurança da Conta</h3>
                                <div class="space-y-4">
                                    <div>
                                        <label class="text-xs font-bold text-gray-500 mb-1 block">E-mail de Acesso Atual</label>
                                        <input value="${clinicaLogada.email || ''}" class="input-pet bg-gray-100" disabled>
                                    </div>
                                    <div>
                                        <label class="text-xs font-bold text-gray-500 mb-1 block">Nova Senha</label>
                                        <input id="config-nova-senha" type="password" placeholder="Mínimo 6 caracteres" class="input-pet">
                                    </div>
                                    <button onclick="salvarNovaSenha()" class="btn-principal px-6 py-2 rounded-xl font-bold mt-2">Alterar Senha</button>
                                </div>
                            </div>
                        </div>
                    `;
                    return; // O return garante que ele não carregue as configurações do Admin abaixo
                }
                // --- FIM DO CÓDIGO DA RECEPÇÃO ---
                tit.innerText = "Configurações do Sistema";
                cont.innerHTML = `
                    <div class="max-w-2xl">
                        <div class="card mb-6">
                            <h3 class="text-xl font-bold mb-4 border-b pb-2">Informações da Clínica</h3>
                            <div class="space-y-4">
                                <div>
                                    <label class="text-xs font-bold text-gray-500 mb-1 block">Nome da Clínica</label>
                                    <input id="config-nome-clinica" value="${clinicaLogada.nomeClinica || ''}" class="input-pet">
                                </div>
                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <label class="text-xs font-bold text-gray-500 mb-1 block">CNPJ</label>
                                        <input id="config-cnpj-clinica" value="${clinicaLogada.cnpj || ''}" onkeyup="mascaraCNPJ(this)" class="input-pet">
                                    </div>
                                    <div>
                                        <label class="text-xs font-bold text-gray-500 mb-1 block">Telefone</label>
                                        <input id="config-telefone-clinica" value="${clinicaLogada.telefone || ''}" onkeyup="mascaraTelefone(this)" class="input-pet">
                                    </div>
                                </div>
                                <div>
                                    <label class="text-xs font-bold text-gray-500 mb-1 block">Endereço (Aparecerá em Relatórios/Receitas)</label>
                                    <input id="config-endereco-clinica" value="${clinicaLogada.endereco || ''}" class="input-pet">
                                </div>
                                <div>
                                    <label class="text-xs font-bold text-gray-500 mb-1 block">E-mail de Contato</label>
                                    <input id="config-email-contato" value="${clinicaLogada.email_contato || ''}" class="input-pet">
                                </div>
                        <div class="card"> 
                            <h3 class="text-xl font-bold mb-4 border-b pb-2">Segurança da Conta</h3>
                            <div class="space-y-4">
                                <div>
                                    <label class="text-xs font-bold text-gray-500 mb-1 block">E-mail de Acesso Atual</label>
                                    <input value="${clinicaLogada.email || ''}" class="input-pet bg-gray-100" disabled>
                                </div>
                                <div>
                                    <label class="text-xs font-bold text-gray-500 mb-1 block">Nova Senha</label>
                                    <input id="config-nova-senha" type="password" placeholder="Mínimo 6 caracteres" class="input-pet">
                                </div>
                                <button onclick="salvarNovaSenha()" class="btn-principal px-6 py-2 rounded-xl font-bold mt-2">Alterar Senha</button>
                            </div>
                        </div>
                    </div>
                `;
                setTimeout(() => {
                    inicializarSelect('config-categorias-prontuario-select', 
                        clinicaLogada.categorias_prontuario || "Consulta, Cirurgia, Exame"
                    );
                    inicializarSelect('config-tipos-animais-select', 
                        clinicaLogada.tipos_animais || "Cachorro, Gato"
                    );
                    inicializarSelect('config-cargos-select', 
                        clinicaLogada.cargos || "Administrador, Veterinário, Recepção"
                    );
                }, 100);
            }
            // === RECEPÇÃO ===

            else if(mod === 'recepcao-dashboard') {
                tit.innerText = "Dashboard - Recepção";

                // 1. FATURAMENTO (Conectado com a aba Caixa)
                // O formato de data em transacoes é DD/MM
                const hojeTransacoes = formatDt(new Date());
                const transHoje = transacoes.filter(t => t.data === hojeTransacoes);

                const faturamento = transHoje
                    .filter(t => t.tipo === 'entrada')
                    .reduce((a,b)=>a+b.valor, 0);

                // 2. AGENDAMENTOS E FILA (Conectado com as abas Agenda e Fila)
                // O formato de data em agenda é YYYY-MM-DD
                const dataHojeLocal = new Date();
                const ano = dataHojeLocal.getFullYear();
                const mes = String(dataHojeLocal.getMonth() + 1).padStart(2, '0');
                const dia = String(dataHojeLocal.getDate()).padStart(2, '0');
                const dataHojeFormatada = `${ano}-${mes}-${dia}`;

                // Filtra apenas os agendamentos reais de hoje do banco
                const agendaHoje = agendamentos.filter(a => a.data === dataHojeFormatada);

                const totalAgendamentos = agendaHoje.length;
                const emAtendimento = agendaHoje.filter(a => a.status === 'Em atendimento').length;
                const aguardando = agendaHoje.filter(a => a.status === 'Aguardando' || a.status === 'Já chegou').length;
                const concluidos = agendaHoje.filter(a => a.status === 'Finalizado').length;

                // 3. GRÁFICO REAL (Agendamentos por Hora baseados na Agenda)
                const atendimentosPorHora = {};
                agendaHoje.forEach(a => {
                    const hora = a.hora.substring(0, 2) + "h"; // Extrai a hora (ex: "08h")
                    atendimentosPorHora[hora] = (atendimentosPorHora[hora] || 0) + 1;
                });

                const labels = Object.keys(atendimentosPorHora).sort();
                const dados = labels.map(l => atendimentosPorHora[l]);

                cont.innerHTML = `
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <div class="card border-0 rounded-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:shadow-md transition-all bg-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm font-semibold text-[#6c757d] uppercase mb-1">Agendamentos (Hoje)</p>
                                    <h3 class="text-4xl font-extrabold text-gray-900">${totalAgendamentos}</h3>
                                </div>
                                <div class="bg-blue-50 w-12 h-12 flex items-center justify-center rounded-xl text-xl shadow-sm">
                                    <i class="fa-solid fa-calendar-check text-blue-500"></i>
                                </div>
                            </div>
                        </div>
                        <div class="card border-0 rounded-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:shadow-md transition-all bg-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm font-semibold text-[#6c757d] uppercase mb-1">Aguardando</p>
                                    <h3 class="text-4xl font-extrabold text-gray-900">${aguardando}</h3>
                                </div>
                                <div class="bg-yellow-50 w-12 h-12 flex items-center justify-center rounded-xl text-xl shadow-sm">
                                    <i class="fa-solid fa-hourglass-half text-yellow-500"></i>
                                </div>
                            </div>
                        </div>
                        <div class="card border-0 rounded-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:shadow-md transition-all bg-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm font-semibold text-[#6c757d] uppercase mb-1">Em Atendimento</p>
                                    <h3 class="text-4xl font-extrabold text-gray-900">${emAtendimento}</h3>
                                </div>
                                <div class="bg-orange-50 w-12 h-12 flex items-center justify-center rounded-xl text-xl shadow-sm">
                                    <i class="fa-solid fa-user-doctor text-orange-500"></i>
                                </div>
                            </div>
                        </div>
                        <div class="card border-0 rounded-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:shadow-md transition-all bg-white">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm font-semibold text-[#6c757d] uppercase mb-1">Finalizados</p>
                                    <h3 class="text-4xl font-extrabold text-gray-900">${concluidos}</h3>
                                </div>
                                <div class="bg-green-50 w-12 h-12 flex items-center justify-center rounded-xl text-xl shadow-sm">
                                    <i class="fa-solid fa-check-circle text-green-500"></i>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div class="card lg:col-span-1 flex flex-col justify-center bg-white border-0 rounded-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:shadow-md transition-all">
                            <div class="flex items-center gap-3 mb-4 border-b border-gray-100 pb-3">
                                <div class="bg-green-50 w-10 h-10 flex items-center justify-center rounded-lg text-lg">
                                    <i class="fa-solid fa-sack-dollar text-green-600"></i>
                                </div>
                                <h3 class="font-bold text-[#6c757d] uppercase text-sm tracking-wider">Faturamento Diário</h3>
                            </div>
                            <div class="text-center py-6">
                                <p class="text-4xl font-black text-green-600 tracking-tight">
                                    R$ ${faturamento.toLocaleString('pt-BR',{minimumFractionDigits:2})}
                                </p>
                                <p class="text-[11px] text-[#6c757d] font-bold mt-3 bg-gray-50 inline-block px-3 py-1 rounded-full uppercase tracking-wider">No caixa de hoje</p>
                            </div>
                        </div>

                        <div class="card lg:col-span-2 bg-white border-0 rounded-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:shadow-md transition-all">
                            <div class="flex items-center gap-3 mb-4 border-b border-gray-100 pb-3">
                                <div class="bg-blue-50 w-10 h-10 flex items-center justify-center rounded-lg text-lg">
                                    <i class="fa-solid fa-chart-line text-blue-500"></i>
                                </div>
                                <h3 class="font-bold text-[#6c757d] uppercase text-sm tracking-wider">Fluxo de Agendamentos por Hora</h3>
                            </div>
                            <div class="w-full pt-2">
                                <canvas id="graficoRecepcao" height="80"></canvas>
                            </div>
                        </div>
                    </div>
                `;

                setTimeout(() => {
                    const ctx = document.getElementById('graficoRecepcao');
                    // Destrói o gráfico anterior para evitar sobreposição ao trocar de abas
                    if(window.chartRecepcao) window.chartRecepcao.destroy();

                    window.chartRecepcao = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: labels.length ? labels : ['Sem agendamentos'],
                            datasets: [{
                                label: 'Qtd. de Agendamentos',
                                data: dados.length ? dados : [0],
                                backgroundColor: '#3b82f6',
                                borderRadius: 6
                            }]
                        },
                        options: {
                            responsive: true,
                            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                        }
                    });
                }, 100);
            }

             else if(mod === 'agenda') {
                tit.innerText = "Agenda";
                
                // Inicializa variáveis do calendário globalmente para não resetar
                if (typeof window.mesAtual === 'undefined') {
                    window.dataAtualCal = new Date();
                    window.mesAtual = window.dataAtualCal.getMonth();
                    window.anoAtual = window.dataAtualCal.getFullYear();
                }

                // Função que desenha o calendário
                window.renderizarCalendario = function() {
                    const contCalendario = document.getElementById('calendario-container');
                    if (!contCalendario) return;

                    const hoje = new Date();
                    const primeiroDiaMes = new Date(window.anoAtual, window.mesAtual, 1).getDay();
                    const diasNoMes = new Date(window.anoAtual, window.mesAtual + 1, 0).getDate();
                    
                    const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
                    document.getElementById('mes-ano-display').innerText = `${nomesMeses[window.mesAtual]} ${window.anoAtual}`;

                    let htmlDias = '';
                    
                    // Dias vazios antes do início do mês
                    for (let i = 0; i < primeiroDiaMes; i++) {
                        htmlDias += `<div class="p-2"></div>`;
                    }

                   // Dias preenchidos do mês
                    for (let i = 1; i <= diasNoMes; i++) {
                        const isHoje = (i === hoje.getDate() && window.mesAtual === hoje.getMonth() && window.anoAtual === hoje.getFullYear());
                        
                        // Verifica se tem agendamento neste dia
                        const dataFormatada = `${window.anoAtual}-${String(window.mesAtual + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                        const qtdAgendamentos = agendamentos.filter(a => {
                            if (clinicaLogada.role === 'Veterinário' && a.veterinario !== clinicaLogada.nome) return false;
                            return a.data === dataFormatada;
                        }).length;
                        const badge = qtdAgendamentos > 0 ? `<div class="mt-1 bg-blue-100 text-blue-800 text-[10px] rounded-full px-2 py-0.5 inline-block font-bold">${qtdAgendamentos} agend.</div>` : '';

                        htmlDias += `
                            <div class="${isHoje ? 'bg-blue-500 text-white font-bold shadow' : 'bg-gray-50 hover:bg-gray-200 text-gray-700 cursor-pointer'} p-2 rounded transition-colors flex flex-col items-center justify-center min-h-[60px]" onclick="window.abrirModalAgendamentosDoDia(${i}, ${window.mesAtual}, ${window.anoAtual})">
                                <span>${i}</span>
                                ${badge}
                            </div>
                        `;
                    }
                    contCalendario.innerHTML = htmlDias;
                };

                // Função para avançar ou recuar os meses
                window.mudarMes = function(step) {
                    window.mesAtual += step;
                    if (window.mesAtual < 0) {
                        window.mesAtual = 11;
                        window.anoAtual--;
                    } else if (window.mesAtual > 11) {
                        window.mesAtual = 0;
                        window.anoAtual++;
                    }
                    window.renderizarCalendario();
                };

                // Função para exibir tudo marcado no dia clicado
                window.abrirModalAgendamentosDoDia = function(dia, mes, ano) {
                    const dataFormatada = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                    const agendamentosDoDia = agendamentos.filter(a => {
                        if (clinicaLogada.role === 'Veterinário' && a.veterinario !== clinicaLogada.nome) return false;
                        return a.data === dataFormatada;
                    });
                    
                    let htmlLista = '';
                    if(agendamentosDoDia.length === 0) {
                        htmlLista = '<p class="text-gray-500 text-center py-4">Nenhum atendimento marcado para este dia.</p>';
                    } else {
                        // Ordena pela hora
                        agendamentosDoDia.sort((a, b) => a.hora.localeCompare(b.hora));
                        htmlLista = agendamentosDoDia.map(a => `
                            <div class="p-4 border border-gray-200 rounded-xl mb-3 bg-white shadow-sm">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="font-black text-blue-600 text-lg">🕒 ${a.hora}</span>
                                    <span class="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-md text-xs font-bold uppercase">${a.tipo} - ${a.especialidade || 'Clínica Geral'}</span>
                                </div>
                                <p class="text-sm text-gray-800"><b class="text-gray-500">Cliente:</b> ${a.cliente}</p>
                                <p class="text-sm text-gray-800"><b class="text-gray-500">Pet:</b> ${a.pet}</p>
                                ${a.obs ? `<p class="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded border"><b>Obs:</b> ${a.obs}</p>` : ''}
                            </div>
                        `).join('');
                    }

                    document.getElementById('modal-titulo').innerText = `Agenda: ${String(dia).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}/${ano}`;
                    document.getElementById('modal-body').innerHTML = `<div class="max-h-96 overflow-y-auto bg-gray-50 p-3 rounded-lg">${htmlLista}</div>`;
                    
                    const btn = document.getElementById('modal-confirmar');
                    btn.innerText = "Fechar";
                    btn.style.background = '#9ca3af'; // Volta para cinza
                    btn.onclick = fecharModal;
                    
                    document.getElementById('modal-container').style.display = 'flex';
                };

                // HTML do calendário interativo mantendo o padrão visual
                cont.innerHTML = `
                    <div class="flex justify-between items-center mb-4">
                        <div class="flex items-center gap-4">
                            <button onclick="window.mudarMes(-1)" class="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-100 rounded font-bold text-gray-600">&lt;</button>
                            <h3 id="mes-ano-display" class="font-bold text-lg min-w-[150px] text-center text-gray-800"></h3>
                            <button onclick="window.mudarMes(1)" class="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-100 rounded font-bold text-gray-600">&gt;</button>
                        </div>
                        ${clinicaLogada.role === 'Veterinário' ? '' : '<button onclick="abrirModalAgendamento()" class="btn-principal px-4 py-2 rounded-lg font-bold shadow-sm">+ Novo Agendamento</button>'}
                    </div>
                    <div class="card">
                        <div class="grid grid-cols-7 gap-2 text-center font-bold text-gray-400 text-xs uppercase mb-2">
                            <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
                        </div>
                        <div id="calendario-container" class="grid grid-cols-7 gap-2 text-center">
                            </div>
                    </div>
                `;

                // Renderiza assim que injetar o HTML
                setTimeout(window.renderizarCalendario, 0);
            }

             else if(mod === 'fila') {
                tit.innerText = "Fila de Atendimento (Hoje)";
                actions.innerHTML = ``;
                
                // Pega a data de hoje para bater com a do banco de dados (formato YYYY-MM-DD)
                const dataHojeLocal = new Date();
                const ano = dataHojeLocal.getFullYear();
                const mes = String(dataHojeLocal.getMonth() + 1).padStart(2, '0');
                const dia = String(dataHojeLocal.getDate()).padStart(2, '0');
                const dataHojeFormatada = `${ano}-${mes}-${dia}`;

                // Filtra os agendamentos deixando apenas os do dia de hoje
                let filaHoje = agendamentos.filter(a => a.data === dataHojeFormatada);

                // Ordena pelo horário (mais cedo para mais tarde)
                filaHoje.sort((a, b) => (a.hora > b.hora) ? 1 : -1);

                // Construtor do botão de seleção de status com cores dinâmicas
                const renderStatusOptions = (id, statusAtual) => {
                    const statuses = ['Agendado', 'Já chegou', 'Aguardando', 'Em atendimento', 'Finalizado'];
                    let options = statuses.map(s => `<option value="${s}" ${statusAtual === s ? 'selected' : ''}>${s}</option>`).join('');
                    
                    let cor = statusAtual === 'Finalizado' ? 'bg-green-100 text-green-800' : 
                              statusAtual === 'Em atendimento' ? 'bg-blue-100 text-blue-800' : 
                              statusAtual === 'Já chegou' ? 'bg-yellow-100 text-yellow-800' : 
                              statusAtual === 'Aguardando' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800';

                    return `<select onchange="atualizarStatusFila(${id}, this.value)" class="p-2 border rounded-lg text-sm font-bold cursor-pointer ${cor} outline-none">${options}</select>`;
                };

                // Monta as linhas da tabela html
                const trs = filaHoje.length > 0 ? filaHoje.map(a => {
                    const infoVet = (a.tipo === 'Consulta' || a.tipo === 'Retorno') && a.veterinario ? `<br><span class="text-xs text-blue-600 font-bold mt-1 inline-block">👨‍⚕️ ${a.veterinario}</span>` : '';
                    return `
                    <tr class="hover:bg-gray-50 transition-colors">
                        <td class="font-black text-blue-600 text-lg">${a.hora}</td>
                        <td class="font-bold text-gray-800">${a.cliente}</td>
                        <td class="font-semibold text-gray-600">🐶 ${a.pet}</td>
                        <td>
                            <span class="bg-gray-200 px-3 py-1 rounded-full text-xs font-bold text-gray-700 uppercase">${a.tipo}</span>
                            ${infoVet}
                        </td>
                        <td>${renderStatusOptions(a.id, a.status || 'Agendado')}</td>
                    </tr>
                `}).join('') : `<tr><td colspan="5" class="text-center text-gray-500 py-8 font-bold">Nenhum agendamento marcado para o dia de hoje.</td></tr>`;

                // Injeta na tela
                cont.innerHTML = `
                    <div class="card overflow-hidden">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-gray-50">
                                    <th class="p-4 border-b text-gray-500 uppercase text-xs font-black">Horário</th>
                                    <th class="p-4 border-b text-gray-500 uppercase text-xs font-black">Cliente</th>
                                    <th class="p-4 border-b text-gray-500 uppercase text-xs font-black">Pet</th>
                                    <th class="p-4 border-b text-gray-500 uppercase text-xs font-black">Tipo / Veterinário</th>
                                    <th class="p-4 border-b text-gray-500 uppercase text-xs font-black">Status do Paciente</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${trs}
                            </tbody>
                        </table>
                    </div>
                `;

                } else if(mod === 'clientes') {
                tit.innerText = "Clientes";

                cont.innerHTML = `
                    <div class="flex justify-between mb-4">
                        <input id="busca-cliente" onkeyup="filtrarClientes()" placeholder="Buscar por CPF, Nome do cliente ou Pet" class="input-pet w-1/2">
                        <button onclick="abrirModalCliente()" class="btn-principal px-4 py-2 rounded-lg">+ Novo Cliente</button>
                    </div>

                    <div class="card">
                        <table>
                            <thead><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Ações</th></tr></thead>
                            <tbody id="tabela-clientes-corpo">
                                <tr><td colspan="4" class="text-center text-gray-500">Carregando...</td></tr>
                            </tbody>
                        </table>
                    </div>
                `;
                carregarClientes();
            }
            else if(mod === 'pets') {
                tit.innerText = "Pets";

                cont.innerHTML = `
                    <div class="flex justify-between mb-4">
                        <input id="busca-pet" onkeyup="filtrarPets()" placeholder="Buscar por nome do pet ou raça" class="input-pet w-1/2">
                    </div>

                    <div class="card">
                        <table>
                            <thead><tr><th>Nome do Pet</th><th>Raça</th><th>Dono (Cliente)</th><th>Idade/Sexo</th></tr></thead>
                            <tbody id="tabela-pets-corpo">
                                <tr><td colspan="4" class="text-center text-gray-500">Carregando...</td></tr>
                            </tbody>
                        </table>
                    </div>
                `;
                carregarPets();
            }

           else if(mod === 'caixa') {
            tit.innerText = "Caixa";

            const hoje = formatDt(new Date());

            // Filtra as transações de hoje
            const hojeTransacoes = transacoes.filter(t => t.data === hoje);
            const faturamento = hojeTransacoes
                .filter(t => t.tipo === 'entrada')
                .reduce((a,b)=>a+b.valor, 0);

            // Gera as linhas da tabela com os lançamentos
            const linhasCaixa = hojeTransacoes.length > 0 
                ? hojeTransacoes.map(t => `
                    <tr class="border-b hover:bg-gray-50">
                        <td class="py-3 px-2">${t.desc}</td>
                        <td class="py-3 px-2">${t.metodo}</td>
                        <td class="py-3 px-2 font-bold text-right ${t.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}">
                            ${t.tipo === 'entrada' ? '+' : '-'} R$ ${t.valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}
                        </td>
                    </tr>
                `).join('') 
                : `<tr><td colspan="3" class="text-center py-6 text-gray-500 font-bold">Nenhum lançamento registrado hoje.</td></tr>`;

            cont.innerHTML = `
                <div class="flex justify-between items-center mb-4">
                    <button onclick="abrirModalTransacao()" class="btn-principal px-6 py-2 rounded-lg font-bold shadow">
                        + Novo Lançamento
                    </button>
                    <div class="bg-white px-6 py-2 rounded-lg shadow border border-gray-200">
                        <span class="text-gray-500 text-sm font-bold uppercase">Faturamento do dia:</span>
                        <span class="text-xl font-black text-green-600 ml-2">R$ ${faturamento.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                    </div>
                </div>

                <div class="card mb-4">
                    <h3 class="font-bold text-gray-800 mb-4 text-lg border-b pb-2">Lançamentos de Hoje</h3>
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-gray-100">
                                <th class="p-3 border-b text-xs text-gray-600 uppercase font-black rounded-tl-lg">Descrição</th>
                                <th class="p-3 border-b text-xs text-gray-600 uppercase font-black">Método</th>
                                <th class="p-3 border-b text-xs text-gray-600 uppercase font-black text-right rounded-tr-lg">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${linhasCaixa}
                        </tbody>
                    </table>
                </div>

                <div class="flex justify-end mt-4">
                    <button class="bg-red-500 hover:bg-red-600 transition text-white font-bold px-8 py-3 rounded-xl shadow" onclick="fecharCaixaDia()">
                        Fechar Caixa do Dia
                    </button>
                </div>
            `;
        }

            else if(mod === 'relatorios') {
                tit.innerText = "Relatórios da Recepção";

                // Pega a data de hoje formatada igual ao banco de dados (YYYY-MM-DD)
                const hoje = new Date();
                const dataHojeFormatada = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');
                
                // Calcula atendimentos com base nos dados do servidor
                const atendimentosHoje = agendamentos.filter(a => a.data === dataHojeFormatada).length;
                const totalAtendimentos = agendamentos.length;

                // Calcula faturamento e ticket médio conectando com o array de transações
                const entradas = transacoes.filter(t => t.tipo === 'entrada');
                const faturamentoTotal = entradas.reduce((acc, t) => acc + t.valor, 0);
                const ticketMedio = entradas.length > 0 ? (faturamentoTotal / entradas.length) : 0;

                // Calcula o número de clientes cadastrados
                let qtdClientes = window.clientesLista ? window.clientesLista.length : 0;

                // Mantém a sua lógica visual usando as classes do Tailwind
                cont.innerHTML = `
                    <div class="grid grid-cols-3 gap-6 mb-8">
                        <div class="card border-l-4 border-blue-500">
                            <p class="text-xs font-bold text-gray-400 uppercase">Atendimentos (Hoje)</p>
                            <h3 class="text-2xl font-black text-blue-600">${atendimentosHoje}</h3>
                            <p class="text-xs text-gray-500 mt-1">Total geral: ${totalAtendimentos}</p>
                        </div>
                        <div class="card border-l-4 border-green-500">
                            <p class="text-xs font-bold text-gray-400 uppercase">Faturamento Total</p>
                            <h3 class="text-2xl font-black text-green-600">R$ ${faturamentoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
                            <p class="text-xs text-gray-500 mt-1">Ticket Médio: R$ ${ticketMedio.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                        </div>
                        <div class="card border-l-4 border-purple-500">
                            <p class="text-xs font-bold text-gray-400 uppercase">Clientes Cadastrados</p>
                            <h3 class="text-2xl font-black text-purple-600">${qtdClientes}</h3>
                            <p class="text-xs text-gray-500 mt-1">Base de dados ativa</p>
                        </div>
                    </div>
                `;
                
                // Força o carregamento dos clientes via API se ainda não tiverem sido carregados na sessão atual da Recepção
                if (!window.clientesLista) {
                    fetch('/api/clientes/' + clinicaId)
                        .then(res => res.json())
                        .then(clientes => {
                            window.clientesLista = clientes;
                            navegarModulo('relatorios'); // Recarrega os números dinamicamente na tela
                        }).catch(e => console.error("Erro ao carregar clientes para o relatório", e));
                }
            }

            else if(mod === 'prontuario') {
                tit.innerText = "Prontuários Médicos";
                actions.innerHTML = `<button onclick="abrirModalProntuario()" class="btn-principal px-6 py-2 rounded-xl font-bold shadow">+ Prontuário Avulso</button>`;
                
                const meusProntuarios = prontuarios.filter(p => p.veterinario === clinicaLogada.nome);
                
                // --- PARTE DE IDENTIFICAÇÃO E VÍNCULO ---
                const hojeLocal = new Date();
                const dataHojeFormatada = hojeLocal.getFullYear() + '-' + String(hojeLocal.getMonth() + 1).padStart(2, '0') + '-' + String(hojeLocal.getDate()).padStart(2, '0');
                const pacientesHoje = agendamentos.filter(a => a.veterinario === clinicaLogada.nome && a.data === dataHojeFormatada && a.status !== 'Finalizado');

                let optionsAgendamentos = '<option value="">Selecione o paciente aguardando...</option>';
                pacientesHoje.forEach(a => {
                    optionsAgendamentos += `<option value="${a.id}" data-cliente="${a.cliente}" data-pet="${a.pet}">🕒 ${a.hora} - 🐾 ${a.pet} (Tutor: ${a.cliente})</option>`;
                });

                let htmlVinculo = `
                    <div class="card mb-6 border-l-4 border-purple-500 shadow-sm">
                        <h3 class="text-lg font-bold text-gray-800 mb-1">Identificação e Vínculo Rápido</h3>
                        <p class="text-xs text-gray-500 mb-4">Selecione o paciente do dia para iniciar o atendimento médico.</p>
                        <div class="flex gap-4 items-end">
                            <div class="flex-grow">
                                <select id="prontuario-vinculo-rapido" class="input-pet">
                                    ${optionsAgendamentos}
                                </select>
                            </div>
                            <button onclick="abrirModalProntuarioVinculado()" class="btn-principal px-6 py-2 rounded-xl font-bold h-[42px]">Iniciar Atendimento</button>
                        </div>
                    </div>
                `;
                // ----------------------------------------

                let htmlLista = meusProntuarios.length > 0 ? meusProntuarios.map(p => `
                    <div class="card mb-4 border-l-4 border-blue-500 shadow-sm">
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <h4 class="font-bold text-lg text-gray-800">🐾 ${p.pet} <span class="text-xs text-gray-500 font-normal ml-1">(Tutor: ${p.cliente})</span></h4>
                                <p class="text-xs text-gray-400 font-bold mt-1">DATA DO ATENDIMENTO: ${p.data}</p>
                            </div>
                            <span class="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1 rounded-full text-xs font-black">PESO: ${p.peso || 'N/A'} kg</span>
                        </div>
                        <div class="grid grid-cols-2 gap-4 mt-3">
                            <div class="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <p class="text-xs font-black text-gray-500 uppercase mb-1">Sintomas / Queixa</p>
                                <p class="text-sm text-gray-700">${p.sintomas || 'Não relatado'}</p>
                            </div>
                            <div class="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <p class="text-xs font-black text-gray-500 uppercase mb-1">Diagnóstico Clínico</p>
                                <p class="text-sm text-gray-700">${p.diagnostico || 'Sem diagnóstico formal'}</p>
                            </div>
                        </div>
                        <div class="bg-blue-50 p-3 rounded-lg mt-3 border border-blue-100">
                            <p class="text-xs font-black text-blue-800 uppercase mb-1">Prescrição Médica (Receita)</p>
                            <p class="text-sm text-blue-900 whitespace-pre-wrap font-semibold">${p.prescricao || '-'}</p>
                        </div>
                    </div>
                `).join('') : '<div class="text-center py-12"><p class="text-gray-400 font-bold text-lg">Nenhum histórico de prontuário registrado.</p></div>';

                cont.innerHTML = `<div class="max-w-4xl mx-auto">${htmlVinculo} <h3 class="font-bold text-gray-700 mb-4 text-lg border-b pb-2">Histórico de Prontuários</h3> ${htmlLista}</div>`;
            }
        }

        async function carregarAuditoria() {
            try {
                const res = await fetch(`/api/auditoria/${clinicaId}`);
                if (res.ok) {
                    const logs = await res.json();
                    let html = logs.map(a => `
                        <tr>
                            <td class="text-xs text-gray-500">${a.data_hora}</td>
                            <td class="font-bold text-blue-800">${a.usuario}</td>
                            <td class="text-gray-700">${a.acao}</td>
                        </tr>
                    `).join('');
                    
                    if (!html) html = `<tr><td colspan="3" class="text-center py-6 text-gray-400 italic">Nenhum registro de auditoria efetuado ainda.</td></tr>`;
                    
                    document.getElementById('conteudo-dinamico').innerHTML = `
                        <div class="card">
                            <table>
                                <thead><tr><th>Data/Hora</th><th>Usuário Responsável</th><th>Ação Realizada</th></tr></thead>
                                <tbody>${html}</tbody>
                            </table>
                        </div>
                    `;
                }
            } catch (e) {
                document.getElementById('conteudo-dinamico').innerHTML = `<p class="text-red-500 font-bold">Erro ao carregar logs.</p>`;
            }
        }

        function renderEquipe(lista) {
            if (lista.length === 0) return `<tr><td colspan="6" class="text-center py-4 text-gray-400 italic">Nenhum colaborador encontrado.</td></tr>`;
            return lista.map(u => `
                <tr>
                    <td class="font-bold">${u.nome}<br><span class="text-xs text-gray-400 font-normal">${u.cpf || 'Não informado'}</span></td>
                    <td class="uppercase text-xs font-bold">${u.cargo}</td>
                    <td>${u.email || '-'}</td>
                    <td>
                        <span onclick="alternarStatus(${u.id})" class="status-badge ${u.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}" title="Clique para mudar">
                            ${u.status || 'Ativo'} 
                        </span>
                    </td>
                    <td class="text-gray-400 text-xs">${u.ultimoAcesso || '-'}</td>
                    <td><button onclick="abrirModalColaborador(${u.id})" class="text-blue-500 font-bold underline hover:text-blue-700">Editar</button></td>
                </tr>
            `).join('');
        }

        function filtrarEquipe() {
            const q = document.getElementById('busca-equipe').value.toLowerCase();
            const filtrados = equipe.filter(u => 
                u.nome.toLowerCase().includes(q) || 
                (u.cpf && u.cpf.replace(/\D/g,'').includes(q.replace(/\D/g,'')))
            );
            document.getElementById('tabela-equipe-corpo').innerHTML = renderEquipe(filtrados);
        }

        async function alternarStatus(id) {
            const idx = equipe.findIndex(e => e.id === id);
            const novoStatus = equipe[idx].status === 'Ativo' ? 'Inativo' : 'Ativo';
            
            try {
                const res = await fetch(`/api/colaborador/${id}/status`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ status: novoStatus })
                });
                
                if(res.ok) {
                    equipe[idx].status = novoStatus;
                    filtrarEquipe();
                }
            } catch (error) {
                mostrarPopup('Erro', 'Não foi possível alterar o status no banco de dados.');
            }
        }

        function abrirModalColaborador(editId = null) {
            const u = editId ? equipe.find(x => x.id === editId) : null;
            document.getElementById('modal-titulo').innerText = editId ? "Editar Colaborador" : "Novo Colaborador";
            
            document.getElementById('modal-body').innerHTML = `
                <div class="space-y-4">
                    <div>
                        <label class="text-xs font-bold text-gray-500 mb-1 block">Nome Completo</label>
                        <input id="new-colab-nome" value="${u?.nome || ''}" placeholder="Ex: João da Silva" class="input-pet">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-xs font-bold text-gray-500 mb-1 block">CPF</label>
                            <input id="new-colab-cpf" value="${u?.cpf || ''}" onkeyup="mascaraCPF(this)" placeholder="000.000.000-00" class="input-pet">
                        </div>
                        <div>
                            <label class="text-xs font-bold text-gray-500 mb-1 block">Cargo</label>
                            <select id="new-colab-cargo" class="input-pet" onchange="document.getElementById('edit-colab-esp-container').style.display = this.value === 'Veterinário' ? 'block' : 'none'">
                                <option value="Administrador" ${u?.cargo === 'Administrador' ? 'selected' : ''}>Administrador</option>
                                <option value="Veterinário" ${u?.cargo === 'Veterinário' ? 'selected' : ''}>Veterinário</option>
                                <option value="Recepção" ${u?.cargo === 'Recepção' ? 'selected' : ''}>Recepção</option>
                            </select>
                        </div>
                    </div>
                    <div id="edit-colab-esp-container" style="display: ${u?.cargo === 'Veterinário' ? 'block' : 'none'};">
                <label class="text-xs font-bold text-gray-500 mb-1 block">Especialidade (Apenas Veterinários)</label>
                <select id="new-colab-especialidade" class="input-pet">
                    <option value="Clínica Geral" ${u?.especialidade === 'Clínica Geral' ? 'selected' : ''}>Clínica Geral</option>
                    <option value="Cardiologia" ${u?.especialidade === 'Cardiologia' ? 'selected' : ''}>Cardiologia</option>
                </select>
            </div>
            
            <!-- INÍCIO DA CORREÇÃO: Adicionando o campo de E-mail -->
            <div>
                <label class="text-xs font-bold text-gray-500 mb-1 block">E-mail de Acesso *</label>
                <input id="new-colab-email" type="email" value="${u?.email || ''}" placeholder="Ex: email@clinica.com" class="input-pet">
            </div>
            <!-- FIM DA CORREÇÃO -->

            ${!u ? `
            <div>
                <label class="text-xs font-bold text-gray-500 mb-1 block">Senha Provisória</label>
                        <input id="new-colab-senha" type="password" placeholder="••••••••" class="input-pet">
                    </div>` : ''}
                </div>
            `;

           document.getElementById('modal-confirmar').onclick = async () => {
                const cargoSelecionado = document.getElementById('new-colab-cargo').value;
                const especialidadeSelecionada = cargoSelecionado === 'Veterinário' ? document.getElementById('new-colab-especialidade').value : null;

                const dados = {
                    nome: document.getElementById('new-colab-nome').value,
                    cpf: document.getElementById('new-colab-cpf').value,
                    cargo: cargoSelecionado,
                    email: document.getElementById('new-colab-email').value,
                    especialidade: especialidadeSelecionada
                };

                if (!dados.nome || !dados.cpf || !dados.email) return mostrarPopup('⚠️', 'Preencha nome, CPF e email.');

                try {
                    if(editId) {
                        const res = await fetch(`/api/colaborador/${editId}`, {
                            method: 'PUT',
                            headers: getAuthHeaders(),
                            body: JSON.stringify(dados)
                        });
                        if (res.ok) {
                            Object.assign(u, dados);
                            mostrarPopup('✅ Sucesso', 'Colaborador atualizado!');
                        } else {
                            mostrarPopup('❌ Erro', 'Falha ao atualizar colaborador.');
                        }
                    } else {
                        const senha = document.getElementById('new-colab-senha').value;
                        if (!senha) return mostrarPopup('⚠️', 'Defina uma senha.');
                        
                        const res = await fetch('/api/colaborador', {
                            method: 'POST',
                            headers: getAuthHeaders(),
                            body: JSON.stringify({ ...dados, senha, clinica_id: clinicaId })
                        });

                        const result = await res.json();
                        if (res.ok) {
                            equipe.push({ id: result.id, ...dados, status: 'Ativo', ultimoAcesso: 'Nunca' });
                            mostrarPopup('✅ Sucesso', `Cadastrado com sucesso!`);
                        } else {
                            return mostrarPopup('❌ Erro', result.error);
                        }
                    }
                    
                    fecharModal();
                    navegarModulo('equipe');
                } catch (error) {
                    mostrarPopup('🔌 Erro', 'Erro de conexão.');
                }
            };
            document.getElementById('modal-container').style.display = 'flex';
        }

        function mudarFiltroPeriodo(valor) {
            filtroPeriodo = valor;
            atualizarDOMFinanceiro(document.getElementById('conteudo-dinamico'));
        }

        function getTransacoesFiltradas() {
            const hoje = new Date();
            const anoAtual = hoje.getFullYear();

            return transacoes.filter(t => {
                const [dia, mes] = t.data.split('/');
                const dataT = new Date(anoAtual, parseInt(mes) - 1, parseInt(dia));

                if (filtroPeriodo === 'Hoje') {
                    return dataT.getDate() === hoje.getDate() && dataT.getMonth() === hoje.getMonth();
                } else if (filtroPeriodo === 'Últimos 7 dias') {
                    const seteDiasAtras = new Date();
                    seteDiasAtras.setDate(hoje.getDate() - 7);
                    return dataT >= seteDiasAtras && dataT <= hoje;
                } else {
                    return dataT.getMonth() === hoje.getMonth();
                }
            });
        }

        function atualizarDOMFinanceiro(container) {
            const trFiltradas = getTransacoesFiltradas();

            let faturamento = trFiltradas.filter(t=>t.tipo==='entrada').reduce((a,b)=>a+b.valor, 0);
            let despesas = trFiltradas.filter(t=>t.tipo==='saida').reduce((a,b)=>a+b.valor, 0);
            let lucro = faturamento - despesas;

            let transacoesHTML = trFiltradas.length === 0 
                ? `<tr><td colspan="6" class="text-center text-gray-400 italic py-4">Nenhuma transação no período selecionado.</td></tr>` 
                : trFiltradas.map(t => `
                <tr>
                    <td>${t.data}</td>
                    <td class="font-bold text-gray-700">${t.desc}</td>
                    <td>${t.cat}</td>
                    <td class="text-xs text-gray-500">${t.metodo}</td>
                    <td class="font-bold text-right ${t.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}">
                        ${t.tipo === 'entrada' ? '+' : '-'} R$ ${t.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </td>
                    <td class="text-right no-print">
                        <button onclick="abrirModalTransacao(${t.id})" class="text-blue-500 hover:text-blue-700 mr-2 text-lg" title="Editar">✏️</button>
                        <button onclick="deletarTransacao(${t.id})" class="text-red-500 hover:text-red-700 text-lg" title="Apagar">🗑️</button>
                    </td>
                </tr>
            `).join('');

            container.innerHTML = `
                <div class="grid grid-cols-3 gap-6 mb-8">
                    <div class="card border-l-4 border-green-500"><p class="text-xs font-bold text-gray-400 uppercase">Faturado (${filtroPeriodo})</p><h3 class="text-2xl font-black">R$ ${faturamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3></div>
                    <div class="card border-l-4 border-red-500"><p class="text-xs font-bold text-gray-400 uppercase">Despesas (${filtroPeriodo})</p><h3 class="text-2xl font-black">R$ ${despesas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3></div>
                    <div class="card border-l-4 border-blue-500"><p class="text-xs font-bold text-gray-400 uppercase">Lucro (${filtroPeriodo})</p><h3 class="text-2xl font-black text-blue-600">R$ ${lucro.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3></div>
                </div>
                <div class="card">
                    <h4 class="font-bold mb-4">Relatório de Transações</h4>
                    <table>
                        <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Método</th><th class="text-right">Valor</th><th class="text-right no-print">Ações</th></tr></thead>
                        <tbody>${transacoesHTML}</tbody>
                    </table>
                </div>
            `;
        }

        async function deletarTransacao(id) {
            if(confirm("Deseja realmente apagar esta transação?")) {
                try {
                    const res = await fetch(`/api/transacoes/${id}`, { 
                        method: 'DELETE',
                        headers: {'X-Clinic-Id': clinicaId, 'X-Usuario-Nome': clinicaLogada.nome}
                    });
                    if(res.ok) {
                        transacoes = transacoes.filter(t => t.id !== id);
                        atualizarDOMFinanceiro(document.getElementById('conteudo-dinamico'));
                    }
                } catch(error) {
                    mostrarPopup('Erro', 'Erro ao deletar transação.');
                }
            }
        }

        function atualizarEstiloBotaoTransacao() {
            const tipo = document.getElementById('new-trans-tipo').value;
            const btn = document.getElementById('modal-confirmar');
            if(tipo === 'saida') {
                btn.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
                btn.innerText = 'Registrar Despesa';
            } else {
                btn.style.background = 'linear-gradient(90deg, #10b981, #3b82f6)';
                btn.innerText = 'Salvar Receita';
            }
        }

        function abrirModalTransacao(editId = null) {
            let t = null;
            if(editId) t = transacoes.find(x => x.id === editId);

            const hoje = new Date().toISOString().split('T')[0];
            document.getElementById('modal-titulo').innerText = editId ? "Editar Transação" : "Nova Transação";
            
            document.getElementById('modal-body').innerHTML = `
                <input id="new-trans-desc" placeholder="Descrição da Transação" class="input-pet mb-4" required>
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="text-xs font-bold text-gray-500 mb-1 block">Valor</label>
                        <input id="new-trans-val" type="text" placeholder="R$ 0,00" class="input-pet font-bold text-lg" onkeyup="mascaraMoeda(this)" required>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-500 mb-1 block">Data</label>
                        <input id="new-trans-data" type="date" value="${hoje}" class="input-pet" required>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="text-xs font-bold text-gray-500 mb-1 block">Tipo</label>
                        <select id="new-trans-tipo" class="input-pet" onchange="atualizarEstiloBotaoTransacao()">
                            <option value="entrada">Entrada (Receita)</option>
                            <option value="saida">Saída (Despesa)</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-500 mb-1 block">Categoria</label>
                        <select id="new-trans-cat" class="input-pet">
                            <option value="Serviços">Serviços</option>
                            <option value="Venda de Produtos">Venda de Produtos</option>
                            <option value="Medicamentos">Medicamentos</option>
                            <option value="Aluguel">Aluguel</option>
                            <option value="Salários">Salários</option>
                            <option value="Impostos">Impostos</option>
                            <option value="Outros">Outros</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label class="text-xs font-bold text-gray-500 mb-1 block">Método</label>
                    <select id="new-trans-metodo" class="input-pet">
                        <option value="Pix">Pix</option>
                        <option value="Cartão de Crédito">Cartão de Crédito</option>
                        <option value="Cartão de Débito">Cartão de Débito</option>
                        <option value="Dinheiro">Dinheiro</option>
                    </select>
                </div>
            `;

            if(t) {
                document.getElementById('new-trans-desc').value = t.desc;
                document.getElementById('new-trans-tipo').value = t.tipo;
                document.getElementById('new-trans-cat').value = t.cat;
                document.getElementById('new-trans-metodo').value = t.metodo;
                
                const [d, m] = t.data.split('/');
                const yyyy = new Date().getFullYear();
                document.getElementById('new-trans-data').value = `${yyyy}-${m}-${d}`;
                
                const inputVal = document.getElementById('new-trans-val');
                inputVal.value = (t.valor * 100).toString();
                mascaraMoeda(inputVal);
            }

            atualizarEstiloBotaoTransacao();

            document.getElementById('modal-confirmar').onclick = async () => {
                let valInput = document.getElementById('new-trans-val').value;
                if(!valInput) return alert("Preencha o valor!");
                
                let numLimpo = valInput.replace(/\D/g, ''); 
                let valorFloat = parseFloat(numLimpo) / 100;

                const dateParts = document.getElementById('new-trans-data').value.split('-');
                const dataFormatada = `${dateParts[2]}/${dateParts[1]}`;

                const payload = {
                    clinic_id: clinicaId,
                    data: dataFormatada,
                    descricao: document.getElementById('new-trans-desc').value,
                    categoria: document.getElementById('new-trans-cat').value,
                    valor: valorFloat,
                    tipo: document.getElementById('new-trans-tipo').value,
                    metodo: document.getElementById('new-trans-metodo').value
                };

                try {
                    let res;
                    if(editId) {
                        res = await fetch(`/api/transacoes/${editId}`, {
                            method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(payload)
                        });
                    } else {
                        res = await fetch(`/api/transacoes`, {
                            method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload)
                        });
                    }
                    
                    if (res.ok) {
                        // Busca os dados novos do servidor imediatamente após o sucesso
                        const resAtualizada = await fetch(`/api/transacoes/${clinicaId}`);
                        transacoes = await resAtualizada.json();
                        
                        fecharModal();
                        
                        // Atualiza a tela correspondente de forma inteligente
                        if (document.getElementById('modulo-titulo').innerText === 'Caixa') {
                            navegarModulo('caixa');
                        } else if (clinicaLogada.role === 'Recepção') {
                            navegarModulo('recepcao-dashboard'); 
                        } else {
                            atualizarDOMFinanceiro(document.getElementById('conteudo-dinamico'));
                        }
                    } else {
                        mostrarPopup('Erro', 'Falha ao processar a transação no servidor.');
                    }
                } catch(error) {
                    mostrarPopup('Erro', 'Não foi possível salvar a transação. Verifique a conexão.');
                }
            };
            document.getElementById('modal-container').style.display = 'flex';
        }

        function renderEstoque() {
            if(estoque.length === 0) return `<tr><td colspan="5" class="text-center py-4 text-gray-400">Nenhum item no estoque.</td></tr>`;
            return estoque.map((p, i) => `
                <tr>
                    <td class="font-bold">${p.nome}</td>
                    <td class="text-xs text-gray-400">${p.lote}</td>
                    <td>${p.val}</td>
                    <td class="font-black text-lg ${p.qtd < 5 ? 'text-red-500' : 'text-green-600'}">${p.qtd}</td>
                    <td class="text-right">
                        <button onclick="ajustarEstoque(${i}, -1)" class="bg-gray-200 px-3 py-1 rounded font-bold text-gray-700" title="Diminuir">-</button>
                        <button onclick="ajustarEstoque(${i}, 1)" class="bg-gray-200 px-3 py-1 rounded font-bold ml-1 text-gray-700" title="Aumentar">+</button>
                        <button onclick="deletarItemEstoque(${p.id})" class="text-red-500 hover:text-red-700 ml-4 text-lg align-middle" title="Apagar Item">🗑️</button>
                    </td>
                </tr>
            `).join('');
        }

        async function ajustarEstoque(idx, qtd) {
            const item = estoque[idx];
            if(item.qtd + qtd >= 0) {
                try {
                    const novaQtd = item.qtd + qtd;
                    const res = await fetch(`/api/estoque/${item.id}/ajustar`, {
                        method: 'PUT',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ qtd: novaQtd })
                    });

                    if(res.ok) {
                        estoque[idx].qtd = novaQtd;
                        document.getElementById('tabela-estoque-corpo').innerHTML = renderEstoque();
                    }
                } catch (error) {
                    mostrarPopup('Erro', 'Não foi possível atualizar o estoque.');
                }
            }
        }

        async function deletarItemEstoque(id) {
            if(confirm("Deseja realmente excluir este item do estoque?")) {
                try {
                    const res = await fetch(`/api/estoque/${id}`, { 
                        method: 'DELETE',
                        headers: {'X-Clinic-Id': clinicaId, 'X-Usuario-Nome': clinicaLogada.nome} 
                    });
                    if(res.ok) {
                        estoque = estoque.filter(e => e.id !== id);
                        document.getElementById('tabela-estoque-corpo').innerHTML = renderEstoque();
                        mostrarPopup('✅ Sucesso', 'Item removido do estoque.');
                    } else {
                        mostrarPopup('❌ Erro', 'Não foi possível excluir o item.');
                    }
                } catch(error) {
                    mostrarPopup('🔌 Erro', 'Erro de conexão com o servidor.');
                }
            }
        }

        function abrirModalEstoque() { 
            document.getElementById('modal-titulo').innerText = "Novo Item no Estoque";
            
            document.getElementById('modal-body').innerHTML = `
                <div class="space-y-4">
                    <div>
                        <label class="text-xs font-bold text-gray-500 mb-1 block">Nome do Produto *</label>
                        <input id="new-est-nome" placeholder="Ex: Vacina V10" class="input-pet" required>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-xs font-bold text-gray-500 mb-1 block">Lote *</label>
                            <input id="new-est-lote" placeholder="Ex: L-1234" class="input-pet" required>
                        </div>
                        <div>
                            <label class="text-xs font-bold text-gray-500 mb-1 block">Validade *</label>
                            <input id="new-est-val" placeholder="MM/AAAA" class="input-pet" required>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-xs font-bold text-gray-500 mb-1 block">Quantidade Inicial *</label>
                            <input id="new-est-qtd" type="number" placeholder="0" class="input-pet" required>
                        </div>
                        <div>
                            <label class="text-xs font-bold text-gray-500 mb-1 block">Custo de Aquisição (R$)</label>
                            <input id="new-est-valor" type="text" placeholder="R$ 0,00" class="input-pet" onkeyup="mascaraMoeda(this)">
                        </div>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-500 mb-1 block">Fornecedor</label>
                        <input id="new-est-fornecedor" placeholder="Nome da empresa fornecedora" class="input-pet">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-500 mb-1 block">Descrição Adicional</label>
                        <textarea id="new-est-desc" placeholder="Detalhes sobre o produto..." class="input-pet" rows="2"></textarea>
                    </div>
                    
                    <div class="flex items-center gap-2 mt-4 bg-blue-50 p-4 rounded-xl border border-blue-200">
                        <input type="checkbox" id="new-est-transacao" class="w-5 h-5 cursor-pointer accent-blue-600">
                        <label for="new-est-transacao" class="text-sm font-bold text-blue-800 cursor-pointer">
                            Gerar despesa no financeiro automaticamente?
                        </label>
                    </div>
                </div>
            `;

            document.getElementById('modal-confirmar').onclick = async () => {
                const nome = document.getElementById('new-est-nome').value.trim();
                const lote = document.getElementById('new-est-lote').value.trim();
                const val = document.getElementById('new-est-val').value.trim();
                const qtd = parseInt(document.getElementById('new-est-qtd').value || 0);
                const fornecedor = document.getElementById('new-est-fornecedor').value.trim();
                const descricao = document.getElementById('new-est-desc').value.trim();

                let valInput = document.getElementById('new-est-valor').value;
                let numLimpo = valInput.replace(/\D/g, ''); 
                let valorFloat = numLimpo ? parseFloat(numLimpo) / 100 : 0;

                const gerarTransacao = document.getElementById('new-est-transacao').checked;

                if (!nome || !lote || !val || isNaN(qtd)) {
                    return mostrarPopup('⚠️ Atenção', 'Preencha os campos obrigatórios (*).');
                }

                if (gerarTransacao && valorFloat === 0) {
                    return mostrarPopup('⚠️ Atenção', 'Para gerar uma transação financeira, o Custo de Aquisição deve ser maior que zero.');
                }

                const payload = {
                    clinic_id: clinicaId,
                    nome, lote, val, qtd, fornecedor, descricao, valor: valorFloat, gerarTransacao
                };

                try {
                    const res = await fetch('/api/estoque', {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify(payload)
                    });
                    
                    if (res.ok) {
                        const estRes = await fetch(`/api/estoque/${clinicaId}`);
                        estoque = await estRes.json();
                        
                        if (gerarTransacao) {
                            const transRes = await fetch(`/api/transacoes/${clinicaId}`);
                            transacoes = await transRes.json();
                        }

                        fecharModal();
                        document.getElementById('tabela-estoque-corpo').innerHTML = renderEstoque();
                        mostrarPopup('✅ Sucesso', 'Item adicionado ao estoque!');
                    } else {
                        mostrarPopup('❌ Erro', 'Falha ao salvar o item.');
                    }
                } catch (error) {
                    mostrarPopup('🔌 Erro', 'Verifique a conexão com o servidor.');
                }
            };
            
            document.getElementById('modal-container').style.display = 'flex';
        }

        function fecharModal() { 
            const btn = document.getElementById('modal-confirmar');
            btn.style.background = ''; 
            btn.innerText = 'Salvar';
            document.getElementById('modal-container').style.display = 'none'; 
        }

        function mostrarPopup(titulo, mensagem) {
            document.getElementById('popup-titulo').innerText = titulo;
            document.getElementById('popup-mensagem').innerText = mensagem;
            document.getElementById('popup-container').style.display = 'flex';
        }

        function fecharPopup() {
            document.getElementById('popup-container').style.display = 'none';
        }

        function validarEtapa1() {
            const nome = document.getElementById('clinica-nome').value.trim();
            const cnpj = document.getElementById('clinica-cnpj').value.trim();
            const telefone = document.getElementById('clinica-telefone').value.trim();
            const email = document.getElementById('clinica-email').value.trim();
            const senha = document.getElementById('clinica-senha').value.trim();

            if (!nome || !cnpj || !telefone || !email || !senha) return mostrarPopup('⚠️', 'Preencha os campos.');
            if (senha.length < 6) return mostrarPopup('⚠️', 'A senha deve ter no mínimo 6 caracteres.');
            
            dadosClinica = { nome, cnpj, telefone, email, senha };
            
            document.getElementById('etapa-1').classList.add('hidden');
            document.getElementById('etapa-2').classList.remove('hidden');
            renderizarColaboradores();
        }

        function renderizarColaboradores() {
            const container = document.getElementById('colaboradores-lista');
            let formNovo = `
                <div class="bg-white border border-gray-200 p-4 rounded-lg mt-4">
                    <h4 class="font-bold mb-4 text-gray-800">Adicionar Colaborador</h4>
                    <div class="space-y-3">
                        <input id="novo-colab-nome" placeholder="Ex: João da Silva" class="input-pet mb-2">
                        <div class="grid grid-cols-2 gap-3 mb-2">
                            <input id="novo-colab-cpf" onkeyup="mascaraCPF(this)" placeholder="CPF" class="input-pet">
                            <select id="novo-colab-cargo" class="input-pet" onchange="document.getElementById('novo-colab-esp-container').style.display = this.value === 'Veterinário' ? 'block' : 'none'">
                                <option value="">Cargo...</option><option value="Veterinário">Veterinário</option><option value="Recepção">Recepção</option><option value="Administrador">Administrador</option>
                            </select>
                        </div>
                        <div id="novo-colab-esp-container" style="display: none;" class="mb-2">
                            <select id="novo-colab-especialidade" class="input-pet">
                                <option value="">Selecione a Especialidade...</option>
                                <option value="Clínica Geral">Clínica Geral</option>
                                <option value="Cardiologia">Cardiologia</option>
                            </select>
                        </div>
                        <input id="novo-colab-email" type="email" placeholder="E-mail" class="input-pet mb-2">
                        <button onclick="adicionarColaboradorForm()" class="w-full btn-principal py-3 rounded-xl font-bold">+ Adicionar Colaborador</button>
                    </div>
                </div>`;

            if (colaboradoresCheckout.length === 0) {
                container.innerHTML = '<div class="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4"><p class="text-gray-400 text-center">Nenhum colaborador adicionado ainda.</p></div>' + formNovo;
            } else {
                let listaHtml = colaboradoresCheckout.map((colab, index) => `
                    <div class="bg-gray-50 p-4 rounded-lg border mb-3 flex justify-between items-start">
                        <div><p class="font-bold">${colab.nome}</p><p class="text-sm text-gray-600">${colab.cargo} - ${colab.email}</p></div>
                        <button onclick="removerColaborador(${index})" class="text-red-500 font-bold hover:text-red-700">Remover</button>
                    </div>
                `).join('');
                container.innerHTML = listaHtml + formNovo;
            }
        }

        function adicionarColaboradorForm() {
            const nome = document.getElementById('novo-colab-nome').value.trim();
            const cpf = document.getElementById('novo-colab-cpf').value.trim();
            const cargo = document.getElementById('novo-colab-cargo').value.trim();
            const email = document.getElementById('novo-colab-email').value.trim();
            const especialidade = cargo === 'Veterinário' ? document.getElementById('novo-colab-especialidade').value : null;

            if (!nome || !cpf || !cargo || !email) return mostrarPopup('⚠️', 'Preencha os dados.');
            if (cargo === 'Veterinário' && !especialidade) return mostrarPopup('⚠️', 'Preencha a especialidade do veterinário.');
            
            colaboradoresCheckout.push({ nome, cpf, cargo, email, especialidade });
            renderizarColaboradores();
        }

        function removerColaborador(index) {
            colaboradoresCheckout.splice(index, 1);
            renderizarColaboradores();
        }

        function validarEtapa2() {
            document.getElementById('etapa-2').classList.add('hidden');
            document.getElementById('etapa-3').classList.remove('hidden');
            document.getElementById('resumo-plano').innerText = planoSelecionado.nome;
            document.getElementById('resumo-total').innerText = 'R$ ' + planoSelecionado.preco + '/mês';
        }

        function voltarEtapa2() { document.getElementById('etapa-2').classList.add('hidden'); document.getElementById('etapa-1').classList.remove('hidden'); }
        function voltarEtapa3() { document.getElementById('etapa-3').classList.add('hidden'); document.getElementById('etapa-2').classList.remove('hidden'); }

        async function finalizarCadastro() {
            try {
                const response = await fetch('/api/assinatura-completa', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        clinica: {
                            nome: dadosClinica.nome,
                            cnpj: dadosClinica.cnpj,
                            telefone: dadosClinica.telefone,
                            emailAdmin: dadosClinica.email,
                            senhaAdmin: dadosClinica.senha
                        },
                        colaboradores: colaboradoresCheckout
                    })
                });

                const result = await response.json();

                if (response.ok) {
                    mostrarPopup('✅ Cadastro Concluído', 'Cadastro realizado com sucesso! Faça seu login para começar.');
                    planoSelecionado = { nome: '', preco: 0 };
                    dadosClinica = {};
                    colaboradoresCheckout = [];
                    irPara('tela-login');
                } else {
                    mostrarPopup('❌ Erro no Cadastro', result.error || 'Erro ao processar cadastro.');
                }
            } catch (error) {
                mostrarPopup('🔌 Erro', 'Verifique se o servidor está rodando na porta 8080.');
            }
        }
        function atualizarLogoSidebar() {
            const container = document.getElementById('clinica-logo-container');
            container.innerHTML = '🐾 Mundo Pet';
        }

        async function salvarConfiguracoesClinica() {
            const novoNome = document.getElementById('config-nome-clinica').value;
            const novoCNPJ = document.getElementById('config-cnpj-clinica').value;
            const novoTelefone = document.getElementById('config-telefone-clinica').value;
            const novoEndereco = document.getElementById('config-endereco-clinica').value;
            const novoEmail = document.getElementById('config-email-contato').value;
            
            const novasCategorias = document.getElementById('config-categorias-prontuario-hidden').value;
            const novosAnimais = document.getElementById('config-tipos-animais-hidden').value;
            const novosCargos = document.getElementById('config-cargos-hidden').value;

            try {
                // Rota corrigida para o singular, igualzinho ao seu script.js
                const res = await fetch(`/api/clinica/${clinicaLogada.id}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ 
                        nome: novoNome, 
                        cnpj: novoCNPJ, 
                        telefone: novoTelefone, 
                        endereco: novoEndereco, 
                        email_contato: novoEmail, 
                    })
                });

                if (res.ok) {
                    clinicaLogada.nomeClinica = novoNome;
                    clinicaLogada.categorias_prontuario = novasCategorias;
                    clinicaLogada.tipos_animais = novosAnimais;
                    clinicaLogada.cargos = novosCargos;

                    document.getElementById('clinica-tag').innerText = novoNome;
                    if(typeof atualizarLogoSidebar === 'function') atualizarLogoSidebar();
                    mostrarPopup('✅ Sucesso', 'Configurações da clínica atualizadas!');
                } else {
                    mostrarPopup('❌ Erro', 'Não foi possível atualizar a clínica.');
                }
            } catch(e) {
                mostrarPopup('❌ Erro', 'Falha na conexão com o servidor.');
            }
        }
        
        async function salvarNovaSenha() {
            const novaSenha = document.getElementById('config-nova-senha').value;
            if (!novaSenha || novaSenha.length < 6) {
                return mostrarPopup('⚠️ Atenção', 'A senha deve ter pelo menos 6 caracteres.');
            }

            try {
                const res = await fetch(`/api/usuario/senha`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ email: clinicaLogada.email, senha: novaSenha })
                });

                if (res.ok) {
                    document.getElementById('config-nova-senha').value = '';
                    mostrarPopup('✅ Sucesso', 'Senha alterada com sucesso!');
                } else {
                    mostrarPopup('❌ Erro', 'Não foi possível alterar a senha.');
                }
            } catch(e) {
                mostrarPopup('❌ Erro', 'Falha na conexão com o servidor.');
            }
        }

        function inicializarSelect(selectId, valoresString) {
            const select = document.getElementById(selectId);
            if (!select) return;
            select.innerHTML = '';
            if (valoresString) {
                const valores = valoresString.split(',').map(v => v.trim()).filter(v => v);
                valores.forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = v;
                    opt.innerText = v;
                    select.appendChild(opt);
                });
            }
        }

        function adicionarOpcao(inputId, selectId, hiddenId) {
            const input = document.getElementById(inputId);
            const select = document.getElementById(selectId);
            const valor = input.value.trim();
            if (valor) {
                let existe = false;
                for (let i = 0; i < select.options.length; i++) {
                    if (select.options[i].value.toLowerCase() === valor.toLowerCase()) existe = true;
                }
                if (!existe) {
                    const opt = document.createElement('option');
                    opt.value = valor;
                    opt.innerText = valor;
                    select.appendChild(opt);
                    atualizarHidden(selectId, hiddenId);
                    input.value = '';
                } else {
                    mostrarPopup('⚠️ Atenção', 'Esta opção já existe na lista.');
                }
            }
        }

        function removerOpcao(selectId, hiddenId) {
            const select = document.getElementById(selectId);
            if (select.selectedIndex !== -1) {
                select.remove(select.selectedIndex);
                atualizarHidden(selectId, hiddenId);
            }
        }

        function atualizarHidden(selectId, hiddenId) {
            const select = document.getElementById(selectId);
            const valores = [];
            for (let i = 0; i < select.options.length; i++) {
                valores.push(select.options[i].value);
            }
            document.getElementById(hiddenId).value = valores.join(', ');
        }

        function logout() {
            clinicaLogada = null;
            clinicaId = null;
            location.reload();
        }

        function abrirModalAgendamento() {
    document.getElementById('modal-titulo').innerText = "Novo Agendamento";
    document.getElementById('modal-body').innerHTML = `
        <div class="space-y-4">
            <div>
                <label class="text-xs font-bold text-gray-500 mb-1 block">Nome do Cliente *</label>
                <select id="agenda-cliente" class="input-pet">
                    <option value="">Coloque o nome do cliente</option>
                </select>
            </div>
            <div>
                <label class="text-xs font-bold text-gray-500 mb-1 block">Nome do Pet *</label>
                <input id="agenda-pet" placeholder="Selecione o cliente primeiro" class="input-pet bg-gray-100 cursor-not-allowed" required disabled>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-xs font-bold text-gray-500 mb-1 block">Data *</label>
                    <input id="agenda-data" type="date" class="input-pet" required oninput="window.atualizarHorarios(this.value)">
                </div>
                <div>
                    <label class="text-xs font-bold text-gray-500 mb-1 block">Hora *</label>
                    <select id="agenda-hora" class="input-pet" required disabled>
                        <option value="">Selecione a data primeiro...</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="text-xs font-bold text-gray-500 mb-1 block">Tipo de Atendimento</label>
                <select id="agenda-tipo" class="input-pet" onchange="
                    const mostrar = (this.value === 'Consulta' || this.value === 'Retorno');
                    document.getElementById('container-especialidade').style.display = mostrar ? 'block' : 'none';
                    if (!mostrar) {
                        document.getElementById('div-veterinario').style.display = 'none';
                        document.getElementById('agenda-veterinario').value = '';
                    } else {
                        window.atualizarVeterinarios();
                    }
                ">
                    <option value="Consulta">Consulta</option>
                    <option value="Retorno">Retorno</option>
                    <option value="Exame">Exame</option>
                    <option value="Vacina">Vacina</option>
                    <option value="Banho/Tosa">Banho/Tosa</option>
                </select>
            </div>
            <div id="container-especialidade" style="display: block;">
                <label class="text-xs font-bold text-gray-500 mb-1 block">Especialidade</label>
                <select id="agenda-especialidade" class="w-full p-2 border rounded mt-1" onchange="atualizarVeterinarios()">
                    <option value="Clínica Geral">Clínica Geral</option>
                    <option value="Cardiologia">Cardiologia</option>
                </select>
            </div>
            <div id="div-veterinario" style="display: none;" class="mt-4">
                <label class="block text-sm font-semibold text-gray-700">Veterinário</label>
                <select id="agenda-veterinario" class="w-full p-2 border rounded mt-1"></select>
            </div>
            <div>
                <label class="text-xs font-bold text-gray-500 mb-1 block">Observações</label>
                <textarea id="agenda-obs" placeholder="Motivo da consulta, sintomas, etc..." class="input-pet" rows="2"></textarea>
            </div>
        </div>
    `;

        // Ativa o input de Pet apenas se um cliente for selecionado
        document.getElementById('agenda-cliente').addEventListener('change', function() {
            const petInput = document.getElementById('agenda-pet');
            if (this.value !== "") {
                petInput.disabled = false;
                petInput.classList.remove('bg-gray-100', 'cursor-not-allowed');
                petInput.placeholder = "Ex: Rex";
            } else {
                petInput.disabled = true;
                petInput.classList.add('bg-gray-100', 'cursor-not-allowed');
                petInput.placeholder = "Selecione o cliente primeiro";
                petInput.value = ""; 
            }
        });

        fetch(`/api/clientes/${clinicaId}`) // Ajuste a rota se a sua URL de clientes for diferente
            .then(res => res.json())
            .then(clientes => {
                const selectCliente = document.getElementById('agenda-cliente');
                if (clientes && clientes.length > 0) {
                    selectCliente.innerHTML = '<option value="">Selecione o Cliente</option>' + 
                        clientes.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
                } else {
                    selectCliente.innerHTML = '<option value="">Nenhum cliente cadastrado</option>';
                }
            })
            .catch(err => {
                console.error("Erro ao carregar clientes:", err);
                document.getElementById('agenda-cliente').innerHTML = '<option value="">Erro ao carregar</option>';
            });

    document.getElementById('modal-confirmar').onclick = async () => {
        const cliente = document.getElementById('agenda-cliente').value;
        const pet = document.getElementById('agenda-pet').value;
        const data = document.getElementById('agenda-data').value;
        const hora = document.getElementById('agenda-hora').value;
        const tipo = document.getElementById('agenda-tipo').value;
        const obs = document.getElementById('agenda-obs').value;
        const especialidade = document.getElementById('agenda-especialidade').value; // <-- LINHA ADICIONADA
        const vetSelect = document.getElementById('agenda-veterinario');
        const veterinario = vetSelect && vetSelect.value ? vetSelect.value : null;

        if (!cliente || !pet || !data || !hora) {
            return mostrarPopup('⚠️ Atenção', 'Preencha Cliente, Pet, Data e Hora.');
        }

        const novoAgendamento = { clinic_id: clinicaId, cliente, pet, data, hora, tipo, especialidade: tipo === 'Consulta' ? especialidade : null, veterinario: tipo === 'Consulta' ? veterinario : null, obs };

        try {
            await fetch('/api/agenda', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(novoAgendamento)
            });
        } catch(e) {
            console.log("Aviso: Servidor de agenda não encontrado na 8080. Salvando localmente para visualização.");
        }
        
        // Adiciona à lista local imediatamente
        agendamentos.push(novoAgendamento);

        mostrarPopup('✅ Sucesso', 'Agendamento salvo com sucesso!');
        fecharModal();
        
        // Atualiza a tela do calendário para exibir o novo item na hora
        if (typeof window.renderizarCalendario === 'function') {
            window.renderizarCalendario();
        }
    };

    document.getElementById('modal-container').style.display = 'flex';
}

// === FUNÇÕES DE CLIENTES ===
        async function carregarPets() {
            try {
                const res = await fetch(`/api/clientes/${clinicaId}`);
                if (res.ok) {
                    window.clientesLista = await res.json();
                    renderPets(window.clientesLista);
                }
            } catch (e) {
                console.error("Erro ao carregar pets", e);
            }
        }

        function renderPets(clientes) {
            const tbody = document.getElementById('tabela-pets-corpo');
            if (!tbody) return;

            let linhasHtml = '';
            
            clientes.forEach(c => {
                if (c.pets) {
                    try {
                        const petsArray = typeof c.pets === 'string' ? JSON.parse(c.pets) : c.pets;
                        petsArray.forEach(p => {
                            linhasHtml += `
                                <tr>
                                    <td class="font-bold">${p.nome || '-'}</td>
                                    <td>${p.raca || '-'}</td>
                                    <td>${c.nome}</td>
                                    <td class="text-xs text-gray-500">${p.idade || '-'} / ${p.sexo || '-'}</td>
                                </tr>
                            `;
                        });
                    } catch (e) {
                        console.error("Erro ao processar pets", e);
                    }
                }
            });

            if (linhasHtml === '') {
                tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-400">Nenhum pet cadastrado.</td></tr>`;
            } else {
                tbody.innerHTML = linhasHtml;
            }
        }

        function filtrarPets() {
            const q = document.getElementById('busca-pet').value.toLowerCase();
            if (!window.clientesLista) return;
            
            const clientesFiltrados = window.clientesLista.map(c => {
                if (!c.pets) return null;
                try {
                    const petsArray = typeof c.pets === 'string' ? JSON.parse(c.pets) : c.pets;
                    const petsFiltrados = petsArray.filter(p => 
                        (p.nome && p.nome.toLowerCase().startsWith(q)) || 
                        (p.raca && p.raca.toLowerCase().startsWith(q))
                    );
                    if (petsFiltrados.length > 0) {
                        return { ...c, pets: JSON.stringify(petsFiltrados) };
                    }
                } catch(e) {}
                return null;
            }).filter(c => c !== null);

            renderPets(clientesFiltrados);
        }
        async function carregarClientes() {
            try {
                const res = await fetch(`/api/clientes/${clinicaId}`);
                if (res.ok) {
                    window.clientesLista = await res.json();
                    renderClientes(window.clientesLista);
                }
            } catch (e) {
                console.error("Erro ao carregar clientes", e);
            }
        }

        function renderClientes(lista) {
            const tbody = document.getElementById('tabela-clientes-corpo');
            if (!tbody) return;
            if (lista.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-400">Nenhum cliente cadastrado.</td></tr>`;
                return;
            }
            tbody.innerHTML = lista.map(c => `
                <tr>
                    <td class="font-bold">${c.nome}</td>
                    <td>${c.cpf || '-'}</td>
                    <td>${c.telefone || '-'}</td>
                    <td>
                        <button onclick="verDetalhesCliente(${c.id})" class="bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1 rounded-lg font-bold hover:bg-blue-100 transition">Ver Detalhes</button>
                    </td>
                </tr>
            `).join('');
        }

        function filtrarClientes() {
            const q = document.getElementById('busca-cliente').value.toLowerCase();
            
            const filtrados = (window.clientesLista || []).filter(c => {
                // 1. Verifica Nome do Cliente ou CPF (Agora usando startsWith)
                const matchCliente = c.nome.toLowerCase().startsWith(q) || 
                                     (c.cpf && c.cpf.startsWith(q));
                
                // 2. Verifica Nome do Pet (deserializando o JSON do banco)
                let matchPet = false;
                if (c.pets) {
                    try {
                        const petsArray = typeof c.pets === 'string' ? JSON.parse(c.pets) : c.pets;
                        matchPet = petsArray.some(p => p.nome && p.nome.toLowerCase().startsWith(q));
                    } catch (e) {
                        console.error("Erro ao ler os pets:", e);
                    }
                }

                // Retorna se achou no cliente OU no pet
                return matchCliente || matchPet;
            });
            
            renderClientes(filtrados);
        }

        function abrirModalCliente() {
            document.getElementById('modal-titulo').innerText = "Novo Cliente";
            document.getElementById('modal-body').innerHTML = `
                <div class="space-y-4">
                    <div>
                        <label class="text-xs font-bold text-gray-500 mb-1 block">Nome Completo *</label>
                        <input id="new-cli-nome" placeholder="Ex: João da Silva" class="input-pet" required>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-xs font-bold text-gray-500 mb-1 block">CPF</label>
                            <input id="new-cli-cpf" placeholder="000.000.000-00" onkeyup="mascaraCPF(this)" class="input-pet">
                        </div>
                        <div>
                            <label class="text-xs font-bold text-gray-500 mb-1 block">Telefone *</label>
                            <input id="new-cli-telefone" placeholder="(00) 00000-0000" onkeyup="mascaraTelefone(this)" class="input-pet" required>
                        </div>
                    </div>
                    
                    <div>
                        <label class="text-xs font-bold text-gray-500 mb-1 block">Endereço</label>
                        <input id="new-cli-endereco" placeholder="Ex: Rua das Flores, 123" class="input-pet">
                    </div>
                    <div id="container-pets"></div>
                    <button type="button" id="btn-adicionar-pet" class="bg-blue-50 text-blue-600 border border-blue-200 px-4 py-2 rounded-lg font-bold hover:bg-blue-100 w-full transition">+ Adicionar Pet</button>
                </div>
            `;
            
            const btn = document.getElementById('modal-confirmar');
            btn.innerText = "Salvar Cliente";
            btn.style.background = 'linear-gradient(90deg, #10b981, #3b82f6)';
            
            // Lógica para adicionar campos de Pet dinamicamente
            document.getElementById('btn-adicionar-pet').onclick = function() {
                const container = document.getElementById('container-pets');
                const petCount = container.children.length + 1;
                const petFields = `
                    <div class="p-3 border border-gray-200 rounded-lg mt-3 bg-gray-50 relative">
                        <div class="pet-form">
                            <h5 class="font-bold text-sm text-gray-700 mb-2">Pet ${petCount}</h5>
                            
                            <div class="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label class="text-xs font-bold text-gray-500 mb-1 block">Nome do Pet</label>
                                    <input type="text" class="input-pet pet-nome" required>
                                </div>
                                <div>
                                    <label class="text-xs font-bold text-gray-500 mb-1 block">Espécie/Raça</label>
                                    <input type="text" class="input-pet pet-raca" required>
                                </div>
                            </div>

                            <div class="grid grid-cols-3 gap-3">
                                <div>
                                    <label class="text-xs font-bold text-gray-500 mb-1 block">Idade</label>
                                    <input type="text" class="input-pet pet-idade" placeholder="Ex: 2 anos">
                                </div>
                                <div>
                                    <label class="text-xs font-bold text-gray-500 mb-1 block">Sexo</label>
                                    <select class="input-pet pet-sexo">
                                        <option value="">Selecione</option>
                                        <option value="Macho">Macho</option>
                                        <option value="Fêmea">Fêmea</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="text-xs font-bold text-gray-500 mb-1 block">Peso (kg)</label>
                                    <input type="number" step="0.1" class="input-pet pet-peso" placeholder="Ex: 5.5">
                                </div>
                            </div>
                            <div class="mt-3">
                                <label class="text-xs font-bold text-gray-500 mb-1 block">Informações Adicionais (Alergias, Comportamento, etc.)</label>
                                <textarea class="input-pet pet-obs" placeholder="Detalhes importantes sobre o pet..." rows="2"></textarea>
                            </div>
                            <div class="flex gap-4 mt-3">
                                <button type="button" onclick="
                                    const divPet = this.closest('.relative');
                                    const nome = divPet.querySelector('.pet-nome').value.trim();
                                    const raca = divPet.querySelector('.pet-raca').value.trim();
                                    if(nome) {
                                        divPet.querySelector('.pet-nome-display').innerText = '🐾 ' + nome + (raca ? ' (' + raca + ')' : '');
                                        divPet.querySelector('.pet-form').classList.add('hidden');
                                        divPet.querySelector('.pet-badge').classList.remove('hidden');
                                    } else {
                                        alert('Preencha o nome do pet antes de salvar!');
                                    }
                                " class="bg-blue-600 text-white px-3 py-1 rounded-md text-xs font-bold hover:bg-blue-700 transition">Salvar Pet</button>
                                <button type="button" onclick="this.closest('.relative').remove()" class="text-red-500 text-xs font-bold hover:underline flex items-center">Remover</button>
                            </div>
                        </div>
                        
                        <div class="pet-badge hidden flex justify-between items-center bg-white p-3 rounded-lg border border-blue-200 shadow-sm">
                            <span class="text-sm font-bold text-blue-700 pet-nome-display"></span>
                            <div class="flex gap-3">
                                <button type="button" onclick="
                                    const divPet = this.closest('.relative');
                                    divPet.querySelector('.pet-form').classList.remove('hidden');
                                    divPet.querySelector('.pet-badge').classList.add('hidden');
                                " class="text-gray-500 text-xs font-bold hover:text-blue-600 hover:underline">Editar</button>
                                <button type="button" onclick="this.closest('.relative').remove()" class="text-red-500 text-xs font-bold hover:underline">Remover</button>
                            </div>
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', petFields);
            };

           btn.onclick = async () => {
                const nome = document.getElementById('new-cli-nome').value.trim();
                const cpf = document.getElementById('new-cli-cpf').value.trim();
                const telefone = document.getElementById('new-cli-telefone').value.trim();
                const endereco = document.getElementById('new-cli-endereco').value.trim();

                if (!nome || !telefone) return mostrarPopup('⚠️', 'Preencha Nome e Telefone.');
                
                // Captura os dados dos pets adicionados para enviar ao banco
                const petsAdicionados = [];
                document.querySelectorAll('#container-pets > div').forEach(div => {
                    const pNome = div.querySelector('.pet-nome').value.trim();
                    const pRaca = div.querySelector('.pet-raca').value.trim();
                    const pIdade = div.querySelector('.pet-idade').value.trim();
                    const pSexo = div.querySelector('.pet-sexo').value;
                    const pPeso = div.querySelector('.pet-peso').value.trim();
                    const pObs = div.querySelector('.pet-obs').value.trim(); // <-- ESTA É A LINHA QUE FALTAVA

                    if (pNome) {
                        petsAdicionados.push({ 
                            nome: pNome, 
                            raca: pRaca,
                            idade: pIdade,
                            sexo: pSexo,
                            peso: pPeso,
                            obs: pObs
                        });
                    }
                });

                try {
                    const res = await fetch('/api/clientes', {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ clinic_id: clinicaId, nome, cpf, telefone, endereco, pets: petsAdicionados })
                    });
                    if (res.ok) {
                        fecharModal();
                        mostrarPopup('✅ Sucesso', 'Cliente cadastrado com sucesso!');
                        carregarClientes(); 
                    } else {
                        mostrarPopup('❌ Erro', 'Não foi possível salvar o cliente.');
                    }
                } catch (e) {
                    mostrarPopup('🔌 Erro', 'Falha na conexão com o servidor na porta 8080.');
                }
            };
            document.getElementById('modal-container').style.display = 'flex';
        }

        window.atualizarSelectsConfiguracoes();

window.atualizarVeterinarios = function() {
    const especialidade = document.getElementById('agenda-especialidade').value;
    const selectVet = document.getElementById('agenda-veterinario');
    const divVet = document.getElementById('div-veterinario');

    if (!especialidade) {
        divVet.style.display = 'none';
        selectVet.innerHTML = '';
        return;
    }

    // Filtra a variável global "equipe" pela especialidade selecionada
    // Garante que lista apenas quem é veterinário/tem a especialidade
    const veterinarios = equipe.filter(colab => colab.especialidade === especialidade);

    if (veterinarios.length > 0) {
        divVet.style.display = 'block';
        selectVet.innerHTML = '<option value="">Selecione o Veterinário...</option>' + 
            veterinarios.map(v => `<option value="${v.nome}">${v.nome}</option>`).join('');
    } else {
        divVet.style.display = 'block';
        selectVet.innerHTML = '<option value="">Nenhum veterinário desta especialidade encontrado</option>';
    }
};

window.atualizarHorarios = function(dataSelecionada) {
    const selectHora = document.getElementById('agenda-hora');
    
    if (!dataSelecionada) {
        selectHora.disabled = true;
        selectHora.innerHTML = '<option value="">Selecione a data primeiro...</option>';
        return;
    }

    // Lista com todos os horários padrão da clínica
    const todosHorarios = [
        "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
        "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
        "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
        "17:00", "17:30", "18:00"
    ];

    // Filtra dentro da variável global "agendamentos" todos que caem nesta data
    const horariosOcupados = agendamentos
        .filter(a => a.data === dataSelecionada)
        .map(a => a.hora);

    // Constrói tudo em uma única string de texto para não quebrar o DOM do Select
    let optionsHTML = '<option value="">Selecione o horário...</option>';
    
    todosHorarios.forEach(hora => {
        if (!horariosOcupados.includes(hora)) {
            optionsHTML += `<option value="${hora}">${hora}</option>`;
        }
    });

    selectHora.innerHTML = optionsHTML;
    selectHora.disabled = false;
};
window.verDetalhesCliente = function(id) {
    const cliente = window.clientesLista.find(c => c.id === id);
    if(!cliente) return;
    
    let petsHtml = '<p class="text-sm text-gray-500 italic">Nenhum pet cadastrado.</p>';
    if(cliente.pets) {
        try {
            const pets = typeof cliente.pets === 'string' ? JSON.parse(cliente.pets) : cliente.pets;
            if(pets.length > 0) {
                petsHtml = pets.map(p => `
                    <div class="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-2">
                        <p class="font-bold text-blue-800">🐾 ${p.nome} <span class="text-xs font-normal text-gray-600">(${p.raca || 'Raça não informada'})</span></p>
                        <div class="grid grid-cols-3 gap-2 mt-2">
                            <p class="text-xs text-gray-700"><b>Idade:</b> ${p.idade || '-'}</p>
                            <p class="text-xs text-gray-700"><b>Sexo:</b> ${p.sexo || '-'}</p>
                            <p class="text-xs text-gray-700"><b>Peso:</b> ${p.peso ? p.peso + ' kg' : '-'}</p>
                        </div>
                        ${p.obs ? `<p class="text-xs text-gray-600 mt-2 bg-white p-2 rounded border border-blue-100"><b>Obs:</b> ${p.obs}</p>` : ''}
                    </div>
                `).join('');
            }
        } catch(e) {
            console.error("Erro ao ler pets do cliente:", e);
        }
    }

    document.getElementById('modal-titulo').innerText = "Detalhes do Cliente";
    document.getElementById('modal-body').innerHTML = `
        <div class="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <p class="text-xl font-black text-gray-800 mb-3 flex justify-between items-center">
                    <span id="txt-cli-nome">${cliente.nome}</span>
                    <button onclick="editarCampoCliente(${cliente.id}, 'nome')" class="text-blue-500 hover:text-blue-700 ml-2 text-base" title="Editar Nome">✏️</button>
                </p>
                <div class="grid grid-cols-2 gap-3">
                    <p class="text-sm text-gray-600">
                        <b>CPF:</b> <button onclick="editarCampoCliente(${cliente.id}, 'cpf')" class="text-blue-500 hover:text-blue-700 ml-1 text-xs" title="Editar CPF">✏️</button><br>
                        <span id="txt-cli-cpf">${cliente.cpf || 'Não informado'}</span>
                    </p>
                    <p class="text-sm text-gray-600">
                        <b>Telefone:</b> <button onclick="editarCampoCliente(${cliente.id}, 'telefone')" class="text-blue-500 hover:text-blue-700 ml-1 text-xs" title="Editar Telefone">✏️</button><br>
                        <span id="txt-cli-telefone">${cliente.telefone || 'Não informado'}</span>
                    </p>
                </div>
                <p class="text-sm text-gray-600 mt-3">
                    <b>Endereço:</b> <button onclick="editarCampoCliente(${cliente.id}, 'endereco')" class="text-blue-500 hover:text-blue-700 ml-1 text-xs" title="Editar Endereço">✏️</button><br>
                    <span id="txt-cli-endereco">${cliente.endereco || 'Não informado'}</span>
                </p>
            </div>
                <p class="text-sm text-gray-600 mt-3"><b>Endereço:</b><br>${cliente.endereco || 'Não informado'}</p>
            </div>
            <div>
                <h4 class="font-bold text-gray-700 mb-3 border-b pb-1 text-lg">Pets Cadastrados</h4>
                <div class="max-h-64 overflow-y-auto pr-2">
                    ${petsHtml}
                </div>
            </div>
        </div>
    `;
    
    const btn = document.getElementById('modal-confirmar');
    btn.innerText = "Fechar";
    btn.style.background = '#9ca3af'; // Volta para cor cinza para agir como botão fechar
    btn.onclick = fecharModal;
    
    document.getElementById('modal-container').style.display = 'flex';
};

async function editarCampoCliente(id, campo) {
    const elemento = document.getElementById(`txt-cli-${campo}`);
    let valorAtual = elemento.innerText;
    if (valorAtual === 'Não informado') valorAtual = '';

    const nomesExibicao = { nome: "Nome", cpf: "CPF", telefone: "Telefone", endereco: "Endereço" };
    
    // 1. Cria o pop-up customizado com a identidade visual do site (se ainda não existir)
    let editPopup = document.getElementById('custom-edit-popup');
    if (!editPopup) {
        editPopup = document.createElement('div');
        editPopup.id = 'custom-edit-popup';
        editPopup.className = 'popup-overlay'; // Usa a mesma classe de fundo escuro do seu CSS
        editPopup.style.zIndex = '3000'; // Garante que fique por cima do modal atual
        
        editPopup.innerHTML = `
            <div class="popup-content" style="max-width: 400px; width: 90%;">
                <h3 id="custom-edit-titulo" class="text-xl font-bold mb-4 text-gray-800"></h3>
                <input id="custom-edit-input" type="text" class="input-pet mb-6 text-base">
                <div class="flex gap-3">
                    <button id="custom-edit-cancelar" class="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-300 transition">Cancelar</button>
                    <button id="custom-edit-salvar" class="flex-1 btn-principal py-3 rounded-xl font-bold">Salvar</button>
                </div>
            </div>
        `;
        document.body.appendChild(editPopup);
    }

    // 2. Insere os dados atuais no pop-up
    document.getElementById('custom-edit-titulo').innerText = `Editar ${nomesExibicao[campo]}:`;
    const inputField = document.getElementById('custom-edit-input');
    inputField.value = valorAtual;
    
    // Aplica a máscara correspondente enquanto o usuário digita
    inputField.onkeyup = function() {
        if (campo === 'cpf') mascaraCPF(this);
        if (campo === 'telefone') mascaraTelefone(this);
    };

    // 3. Exibe o pop-up e foca no input
    editPopup.style.display = 'flex';
    inputField.focus();

    // 4. Pausa a função aguardando o usuário clicar em Salvar ou Cancelar (Substitui o prompt do navegador)
    const novoValor = await new Promise((resolve) => {
        document.getElementById('custom-edit-salvar').onclick = () => {
            editPopup.style.display = 'none';
            resolve(inputField.value);
        };
        document.getElementById('custom-edit-cancelar').onclick = () => {
            editPopup.style.display = 'none';
            resolve(null);
        };
    });

    // 5. Continua com a mesma lógica que você já tinha para salvar no banco de dados[cite: 1]
    if (novoValor !== null && novoValor.trim() !== valorAtual) {
        try {
            const res = await fetch(`/api/clientes/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ campo, valor: novoValor.trim() })
            });

            if (res.ok) {
                elemento.innerText = novoValor.trim() || 'Não informado';
                
                if (window.clientesLista) {
                    const cli = window.clientesLista.find(c => c.id === id);
                    if (cli) cli[campo] = novoValor.trim();
                    if(typeof filtrarClientes === 'function') filtrarClientes(); 
                }
                
                mostrarPopup('✅ Sucesso', `${nomesExibicao[campo]} atualizado com sucesso!`);[cite, 1]
                
                if (typeof verDetalhesCliente === 'function') verDetalhesCliente(id);[cite, 1]
            } else {
                mostrarPopup('❌ Erro', 'Não foi possível atualizar o dado.');[cite, 1]
            }
        } catch (e) {
            mostrarPopup('🔌 Erro', 'Erro de conexão com o servidor.');[cite, 1]
        }
    }
}

window.atualizarStatusFila = async function(id, novoStatus) {
    try {
        const res = await fetch(`/api/agenda/status/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: novoStatus })
        });
        
        if (res.ok) {
            // Atualiza o dado em memória para o front-end
            const item = agendamentos.find(a => a.id === id);
            if(item) item.status = novoStatus;
            
            // Recarrega apenas a tela da fila para atualizar as cores instantaneamente
            navegarModulo('fila'); 
        } else {
            mostrarPopup('❌ Erro', 'Não foi possível atualizar o status do paciente.');
        }
    } catch(e) {
        mostrarPopup('❌ Erro', 'Erro de comunicação com o servidor.');
    }
};

window.fecharCaixaDia = function() {
        if(confirm("Deseja realmente fechar o caixa de hoje? Os lançamentos continuarão salvos e visíveis na visão de Auditoria e Financeiro.")) {
            document.getElementById('conteudo-dinamico').innerHTML = `
                <div class="card text-center py-16">
                    <h2 class="text-3xl font-black text-green-600 mb-2">✅ Caixa Fechado</h2>
                    <p class="text-gray-500 font-bold">O caixa do dia foi encerrado com sucesso.</p>
                </div>
            `;
        }
    };

    window.abrirModalProntuario = function() {
    const hojeLocal = new Date();
    const dataHojeFormatada = hojeLocal.getFullYear() + '-' + String(hojeLocal.getMonth() + 1).padStart(2, '0') + '-' + String(hojeLocal.getDate()).padStart(2, '0');
    
    // Filtra pacientes marcados para este vet HOJE
    const meusAgendamentos = agendamentos.filter(a => a.veterinario === clinicaLogada.nome && a.data === dataHojeFormatada);
    
    let optionsAgendamentos = '<option value="">Atendimento avulso (Preencher manual)</option>';
    meusAgendamentos.forEach(a => {
        optionsAgendamentos += `<option value="${a.id}" data-cliente="${a.cliente}" data-pet="${a.pet}">[${a.hora}] - ${a.pet} (Tutor: ${a.cliente})</option>`;
    });

    document.getElementById('modal-titulo').innerText = "Registro de Prontuário Clínico";
    document.getElementById('modal-body').innerHTML = `
        <div class="space-y-4">
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <label class="text-xs font-black text-blue-800 uppercase mb-1 block">Vincular Paciente Agendado Hoje</label>
                <select id="prontuario-agendamento" class="input-pet border-blue-300 font-bold text-blue-900" onchange="
                    const opt = this.options[this.selectedIndex];
                    if(opt.value) {
                        document.getElementById('prontuario-cliente').value = opt.getAttribute('data-cliente');
                        document.getElementById('prontuario-pet').value = opt.getAttribute('data-pet');
                    }
                ">
                    ${optionsAgendamentos}
                </select>
                <p class="text-xs text-blue-600 mt-1">Selecionar o paciente mudará seu status para 'Finalizado' na fila.</p>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-xs font-bold text-gray-500 mb-1 block">Tutor (Cliente) *</label>
                    <input id="prontuario-cliente" class="input-pet" required>
                </div>
                <div>
                    <label class="text-xs font-bold text-gray-500 mb-1 block">Nome do Pet *</label>
                    <input id="prontuario-pet" class="input-pet" required>
                </div>
            </div>
            <div>
                <label class="text-xs font-bold text-gray-500 mb-1 block">Peso Atual (kg)</label>
                <input id="prontuario-peso" type="number" step="0.1" class="input-pet" placeholder="Ex: 5.5">
            </div>
            <div>
                <label class="text-xs font-bold text-gray-500 mb-1 block">Sintomas / Histórico / Queixa</label>
                <textarea id="prontuario-sintomas" class="input-pet" rows="2" placeholder="Descreva os sintomas..."></textarea>
            </div>
            <div>
                <label class="text-xs font-bold text-gray-500 mb-1 block">Diagnóstico</label>
                <textarea id="prontuario-diagnostico" class="input-pet" rows="2" placeholder="Diagnóstico clínico detectado..."></textarea>
            </div>
            <div>
                <label class="text-xs font-bold text-gray-500 mb-1 block">Prescrição (Receita / Medicações)</label>
                <textarea id="prontuario-prescricao" class="input-pet" rows="3" placeholder="Medicamentos, posologia, recomendações..."></textarea>
            </div>
        </div>
    `;

    document.getElementById('modal-confirmar').onclick = async () => {
        const agendamento_id = document.getElementById('prontuario-agendamento').value;
        const payload = {
            clinic_id: clinicaId,
            agendamento_id: agendamento_id || null,
            cliente: document.getElementById('prontuario-cliente').value.trim(),
            pet: document.getElementById('prontuario-pet').value.trim(),
            data: new Date().toLocaleDateString('pt-BR'),
            veterinario: clinicaLogada.nome,
            peso: document.getElementById('prontuario-peso').value.trim(),
            sintomas: document.getElementById('prontuario-sintomas').value.trim(),
            diagnostico: document.getElementById('prontuario-diagnostico').value.trim(),
            prescricao: document.getElementById('prontuario-prescricao').value.trim()
        };

        if (!payload.cliente || !payload.pet) return mostrarPopup('⚠️ Atenção', 'O Cliente e o Pet são obrigatórios.');

        try {
            const res = await fetch('/api/prontuarios', {
                method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload)
            });

            if (res.ok) {
                if (agendamento_id && typeof atualizarStatusFila === 'function') {
                    await atualizarStatusFila(agendamento_id, 'Finalizado');
                }
                const pronRes = await fetch(`/api/prontuarios/${clinicaId}`);
                if (pronRes.ok) prontuarios = await pronRes.json();

                mostrarPopup('✅ Sucesso', 'Prontuário gerado com sucesso!');
                fecharModal();
                navegarModulo('prontuario');
            } else { mostrarPopup('❌ Erro', 'Falha ao salvar o prontuário no banco.'); }
        } catch (e) { mostrarPopup('🔌 Erro', 'Conexão com a porta 8080 falhou.'); }
    };
    document.getElementById('modal-container').style.display = 'flex';
};

window.abrirModalProntuarioVinculado = function() {
    const select = document.getElementById('prontuario-vinculo-rapido');
    
    if(!select.value) {
        mostrarPopup('⚠️ Atenção', 'Selecione um paciente aguardando na fila para vincular!');
        return;
    }
    
    // Abre o modal nativo
    abrirModalProntuario();
    
    // Preenche automaticamente o select dentro do modal e dispara o evento para carregar os dados
    setTimeout(() => {
        const modalSelect = document.getElementById('prontuario-agendamento');
        if(modalSelect) {
            modalSelect.value = select.value;
            modalSelect.dispatchEvent(new Event('change'));
        }
    }, 50);
};

// Função para rolagem suave da tela inicial
function rolarParaInformacoes() {
    document.getElementById('secao-informacoes').scrollIntoView({ behavior: 'smooth' });
}

window.atualizarSelectsEspecialidades = function() {
    // Array com os IDs dos selects de especialidade no seu HTML (Adicione os IDs corretos aqui)
    const selectsEspecialidades = [
        document.getElementById('select-especialidade-equipe'), // ID do select no modal de Equipe
        document.getElementById('select-especialidade-recepcao') // ID do select na Recepção
    ];

    selectsEspecialidades.forEach(select => {
        if (select) {
            const valorAtual = select.value; // Salva o valor selecionado caso esteja editando
            select.innerHTML = '<option value="">Selecione uma Especialidade...</option>';
            especialidadesClinica.forEach(esp => {
                const option = document.createElement('option');
                option.value = esp.nome;
                option.textContent = esp.nome;
                select.appendChild(option);
            });
            if (valorAtual) select.value = valorAtual; // Restaura a seleção
        }
    });
};

async function salvarNovaEspecialidade(nomeEspecialidade) {
    await fetch('/api/especialidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinic_id: clinicaId, nome: nomeEspecialidade })
    });
    await sincronizarDados(); // Isso recarrega a lista do banco e já atualiza os selects de toda a tela.
};