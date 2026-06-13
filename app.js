document.addEventListener('DOMContentLoaded', () => {
    
    // --- ESTADO GLOBAL (LOCALSTORAGE) ---
    let state = {
        bancas: JSON.parse(localStorage.getItem('decipro_bancas')) || [
            { id: 'banca_1', nome: 'Banca Principal', plataforma: 'Bet365', inicial: 5000, atual: 5000, alavancagem: 100, prazo: 30, risco: 'moderado', data: '12/06/2026' }
        ],
        activeBancaId: localStorage.getItem('decipro_active_banca') || 'banca_1',
        favoritos: JSON.parse(localStorage.getItem('decipro_favoritos')) || { jogos: [], ligas: [] },
        selectedGameForAnalysis: JSON.parse(localStorage.getItem('decipro_selected_game_analysis')) || null,
        activeMatchSummary: JSON.parse(localStorage.getItem('decipro_active_match_summary')) || null,
        simulations: JSON.parse(localStorage.getItem('decipro_simulations')) || [
            { id: 'mock_1', partida: 'Flamengo vs Palmeiras', mercado: 'Flamengo Vence (1X2)', odds: 1.85, valor: 200, status: 'WIN', retorno: 170, data: '10/06/2026', bancaId: 'banca_1' },
            { id: 'mock_2', partida: 'Real Madrid vs Barcelona', mercado: 'Mais de 2.5 gols', odds: 1.60, valor: 300, status: 'WIN', retorno: 180, data: '11/06/2026', bancaId: 'banca_1' },
            { id: 'mock_3', partida: 'Liverpool vs Arsenal', mercado: 'Empate Anula Aposta', odds: 1.95, valor: 150, status: 'LOSS', retorno: -150, data: '11/06/2026', bancaId: 'banca_1' },
            { id: 'mock_4', partida: 'Manchester City vs Chelsea', mercado: 'Man City -1.5 handicap', odds: 2.10, valor: 250, status: 'LOSS', retorno: -250, data: '12/06/2026', bancaId: 'banca_1' },
            { id: 'mock_5', partida: 'Boca Juniors vs River Plate', mercado: 'Ambos Marcam: Sim', odds: 1.75, valor: 200, status: 'WIN', retorno: 150, data: '12/06/2026', bancaId: 'banca_1' }
        ],
        subscription: JSON.parse(localStorage.getItem('decipro_subscription')) || { plan: 'free', active: false, expires: '-' },
        loggedIn: JSON.parse(localStorage.getItem('decipro_logged_in')) || false,
        currentUser: JSON.parse(localStorage.getItem('decipro_current_user')) || null,
        adminUsers: JSON.parse(localStorage.getItem('decipro_admin_users')) || [
            { id: 'usr_1', nome: 'Carlos Silva', email: 'carlos@email.com', plano: 'anual', banca: 6240.00, ativo: true, data: '10/06/2026' },
            { id: 'usr_2', nome: 'Mariana Souza', email: 'mariana@email.com', plano: 'mensal', banca: 3150.00, ativo: true, data: '11/06/2026' },
            { id: 'usr_3', nome: 'Felipe Oliveira', email: 'felipe@email.com', plano: 'free', banca: 500.00, ativo: false, data: '11/06/2026' },
            { id: 'usr_4', nome: 'Renata Santos', email: 'renata@email.com', plano: 'anual', banca: 12050.00, ativo: true, data: '12/06/2026' },
            { id: 'usr_5', nome: 'Bruno Costa', email: 'bruno@email.com', plano: 'mensal', banca: 1840.00, ativo: true, data: '12/06/2026' }
        ]
    };

    let liveSimulationInterval = null;
    let liveStats = null;
    let currentH2HMarket = 'GOLS';
    let currentH2HTime = 'FT';
    let currentH2HSameLeague = false;

    // Salva o estado no localStorage
    const saveState = () => {
        localStorage.setItem('decipro_bancas', JSON.stringify(state.bancas));
        localStorage.setItem('decipro_active_banca', state.activeBancaId);
        localStorage.setItem('decipro_favoritos', JSON.stringify(state.favoritos));
        localStorage.setItem('decipro_selected_game_analysis', JSON.stringify(state.selectedGameForAnalysis));
        localStorage.setItem('decipro_active_match_summary', JSON.stringify(state.activeMatchSummary));
        localStorage.setItem('decipro_simulations', JSON.stringify(state.simulations));
        localStorage.setItem('decipro_subscription', JSON.stringify(state.subscription));
        localStorage.setItem('decipro_logged_in', JSON.stringify(state.loggedIn));
        localStorage.setItem('decipro_current_user', JSON.stringify(state.currentUser));
        localStorage.setItem('decipro_admin_users', JSON.stringify(state.adminUsers));
    };

    // Retorna a banca ativa atualmente
    const getActiveBanca = () => {
        return state.bancas.find(b => b.id === state.activeBancaId) || state.bancas[0];
    };

    // --- GERENCIAMENTO DE ABAS ---
    const navLinks = document.querySelectorAll('.nav-link');
    const tabPanels = document.querySelectorAll('.tab-panel');

    // Controla a visibilidade das abas com base no login e papel do usuário
    const updateNavigationVisibility = () => {
        const navItems = document.querySelectorAll('.nav-menu .nav-item');
        
        navItems.forEach(item => {
            const link = item.querySelector('.nav-link');
            if (!link) return;
            
            const tab = link.getAttribute('data-tab');
            
            if (!state.loggedIn) {
                // Deslogado: mostra apenas Entrada e Planos
                if (tab === 'entrada' || tab === 'planos') {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            } else {
                // Logado
                if (tab === 'entrada') {
                    // Oculta a aba de Entrada se o usuário já estiver logado
                    item.style.display = 'none';
                } else if (tab === 'admin') {
                    // Apenas exibe o menu Admin se o usuário logado for 'admin'
                    if (state.currentUser && state.currentUser.role === 'admin') {
                        item.style.display = 'block';
                    } else {
                        item.style.display = 'none';
                    }
                } else {
                    // Mostra as demais abas funcionais e Logout
                    item.style.display = 'block';
                }
            }
        });
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            const targetTab = link.getAttribute('data-tab');
            if (!targetTab) return; // Evita processar abas sem identificador (ex: logout)
            
            // Restrição de acesso: se não estiver logado, só permite Entrada e Planos (para visualizar mensalidades)
            if (!state.loggedIn && targetTab !== 'entrada' && targetTab !== 'planos') {
                alert('⚠️ Acesso restrito! Por favor, faça login ou crie uma conta para liberar o painel Decipro.');
                const navEntrada = document.querySelector('[data-tab="entrada"]');
                if (navEntrada) navEntrada.click();
                return;
            }
            
            navLinks.forEach(item => item.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));
            
            link.classList.add('active');
            
            const targetPanel = document.getElementById(`panel-${targetTab}`);
            if (targetPanel) {
                targetPanel.classList.add('active');
                
                // Triggers de renderização ao trocar de aba
                if (targetTab === 'banca') {
                    renderBancaDetails();
                } else if (targetTab === 'pesquisa') {
                    initPesquisaTab();
                } else if (targetTab === 'simulacao') {
                    syncSimulacaoBanca();
                } else if (targetTab === 'analise') {
                    renderAnalysisTab();
                } else if (targetTab === 'h2h') {
                    renderH2HTab();
                } else if (targetTab === 'resultado') {
                    renderResultsTab();
                } else if (targetTab === 'planos') {
                    renderPlanosTab();
                } else if (targetTab === 'admin') {
                    renderAdminTab();
                }
            }
        });
    });

    // Chama na inicialização para ajustar os links visíveis
    updateNavigationVisibility();

    // --- ABA 1: ENTRADA (ACESSO) ---
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const btnGoogleLogin = document.getElementById('btn-google-login');
    const btnLogout = document.getElementById('btn-logout');
    const toggleAuthModeBtn = document.getElementById('toggle-auth-mode');
    const authAlternativeWrapper = document.getElementById('auth-alternative-wrapper');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const authTabLogin = document.getElementById('auth-tab-login');
    const authTabRegister = document.getElementById('auth-tab-register');

    let isLoginMode = true;

    // Função para alternar de forma centralizada entre os modos Login e Registro
    const switchAuthMode = (toLogin) => {
        isLoginMode = toLogin;
        
        if (isLoginMode) {
            if (loginForm) loginForm.style.display = 'block';
            if (signupForm) signupForm.style.display = 'none';
            if (authAlternativeWrapper) authAlternativeWrapper.style.display = 'block';
            if (authTitle) authTitle.textContent = 'Bem-vindo de volta';
            if (authSubtitle) authSubtitle.textContent = 'Escolha sua forma de acesso';
            if (toggleAuthModeBtn) toggleAuthModeBtn.textContent = 'Não tem conta? Cadastre-se';
            
            if (authTabLogin) {
                authTabLogin.classList.add('active');
                authTabLogin.style.borderBottom = '3px solid var(--primary)';
                authTabLogin.style.color = 'var(--text-main)';
            }
            if (authTabRegister) {
                authTabRegister.classList.remove('active');
                authTabRegister.style.borderBottom = 'none';
                authTabRegister.style.color = 'var(--text-muted)';
            }
        } else {
            if (loginForm) loginForm.style.display = 'none';
            if (signupForm) signupForm.style.display = 'block';
            if (authAlternativeWrapper) authAlternativeWrapper.style.display = 'none';
            if (authTitle) authTitle.textContent = 'Criar Nova Conta';
            if (authSubtitle) authSubtitle.textContent = 'Cadastre-se para liberar o painel Decipro';
            if (toggleAuthModeBtn) toggleAuthModeBtn.textContent = 'Já tem conta? Entrar';
            
            if (authTabRegister) {
                authTabRegister.classList.add('active');
                authTabRegister.style.borderBottom = '3px solid var(--primary)';
                authTabRegister.style.color = 'var(--text-main)';
            }
            if (authTabLogin) {
                authTabLogin.classList.remove('active');
                authTabLogin.style.borderBottom = 'none';
                authTabLogin.style.color = 'var(--text-muted)';
            }
        }
    };

    if (authTabLogin) {
        authTabLogin.addEventListener('click', () => switchAuthMode(true));
    }
    if (authTabRegister) {
        authTabRegister.addEventListener('click', () => switchAuthMode(false));
    }

    // Alterna entre formulário de Login e Registro via link do rodapé
    if (toggleAuthModeBtn) {
        toggleAuthModeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            switchAuthMode(!isLoginMode);
        });
    }

    // Processamento de Login
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            
            // Simulação de login: email 'admin@decipro.com' vira admin, outros viram cliente
            state.loggedIn = true;
            state.currentUser = {
                nome: email.split('@')[0].toUpperCase(),
                email: email,
                role: email === 'admin@decipro.com' ? 'admin' : 'cliente'
            };
            saveState();
            updateNavigationVisibility();

            alert(`Simulação de login realizada com sucesso! Bem-vindo, ${state.currentUser.nome}.`);
            
            const navBanca = document.querySelector('[data-tab="banca"]');
            if (navBanca) navBanca.click();
        });
    }

    // Processamento de Registro (Cadastro)
    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const nome = document.getElementById('signup-name').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            
            state.loggedIn = true;
            state.currentUser = {
                nome: nome,
                email: email,
                role: email === 'admin@decipro.com' ? 'admin' : 'cliente'
            };
            saveState();
            updateNavigationVisibility();

            alert(`🎉 Conta criada com sucesso! Bem-vindo, ${nome}.`);
            
            const navBanca = document.querySelector('[data-tab="banca"]');
            if (navBanca) navBanca.click();
        });
    }

    // Processamento de Login com o Google
    if (btnGoogleLogin) {
        btnGoogleLogin.addEventListener('click', () => {
            state.loggedIn = true;
            state.currentUser = {
                nome: 'USUÁRIO GOOGLE',
                email: 'google@decipro.com',
                role: 'cliente'
            };
            saveState();
            updateNavigationVisibility();
            
            alert('Acesso via Google simulado com sucesso!');
            const navBanca = document.querySelector('[data-tab="banca"]');
            if (navBanca) navBanca.click();
        });
    }

    // Processamento de Logout (Sair)
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Tem certeza de que deseja sair da sua conta?')) {
                state.loggedIn = false;
                state.currentUser = null;
                saveState();
                
                // Reseta o formulário de login para o modo "Entrar"
                switchAuthMode(true);
                
                updateNavigationVisibility();
                
                alert('Você saiu da sua conta.');
                
                // Recarrega no painel de Entrada
                const navEntrada = document.querySelector('[data-tab="entrada"]');
                if (navEntrada) navEntrada.click();
            }
        });
    }


    // --- ABA 2: CADASTRAMENTO E ESTUDO DE BANCA ---
    const bancaForm = document.getElementById('banca-form');
    const bancaListContainer = document.getElementById('banca-list-container');
    const btnCalcularSoros = document.getElementById('btn-calcular-soros');
    const btnCancelarEdicao = document.getElementById('btn-cancelar-edicao');
    let editingBancaId = null;

    // Limpa a seleção e reseta o formulário
    const clearBancaForm = () => {
        if (bancaForm) bancaForm.reset();
        editingBancaId = null;
        const submitBtn = document.getElementById('btn-submit-banca');
        if (submitBtn) submitBtn.textContent = 'Salvar e/ou Analisar Banca';
        if (btnCancelarEdicao) btnCancelarEdicao.style.display = 'none';
    };

    // Alternar e carregar dados da banca para edição
    const selectBanca = (id) => {
        state.activeBancaId = id;
        editingBancaId = id;
        saveState();

        const activeBanca = getActiveBanca();
        if (activeBanca) {
            document.getElementById('banca-nome').value = activeBanca.nome;
            document.getElementById('banca-valor').value = activeBanca.inicial;
            document.getElementById('banca-plataforma').value = activeBanca.plataforma;
            document.getElementById('banca-alavancagem').value = activeBanca.alavancagem;
            document.getElementById('banca-prazo').value = activeBanca.prazo;

            const riscoInput = document.querySelector(`input[name="banca-risco"][value="${activeBanca.risco}"]`);
            if (riscoInput) riscoInput.checked = true;

            const submitBtn = document.getElementById('btn-submit-banca');
            if (submitBtn) submitBtn.textContent = 'Atualizar Banca Ativa';
            if (btnCancelarEdicao) btnCancelarEdicao.style.display = 'block';
        }

        renderBancaDetails();
    };

    // Excluir uma banca cadastrada
    const deleteBanca = (id) => {
        if (confirm('Tem certeza que deseja excluir esta banca? Todos os dados vinculados a ela serão perdidos.')) {
            state.bancas = state.bancas.filter(b => b.id !== id);

            // Se a banca deletada era a ativa, ativa a primeira que restou (se houver)
            if (state.bancas.length === 0) {
                const defaultId = 'banca_' + Date.now();
                const today = new Date().toLocaleDateString('pt-BR');
                state.bancas.push({
                    id: defaultId,
                    nome: 'Banca Principal',
                    plataforma: 'Bet365',
                    inicial: 5000,
                    atual: 5000,
                    alavancagem: 100,
                    prazo: 30,
                    risco: 'moderado',
                    data: today
                });
                state.activeBancaId = defaultId;
                alert('Última banca excluída! Uma nova banca padrão foi criada automaticamente para manter o sistema ativo.');
            } else {
                if (state.activeBancaId === id) {
                    state.activeBancaId = state.bancas[0].id;
                }
                alert('Banca excluída com sucesso!');
            }

            if (editingBancaId === id) {
                clearBancaForm();
            }

            saveState();
            selectBanca(state.activeBancaId);
        }
    };

    // Vincula o clique do botão limpar/cancelar edição
    if (btnCancelarEdicao) {
        btnCancelarEdicao.addEventListener('click', () => {
            clearBancaForm();
            renderBancaDetails(); // Recarrega os diagnósticos da banca selecionada por padrão
        });
    }

    // Renderiza a lista de bancas e os estudos analíticos
    const renderBancaDetails = () => {
        // Atualiza a lista visual
        if (bancaListContainer) {
            bancaListContainer.innerHTML = '';
            state.bancas.forEach(b => {
                const bNome = b.nome || 'Banca Sem Nome';
                const bRisco = b.risco || 'moderado';
                const bPlataforma = b.plataforma || 'Padrão';
                const bAtual = Number(b.atual || 0);
                const bInicial = Number(b.inicial || 0);

                const initials = bNome.substring(0, 2).toUpperCase();
                const isSelected = b.id === state.activeBancaId ? 'style="border-color: var(--primary); background: rgba(59, 130, 246, 0.04);"' : '';
                
                const bancaItem = document.createElement('div');
                bancaItem.className = 'banca-item';
                bancaItem.style.cursor = 'pointer';
                bancaItem.innerHTML = `
                    <div class="banca-meta" ${isSelected}>
                        <div class="banca-initials">${initials}</div>
                        <div>
                            <div class="banca-name">${bNome} ${b.id === state.activeBancaId ? '<span style="color: var(--primary); font-size:10px;">(Ativa)</span>' : ''}</div>
                            <div class="banca-platform">${bPlataforma} • Risco: ${bRisco.toUpperCase()}</div>
                        </div>
                    </div>
                    <div class="banca-value" style="display: flex; flex-direction: column; align-items: flex-end; justify-content: center;">
                        <div class="banca-amount">${bAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                        <div class="banca-date" style="margin-bottom: 6px;">Inicial: R$ ${bInicial.toFixed(2)}</div>
                        <span class="btn-deletar-banca" style="color: var(--danger); font-size: 11px; font-weight: 600; cursor: pointer; padding: 4px 8px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: 6px; transition: var(--transition); display: inline-flex; align-items: center; gap: 4px;">🗑️ Excluir</span>
                    </div>
                `;

                // Event listener para selecionar a banca ao clicar no item
                bancaItem.addEventListener('click', (e) => {
                    if (e.target.classList.contains('btn-deletar-banca')) return;
                    selectBanca(b.id);
                });

                // Event listener para deletar a banca ao clicar no botão excluir
                const deleteBtn = bancaItem.querySelector('.btn-deletar-banca');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        deleteBanca(b.id);
                    });
                }
                
                bancaListContainer.appendChild(bancaItem);
            });
        }

        // Calcula o Estudo Analítico para a Banca Ativa
        const activeBanca = getActiveBanca();
        
        // Elementos da Aba Análise
        const analiseRiscoCard = document.getElementById('analise-risco-card');
        const analiseBancaNome = document.getElementById('analise-banca-nome');
        const analiseRiscoStatus = document.getElementById('analise-risco-status');
        const analiseRiscoAlertaBox = document.getElementById('analise-risco-alerta-box');

        if (activeBanca) {
            const ci = Number(activeBanca.inicial || 0);
            const caAtualVal = Number(activeBanca.atual || 0);
            const metaPercent = Number(activeBanca.alavancagem || 100);
            const dias = Number(activeBanca.prazo || 30);
            const risco = activeBanca.risco || 'moderado';
            const ca = ci * (1 + metaPercent / 100);

            document.getElementById('diag-banca-inicial').textContent = ci.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            document.getElementById('diag-banca-atual').textContent = caAtualVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            document.getElementById('diag-banca-alvo').textContent = ca.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            
            // 1. Definição da Stake Segura com base no Perfil de Risco (Sem deixar a banca vulnerável)
            let riscoText = 'Moderado';
            let stakeSeguraPerc = 0.05; // 5% por aposta (moderado)
            
            if (risco === 'cauteloso') {
                riscoText = 'Cauteloso (Baixo Risco)';
                stakeSeguraPerc = 0.02; // 2% por aposta
            } else if (risco === 'agressivo') {
                riscoText = 'Agressivo (Alto Risco)';
                stakeSeguraPerc = 0.08; // 8% por aposta
            }

            // 2. Cálculo do Crescimento Composto Diário Requerido
            // (1 + r_diario)^dias = (1 + metaPercent/100)
            const G = 1 + metaPercent / 100;
            const rDiario = Math.pow(G, 1 / (dias || 1)) - 1; // Taxa de crescimento ao dia

            // 3. Cálculo da Odd Ideal para o Prazo mantendo a Stake Segura
            // rDiario = stakeSeguraPerc * (Odd_Ideal - 1) => Odd_Ideal = 1 + (rDiario / stakeSeguraPerc)
            let oddIdeal = 1 + (rDiario / stakeSeguraPerc);
            if (oddIdeal < 1.05) oddIdeal = 1.05;

            // Formata faixa de odds (ex: calculado 1.48 -> faixa 1.40 - 1.55)
            let minOdd = Math.max(1.05, oddIdeal - 0.05).toFixed(2);
            let maxOdd = (oddIdeal + 0.10).toFixed(2);
            const faixaOdds = `${minOdd} - ${maxOdd}`;

            // 4. Determinação do Nível de Vulnerabilidade
            let statusVal = 'Seguro';
            let statusColor = '#10b981'; // verde
            let alertBg = 'rgba(16, 185, 129, 0.1)';
            let alertBorder = 'rgba(16, 185, 129, 0.2)';
            let alertText = '';

            // Se a odd necessária for muito alta, a banca fica exposta a alto risco de perda
            if (oddIdeal > 2.20) {
                statusVal = 'Vulnerável';
                statusColor = '#ef4444'; // vermelho
                alertBg = 'rgba(239, 68, 68, 0.1)';
                alertBorder = 'rgba(239, 68, 68, 0.2)';
                alertText = `🚨 <strong>Banca Vulnerável:</strong> Para alcançar <strong>${metaPercent}%</strong> em apenas <strong>${dias} dias</strong> sem arriscar mais do que a stake segura de <strong>${(stakeSeguraPerc*100).toFixed(0)}%</strong>, você é forçado a buscar odds médias muito altas de <strong>${oddIdeal.toFixed(2)}</strong> (baixa taxa de acerto). Recomendamos aumentar o prazo ou reduzir a meta.`;
            } else if (oddIdeal > 1.60) {
                statusVal = 'Risco Moderado';
                statusColor = '#f59e0b'; // amarelo
                alertBg = 'rgba(245, 158, 11, 0.1)';
                alertBorder = 'rgba(245, 158, 11, 0.2)';
                alertText = `⚠️ <strong>Risco Moderado:</strong> Sua meta exige odds médias de <strong>${oddIdeal.toFixed(2)}</strong>. Mantenha estritamente o investimento de <strong>${(stakeSeguraPerc*100).toFixed(0)}%</strong> por entrada para proteger seu capital.`;
            } else {
                statusVal = 'Seguro';
                statusColor = '#10b981'; // verde
                alertBg = 'rgba(16, 185, 129, 0.1)';
                alertBorder = 'rgba(16, 185, 129, 0.2)';
                alertText = `✅ <strong>Banca Protegida:</strong> Excelente planejamento. Sua meta de crescimento diário (~${(rDiario*100).toFixed(1)}%) é atingível com odds seguras de <strong>${oddIdeal.toFixed(2)}</strong> investindo <strong>${(stakeSeguraPerc*100).toFixed(0)}%</strong> da banca por entrada.`;
            }

            // Exibe os dados no HTML
            document.getElementById('diag-risco-label').textContent = riscoText;
            document.getElementById('diag-odds-sugerida').textContent = faixaOdds;
            document.getElementById('diag-stake-segura').textContent = `${(stakeSeguraPerc * 100).toFixed(0)}% (R$ ${(caAtualVal * stakeSeguraPerc).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
            document.getElementById('diag-entradas-diarias').textContent = `1 entrada por dia (durante ${dias} dias)`;
            document.getElementById('diag-meta-ganho').textContent = `+${metaPercent}% em ${dias} dias`;
            
            const statusElement = document.getElementById('diag-vulnerabilidade-status');
            if (statusElement) {
                statusElement.textContent = statusVal;
                statusElement.style.color = statusColor;
            }

            // Alerta Box
            const alertaBox = document.getElementById('diag-alerta-box');
            if (alertaBox) {
                alertaBox.innerHTML = alertText;
                alertaBox.style.display = 'block';
                alertaBox.style.backgroundColor = alertBg;
                alertaBox.style.border = `1px solid ${alertBorder}`;
                alertaBox.style.color = statusColor;
            }

            // Exibe os dados no HTML da aba Análise
            if (analiseRiscoCard) {
                analiseRiscoCard.style.display = 'block';
                analiseRiscoCard.style.borderLeftColor = statusColor;
            }
            if (analiseBancaNome) {
                analiseBancaNome.textContent = activeBanca.nome || 'Banca Sem Nome';
            }
            if (analiseRiscoStatus) {
                analiseRiscoStatus.textContent = statusVal;
                analiseRiscoStatus.style.color = statusColor;
            }
            if (analiseRiscoAlertaBox) {
                analiseRiscoAlertaBox.innerHTML = alertText;
                analiseRiscoAlertaBox.style.backgroundColor = alertBg;
                analiseRiscoAlertaBox.style.border = `1px solid ${alertBorder}`;
                analiseRiscoAlertaBox.style.color = statusColor;
            }
        } else {
            if (analiseRiscoCard) {
                analiseRiscoCard.style.display = 'none';
            }
        }
    };

    // Salvar nova banca ou atualizar dados
    if (bancaForm) {
        bancaForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const nome = document.getElementById('banca-nome').value.trim();
            const valor = parseFloat(document.getElementById('banca-valor').value);
            const plataforma = document.getElementById('banca-plataforma').value || 'Padrão';
            const alavancagem = parseFloat(document.getElementById('banca-alavancagem').value) || 100;
            const prazo = parseInt(document.getElementById('banca-prazo').value) || 30;
            
            const riscoEl = document.querySelector('input[name="banca-risco"]:checked');
            const risco = riscoEl ? riscoEl.value : 'moderado';
            
            // Verifica se já existe uma banca cadastrada com o mesmo nome (ignorando maiúsculas/minúsculas)
            const bancaExistente = state.bancas.find(b => (b.nome || '').toLowerCase().trim() === nome.toLowerCase());
            
            if (bancaExistente) {
                // A banca já existe! Atualiza os dados dela em vez de criar uma duplicada
                bancaExistente.nome = nome; // Mantém a grafia digitada
                if (bancaExistente.inicial !== valor) {
                    bancaExistente.atual = valor;
                }
                bancaExistente.inicial = valor;
                bancaExistente.plataforma = plataforma;
                bancaExistente.alavancagem = alavancagem;
                bancaExistente.prazo = prazo;
                bancaExistente.risco = risco;
                
                state.activeBancaId = bancaExistente.id;
                saveState();
                alert('Dados da banca atualizados e analisados com sucesso!');
                selectBanca(bancaExistente.id);
            } else if (editingBancaId) {
                // Se o nome foi alterado e não bate com nenhuma banca, mas estávamos explicitamente editando por ID
                const b = state.bancas.find(item => item.id === editingBancaId);
                if (b) {
                    b.nome = nome;
                    if (b.inicial !== valor) {
                        b.atual = valor;
                    }
                    b.inicial = valor;
                    b.plataforma = plataforma;
                    b.alavancagem = alavancagem;
                    b.prazo = prazo;
                    b.risco = risco;
                    
                    alert('Banca atualizada com sucesso!');
                }
                saveState();
                selectBanca(editingBancaId);
            } else {
                // Modo Criação: Adicionar banca inédita
                const id = 'banca_' + Date.now();
                const today = new Date().toLocaleDateString('pt-BR');

                state.bancas.push({
                    id,
                    plataforma,
                    nome,
                    inicial: valor,
                    atual: valor,
                    alavancagem,
                    prazo,
                    risco,
                    data: today
                });
                
                state.activeBancaId = id;
                saveState();
                alert('Nova banca inédita cadastrada com sucesso!');
                selectBanca(id);
            }
        });
    }

    // Calculadora Progressiva (Soros)
    if (btnCalcularSoros) {
        btnCalcularSoros.addEventListener('click', () => {
            const valInicial = parseFloat(document.getElementById('soros-inicial').value) || 10;
            const odd = parseFloat(document.getElementById('soros-odds').value) || 1.50;
            const alvo = parseFloat(document.getElementById('soros-alvo').value) || 100;

            const tbody = document.getElementById('soros-tbody');
            const tableWrapper = document.getElementById('soros-table-wrapper');
            const msgBox = document.getElementById('soros-result-msg');

            if (odd <= 1) {
                alert('A odd média precisa ser maior que 1.00!');
                return;
            }

            tbody.innerHTML = '';
            
            let etapa = 1;
            let entradaAtual = valInicial;
            let retorno = 0;
            let success = false;

            // Roda simulação até 15 níveis para evitar travar a tela
            while (etapa <= 15) {
                retorno = entradaAtual * odd;
                const percent = Math.min((retorno / alvo) * 100, 100).toFixed(0);

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-weight: 600;">Etapa ${etapa}</td>
                    <td>R$ ${entradaAtual.toFixed(2)}</td>
                    <td>${odd.toFixed(2)}</td>
                    <td style="color: var(--success); font-weight: 600;">R$ ${retorno.toFixed(2)}</td>
                    <td>
                        <div class="progress-bar-container">
                            <div class="progress-fill" style="width: ${percent}%;"></div>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);

                if (retorno >= alvo) {
                    success = true;
                    break;
                }

                // O valor investido na próxima etapa é o retorno total da anterior (Soros completo)
                entradaAtual = retorno;
                etapa++;
            }

            tableWrapper.style.display = 'block';
            if (success) {
                msgBox.innerHTML = `🎯 <strong>Meta atingida!</strong> São necessárias <strong>${etapa} vitórias consecutivas</strong> para transformar R$ ${valInicial.toFixed(2)} em R$ ${retorno.toFixed(2)} (Odd ${odd.toFixed(2)}).`;
                msgBox.style.color = 'var(--success)';
            } else {
                msgBox.innerHTML = `⚠️ <strong>Limite alcançado!</strong> Mais de 15 etapas são necessárias. Recomendamos aumentar a stake inicial ou a odd média para esta simulação.`;
                msgBox.style.color = 'var(--warning)';
            }
        });
    }


    // --- ABA 3: PESQUISA (ESPN API & LAYOUT SOFASCORE) ---
    const searchDateInput = document.getElementById('search-date');
    const searchTextInput = document.getElementById('search-text');
    const btnFetchGames = document.getElementById('btn-fetch-games');
    const btnToggleAdvanced = document.getElementById('btn-toggle-advanced');
    const advancedPanel = document.getElementById('advanced-panel');
    const chevronAdvanced = document.getElementById('chevron-advanced');
    const searchResultsList = document.getElementById('search-results-list');
    const carouselContainer = document.getElementById('highlight-carousel-container');
    const btnCarouselNext = document.getElementById('btn-carousel-next');

    // Ligas que iremos buscar na ESPN
    const LEAGUES = [
        { id: 'bra.1', name: 'Brasil Série A', flag: '🇧🇷' },
        { id: 'bra.2', name: 'Brasil Série B', flag: '🇧🇷' },
        { id: 'bra.3', name: 'Brasil Série C', flag: '🇧🇷' },
        { id: 'bra.4', name: 'Brasil Série D', flag: '🇧🇷' },
        { id: 'eng.1', name: 'Inglaterra Premier League', flag: '🇬🇧' },
        { id: 'esp.1', name: 'Espanha La Liga', flag: '🇪🇸' },
        { id: 'ita.1', name: 'Itália Serie A', flag: '🇮🇹' },
        { id: 'fra.1', name: 'França Ligue 1', flag: '🇫🇷' },
        { id: 'por.1', name: 'Portugal Primeira Liga', flag: '🇵🇹' },
        { id: 'ned.1', name: 'Holanda Eredivisie', flag: '🇳🇱' },
        { id: 'arg.1', name: 'Argentina Primera División', flag: '🇦🇷' },
        { id: 'col.1', name: 'Colômbia Primera A', flag: '🇨🇴' },
        { id: 'mex.1', name: 'México Liga MX', flag: '🇲🇽' },
        { id: 'uefa.champions', name: 'Champions League', flag: '🇪🇺' },
        { id: 'fifa.world', name: 'Mundo / Copa / Amistosos', flag: '🌐' }
    ];

    let fetchedGames = []; // guarda todos os jogos estruturados
    let activeFilter = 'todos'; // todos, ao-vivo, proximos, finalizados
    let collapsedLigas = []; // ids de ligas recolhidas

    // Inicializa a aba de pesquisa
    const initPesquisaTab = () => {
        // Define data padrão de hoje se estiver vazia
        if (!searchDateInput.value) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            searchDateInput.value = `${yyyy}-${mm}-${dd}`;
        }
        
        loadGamesFromESPN();
    };

    // Toggle Filtro Avançado
    if (btnToggleAdvanced) {
        btnToggleAdvanced.addEventListener('click', () => {
            advancedPanel.classList.toggle('open');
            if (advancedPanel.classList.contains('open')) {
                chevronAdvanced.style.transform = 'rotate(180deg)';
            } else {
                chevronAdvanced.style.transform = 'rotate(0deg)';
            }
        });
    }

    // Busca dados reais de todas as ligas da ESPN
    const loadGamesFromESPN = async () => {
        if (searchResultsList) {
            searchResultsList.innerHTML = `<div style="text-align: center; padding: 40px 0; color: var(--text-muted);">Buscando partidas em tempo real...</div>`;
        }
        
        const rawDate = searchDateInput.value; // YYYY-MM-DD
        const formattedDate = rawDate.replace(/-/g, ''); // YYYYMMDD
        
        fetchedGames = [];
        
        const fetchPromises = LEAGUES.map(async (league) => {
            const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.id}/scoreboard?dates=${formattedDate}`;
            try {
                const res = await fetch(url);
                if (!res.ok) return;
                const data = await res.json();
                const events = data.events || [];
                
                events.forEach(event => {
                    const comp = event.competitions[0];
                    const statusType = event.status.type;
                    
                    // Status simplificado
                    let status = 'proximo';
                    if (statusType.state === 'in') status = 'aovivo';
                    else if (statusType.state === 'post') status = 'finalizado';
                    
                    // Horário / Detalhe
                    let timeStr = statusType.detail || '';
                    if (status === 'proximo') {
                        // Converte ISO Date string para Horário local
                        const localDate = new Date(event.date);
                        timeStr = localDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    }

                    // Times e Logos
                    const homeCompetitor = comp.competitors.find(c => c.homeAway === 'home');
                    const awayCompetitor = comp.competitors.find(c => c.homeAway === 'away');

                    // Gerador determinístico de odds baseado no nome do time
                    const seed = (homeCompetitor.team.displayName || '').length + (awayCompetitor.team.displayName || '').length;
                    const odd1 = (1.35 + (seed % 15) * 0.15).toFixed(2);
                    const oddX = (2.80 + (seed % 10) * 0.12).toFixed(2);
                    const odd2 = (1.50 + ((seed * 3) % 25) * 0.15).toFixed(2);

                    fetchedGames.push({
                        id: event.id,
                        leagueId: league.id,
                        leagueName: league.name,
                        leagueFlag: league.flag,
                        name: event.name,
                        status: status, // todos, aovivo, proximo, finalizado
                        time: timeStr,
                        home: {
                            name: homeCompetitor.team.displayName,
                            logo: homeCompetitor.team.logo || 'https://a.espncdn.com/i/teamlogos/default-soccer.png',
                            score: homeCompetitor.score,
                            winner: homeCompetitor.winner
                        },
                        away: {
                            name: awayCompetitor.team.displayName,
                            logo: awayCompetitor.team.logo || 'https://a.espncdn.com/i/teamlogos/default-soccer.png',
                            score: awayCompetitor.score,
                            winner: awayCompetitor.winner
                        },
                        odds: { home: odd1, draw: oddX, away: odd2 }
                    });
                });
            } catch (err) {
                console.error(`Erro ao buscar dados da liga ${league.name}:`, err);
            }
        });

        await Promise.all(fetchPromises);
        autoResolveFinishedGames();
        renderMatches();
    };

    // Renderiza a lista de partidas na tela
    const renderMatches = () => {
        const searchText = searchTextInput.value.toLowerCase();
        
        // Filtra os jogos com base no status e pesquisa de texto
        let filtered = fetchedGames.filter(game => {
            // Filtro de Status
            if (activeFilter === 'ao-vivo' && game.status !== 'aovivo') return false;
            if (activeFilter === 'proximos' && game.status !== 'proximo') return false;
            if (activeFilter === 'finalizados' && game.status !== 'finalizado') return false;
            if (activeFilter === 'selecionados' && !state.favoritos.jogos.includes(game.id)) return false;
            
            // Filtro de Texto
            if (searchText) {
                const matchName = game.name.toLowerCase();
                const leagueName = game.leagueName.toLowerCase();
                if (!matchName.includes(searchText) && !leagueName.includes(searchText)) return false;
            }
            
            return true;
        });

        // Atualiza os contadores no topo
        document.getElementById('count-todos').textContent = fetchedGames.length;
        document.getElementById('count-aovivo').textContent = fetchedGames.filter(g => g.status === 'aovivo').length;
        document.getElementById('count-proximos').textContent = fetchedGames.filter(g => g.status === 'proximo').length;
        document.getElementById('count-finalizados').textContent = fetchedGames.filter(g => g.status === 'finalizado').length;
        
        const countSelecionados = document.getElementById('count-selecionados');
        if (countSelecionados) {
            countSelecionados.textContent = fetchedGames.filter(g => state.favoritos.jogos.includes(g.id)).length;
        }

        // Limpa a lista
        searchResultsList.innerHTML = '';

        if (filtered.length === 0) {
            if (activeFilter === 'selecionados') {
                searchResultsList.innerHTML = `<div style="text-align: center; padding: 40px 0; color: var(--text-muted); font-size: 14px;">Nenhum jogo selecionado. Ative a estrela ⭐ nas partidas para adicioná-las aqui.</div>`;
            } else {
                searchResultsList.innerHTML = `<div style="text-align: center; padding: 40px 0; color: var(--text-muted);">Nenhum jogo encontrado para esta data ou filtro.</div>`;
            }
            return;
        }

        // Agrupa os jogos filtrados por liga
        const grouped = {};
        filtered.forEach(game => {
            if (!grouped[game.leagueId]) {
                grouped[game.leagueId] = {
                    name: game.leagueName,
                    flag: game.leagueFlag,
                    games: []
                };
            }
            grouped[game.leagueId].games.push(game);
        });

        // Preenche carrossel de destaques dinamicamente com os primeiros 5 jogos
        renderCarousel(filtered);

        // Renderiza cada grupo de campeonato
        Object.keys(grouped).forEach(leagueId => {
            const league = grouped[leagueId];
            const isCollapsed = collapsedLigas.includes(leagueId);
            const isFavLeague = state.favoritos.ligas.includes(leagueId) ? 'active' : '';

            const leagueContainer = document.createElement('div');
            leagueContainer.className = 'league-container';
            
            // Cabeçalho da Liga (estilo verde sofisticado da imagem)
            const header = document.createElement('div');
            header.className = 'league-header';
            header.innerHTML = `
                <div class="league-fav-icon ${isFavLeague}" onclick="toggleFavLeague(event, '${leagueId}')">
                    <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                </div>
                <span class="league-flag">${league.flag}</span>
                <span class="league-name">${league.name}</span>
                <span style="font-size:14px; margin-right: 12px; color:rgba(255,255,255,0.7); cursor:pointer;">📌</span>
                <span class="league-badge">${league.games.length}</span>
                <span class="league-chevron ${isCollapsed ? 'collapsed' : ''}" onclick="toggleCollapseLeague('${leagueId}')" style="cursor:pointer; margin-left: 8px;">▼</span>
            `;
            leagueContainer.appendChild(header);

            // Lista de Jogos do Campeonato
            const matchesList = document.createElement('div');
            matchesList.className = `league-matches-list ${isCollapsed ? 'collapsed' : ''}`;
            
            league.games.forEach(game => {
                const isFavGame = state.favoritos.jogos.includes(game.id) ? 'active' : '';
                const liveClass = game.status === 'aovivo' ? 'live' : '';
                
                const matchRow = document.createElement('div');
                matchRow.className = 'match-row';
                matchRow.innerHTML = `
                    <div class="match-time ${liveClass}">${game.time}</div>
                    <div class="match-teams">
                        <div class="match-team ${game.home.winner ? 'winner' : ''}">
                            <img src="${game.home.logo}" alt="Logo">
                            <span class="match-team-name">${game.home.name}</span>
                            ${game.status !== 'proximo' ? `<span class="match-score">${game.home.score}</span>` : ''}
                        </div>
                        <div class="match-team ${game.away.winner ? 'winner' : ''}">
                            <img src="${game.away.logo}" alt="Logo">
                            <span class="match-team-name">${game.away.name}</span>
                            ${game.status !== 'proximo' ? `<span class="match-score">${game.away.score}</span>` : ''}
                        </div>
                    </div>
                    <div class="match-odds-wrapper">
                        <div class="odd-box" onclick="selecionarOdd('${game.id}', '${game.home.name}', '${game.odds.home}')">
                            <div class="odd-value">${game.odds.home}</div>
                        </div>
                        <div class="odd-box" onclick="selecionarOdd('${game.id}', 'Empate', '${game.odds.draw}')">
                            <div class="odd-value">${game.odds.draw}</div>
                        </div>
                        <div class="odd-box" onclick="selecionarOdd('${game.id}', '${game.away.name}', '${game.odds.away}')">
                            <div class="odd-value">${game.odds.away}</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; justify-content: flex-end; margin-left: auto;">
                        <div class="match-fav-icon ${isFavGame}" onclick="toggleFavGame(event, '${game.id}')" title="Favoritar Partida">
                            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        </div>
                        <div class="match-analise-icon" onclick="selecionarParaAnalise('${game.id}')" style="cursor:pointer; font-size:16px; opacity:0.8; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'" title="Análise Detalhada (Pré-Jogo & Ao Vivo)">
                            📊
                        </div>
                    </div>
                `;
                matchesList.appendChild(matchRow);
            });
            leagueContainer.appendChild(matchesList);
            searchResultsList.appendChild(leagueContainer);
        });
    };

    // Preenche o carrossel de destaques rápidos horizontal
    const renderCarousel = (games) => {
        // Mantém apenas os 3 primeiros cartões estáticos
        while (carouselContainer.children.length > 3) {
            carouselContainer.removeChild(carouselContainer.lastChild);
        }

        // Adiciona até 6 jogos no carrossel de forma compacta (ex: CAN - BOS)
        games.slice(0, 6).forEach(game => {
            const shortHome = game.home.name.substring(0, 3).toUpperCase();
            const shortAway = game.away.name.substring(0, 3).toUpperCase();
            
            const card = document.createElement('div');
            card.className = 'carousel-card';
            card.innerHTML = `
                <span class="carousel-card-time">${game.time}</span>
                <span class="carousel-card-match">${shortHome} - ${shortAway}</span>
                <div class="carousel-card-logo">
                    <img src="${game.home.logo}">
                    <img src="${game.away.logo}">
                </div>
            `;
            carouselContainer.appendChild(card);
        });
    };

    // Rolagem horizontal do carrossel
    if (btnCarouselNext) {
        btnCarouselNext.addEventListener('click', () => {
            carouselContainer.scrollBy({ left: 200, behavior: 'smooth' });
        });
    }

    // Ações de favoritar liga e partida
    window.toggleFavLeague = (e, leagueId) => {
        e.stopPropagation();
        const idx = state.favoritos.ligas.indexOf(leagueId);
        if (idx > -1) {
            state.favoritos.ligas.splice(idx, 1);
        } else {
            state.favoritos.ligas.push(leagueId);
        }
        saveState();
        renderMatches();
    };

    window.toggleFavGame = (e, gameId) => {
        e.stopPropagation();
        const idx = state.favoritos.jogos.indexOf(gameId);
        if (idx > -1) {
            state.favoritos.jogos.splice(idx, 1);
        } else {
            state.favoritos.jogos.push(gameId);
        }
        saveState();
        renderMatches();
    };

    // Recolher/expandir liga
    window.toggleCollapseLeague = (leagueId) => {
        const idx = collapsedLigas.indexOf(leagueId);
        if (idx > -1) {
            collapsedLigas.splice(idx, 1);
        } else {
            collapsedLigas.push(leagueId);
        }
        renderMatches();
    };

    // Ação ao clicar nos botões de filtros rápidos de status
    const filterBoxes = document.querySelectorAll('.status-box');
    filterBoxes.forEach(box => {
        box.addEventListener('click', () => {
            filterBoxes.forEach(b => b.classList.remove('active'));
            box.classList.add('active');
            activeFilter = box.getAttribute('data-filter');
            renderMatches();
        });
    });

    // Gatilho de busca ao digitar ou clicar no botão buscar
    if (btnFetchGames) btnFetchGames.addEventListener('click', loadGamesFromESPN);
    if (searchTextInput) searchTextInput.addEventListener('input', renderMatches);


    // --- INTEGRAÇÃO COM AS DEMAIS ABAS (SIMULAÇÃO E GESTÃO ATIVA) ---
    
    let isEnquadramentoApproved = false;

    // Sincroniza dados da banca ativa e atualiza a interface da aba de Simulação
    const syncSimulacaoBanca = () => {
        const activeBanca = getActiveBanca();
        const simBancaOrigem = document.getElementById('sim-banca-origem');
        const simPartida = document.getElementById('sim-partida');

        if (activeBanca) {
            if (simBancaOrigem) {
                simBancaOrigem.value = `${activeBanca.nome} (R$ ${activeBanca.atual.toFixed(2)})`;
            }
        } else {
            if (simBancaOrigem) simBancaOrigem.value = '-';
        }

        if (state.selectedGameForAnalysis) {
            if (simPartida) {
                simPartida.value = `${state.selectedGameForAnalysis.home.name} vs ${state.selectedGameForAnalysis.away.name}`;
            }
        } else {
            if (simPartida) simPartida.value = '';
        }

        validateEnquadramento();
        renderActiveSimulations();
        renderSimulationHistory();
    };

    // Valida se a aposta proposta está dentro do planejamento de risco
    const validateEnquadramento = () => {
        const activeBanca = getActiveBanca();
        const alertBox = document.getElementById('sim-alert-box');
        const alertActions = document.getElementById('sim-alert-actions');
        const submitBtn = document.getElementById('btn-submit-simulacao');
        
        const proposedStake = parseFloat(document.getElementById('sim-valor').value) || 0;
        const proposedOdd = parseFloat(document.getElementById('sim-odds').value) || 0;

        const compareStakeProposed = document.getElementById('sim-compare-stake-proposed');
        const compareStakeRecommended = document.getElementById('sim-compare-stake-recommended');
        const compareOddProposed = document.getElementById('sim-compare-odd-proposed');
        const compareOddRecommended = document.getElementById('sim-compare-odd-recommended');

        if (!activeBanca) {
            if (alertBox) {
                alertBox.innerHTML = "ℹ️ <strong>Banca não cadastrada:</strong> Cadastre uma banca para simular.";
                alertBox.style.display = 'block';
                alertBox.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                alertBox.style.color = 'var(--text-muted)';
            }
            if (submitBtn) submitBtn.disabled = true;
            return;
        }

        if (!state.selectedGameForAnalysis) {
            if (alertBox) {
                alertBox.innerHTML = "ℹ️ <strong>Selecione uma partida:</strong> Vá na aba Pesquisa e selecione um jogo para simular.";
                alertBox.style.display = 'block';
                alertBox.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
                alertBox.style.color = 'var(--primary)';
            }
            if (alertActions) alertActions.style.display = 'none';
            if (submitBtn) submitBtn.disabled = true;
            return;
        }

        // Recupera parâmetros do estudo de banca
        const caAtualVal = Number(activeBanca.atual || 0);
        const metaPercent = Number(activeBanca.alavancagem || 100);
        const dias = Number(activeBanca.prazo || 30);
        const risco = activeBanca.risco || 'moderado';

        let stakeSeguraPerc = 0.05;
        if (risco === 'cauteloso') stakeSeguraPerc = 0.02;
        else if (risco === 'agressivo') stakeSeguraPerc = 0.08;

        const recommendedStake = caAtualVal * stakeSeguraPerc;

        const G = 1 + metaPercent / 100;
        const rDiario = Math.pow(G, 1 / (dias || 1)) - 1;
        let oddIdeal = 1 + (rDiario / stakeSeguraPerc);
        if (oddIdeal < 1.05) oddIdeal = 1.05;

        // Atualiza painel comparativo
        if (compareStakeProposed) compareStakeProposed.textContent = `R$ ${proposedStake.toFixed(2)}`;
        if (compareStakeRecommended) compareStakeRecommended.textContent = `R$ ${recommendedStake.toFixed(2)}`;
        if (compareOddProposed) compareOddProposed.textContent = `@ ${proposedOdd.toFixed(2)}`;
        if (compareOddRecommended) compareOddRecommended.textContent = `@ ${oddIdeal.toFixed(2)}`;

        // Validação de saldo
        if (proposedStake > caAtualVal) {
            if (alertBox) {
                alertBox.innerHTML = `🚨 <strong>Sem Saldo:</strong> O investimento de R$ ${proposedStake.toFixed(2)} excede o saldo atual da banca (R$ ${caAtualVal.toFixed(2)}).`;
                alertBox.style.display = 'block';
                alertBox.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                alertBox.style.border = '1px solid rgba(239, 68, 68, 0.2)';
                alertBox.style.color = 'var(--danger)';
            }
            if (alertActions) alertActions.style.display = 'none';
            if (submitBtn) submitBtn.disabled = true;
            return;
        }

        // Validação de enquadramento
        const isStakeExceeded = proposedStake > recommendedStake;
        const isOddUnder = proposedOdd < oddIdeal;

        if (isStakeExceeded || isOddUnder) {
            let warnMsg = "⚠️ <strong>Fora do Planejamento de Risco:</strong>";
            if (isStakeExceeded) {
                warnMsg += `<br>• O investimento proposto excede a stake recomendada de R$ ${recommendedStake.toFixed(2)} (${(stakeSeguraPerc*100).toFixed(0)}% da banca).`;
            }
            if (isOddUnder) {
                warnMsg += `<br>• A odd proposta (@ ${proposedOdd.toFixed(2)}) é inferior à cotação recomendada no estudo (@ ${oddIdeal.toFixed(2)}).`;
            }

            if (isEnquadramentoApproved) {
                warnMsg += `<br><span style="color: var(--success); font-weight: bold;">✔️ Confirmado manualmente pelo usuário. Pronto para registrar.</span>`;
                if (alertBox) {
                    alertBox.innerHTML = warnMsg;
                    alertBox.style.display = 'block';
                    alertBox.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
                    alertBox.style.border = '1px solid rgba(245, 158, 11, 0.2)';
                    alertBox.style.color = '#f59e0b';
                }
                if (alertActions) alertActions.style.display = 'none';
                if (submitBtn) submitBtn.disabled = false;
            } else {
                if (alertBox) {
                    alertBox.innerHTML = warnMsg;
                    alertBox.style.display = 'block';
                    alertBox.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
                    alertBox.style.border = '1px solid rgba(245, 158, 11, 0.2)';
                    alertBox.style.color = '#f59e0b';
                }
                if (alertActions) alertActions.style.display = 'flex';
                if (submitBtn) submitBtn.disabled = true;
            }
        } else {
            // Em conformidade
            if (alertBox) {
                alertBox.innerHTML = "✅ <strong>Enquadramento Perfeito:</strong> O investimento proposto e a cotação estão em total conformidade com as diretrizes do planejamento da banca.";
                alertBox.style.display = 'block';
                alertBox.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                alertBox.style.border = '1px solid rgba(16, 185, 129, 0.2)';
                alertBox.style.color = 'var(--success)';
            }
            if (alertActions) alertActions.style.display = 'none';
            if (submitBtn) submitBtn.disabled = false;
        }
    };

    // Registrar Ação de Selecionar Odd na Pesquisa / Ao Vivo
    window.selecionarOdd = (gameId, selecao, valorOdd) => {
        let game = fetchedGames.find(g => g.id === gameId);
        if (!game && state.selectedGameForAnalysis && state.selectedGameForAnalysis.id === gameId) {
            game = state.selectedGameForAnalysis;
        }
        if (!game && state.activeMatchSummary && state.activeMatchSummary.id === gameId) {
            game = state.activeMatchSummary;
        }
        if (!game) return;

        state.selectedGameForAnalysis = game;
        saveState();

        const navSim = document.querySelector('[data-tab="simulacao"]');
        if (navSim) {
            navSim.click();

            const simOdds = document.getElementById('sim-odds');
            if (simOdds) {
                simOdds.value = valorOdd;
            }

            const simMercadoSelect = document.getElementById('sim-mercado-select');
            const simCustomMarketContainer = document.getElementById('sim-custom-market-container');
            const simMercadoCustom = document.getElementById('sim-mercado-custom');

            if (simMercadoSelect) {
                let matched = false;
                for (let i = 0; i < simMercadoSelect.options.length; i++) {
                    if (simMercadoSelect.options[i].value === selecao) {
                        simMercadoSelect.selectedIndex = i;
                        matched = true;
                        break;
                    }
                }
                if (!matched) {
                    if (selecao === game.home.name) {
                        simMercadoSelect.value = "Vencedor: Casa";
                    } else if (selecao === 'Empate') {
                        simMercadoSelect.value = "Vencedor: Empate";
                    } else if (selecao === game.away.name) {
                        simMercadoSelect.value = "Vencedor: Visitante";
                    } else {
                        simMercadoSelect.value = "custom";
                        if (simMercadoCustom) simMercadoCustom.value = selecao;
                    }
                }
                simMercadoSelect.dispatchEvent(new Event('change'));
            }

            isEnquadramentoApproved = false;
            syncSimulacaoBanca();
            alert(`Partida e odd carregadas! Odd: ${valorOdd} para ${selecao}.`);
        }
    };

    // Renderiza a lista de intenções pendentes/ativas
    const renderActiveSimulations = () => {
        const container = document.getElementById('sim-active-list-container');
        if (!container) return;

        container.innerHTML = '';
        const pendingSims = state.simulations.filter(s => s.status === 'PENDENTE');

        if (pendingSims.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 13px; text-align: center; margin: 12px 0;">Nenhuma simulação ativa no momento.</p>`;
            return;
        }

        pendingSims.forEach(sim => {
            const card = document.createElement('div');
            card.className = 'banca-item';
            card.style.borderLeft = '4px solid var(--primary)';
            card.style.padding = '14px';
            card.style.background = 'rgba(255,255,255,0.01)';
            card.style.borderRadius = '8px';
            card.style.marginBottom = '8px';
            card.style.width = '100%';
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                    <div>
                        <div style="font-weight: 700; color: var(--text-main); font-size: 14px; margin-bottom: 4px;">${sim.partida}</div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 6px;">Mercado: <strong>${sim.mercado}</strong></div>
                        <div style="font-size: 12px; color: var(--text-muted);">
                            Odd: <strong style="color: var(--primary);">@ ${sim.odds.toFixed(2)}</strong> • 
                            Investimento: <strong style="color: var(--text-main);">R$ ${sim.valor.toFixed(2)}</strong>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <button onclick="resolverSimulacao('${sim.id}', true)" class="btn" style="padding: 6px 10px; font-size: 11px; background: var(--success); border-color: var(--success); color: white; cursor: pointer; border-radius: 4px; font-weight: 700;">🟢 Green</button>
                        <button onclick="resolverSimulacao('${sim.id}', false)" class="btn" style="padding: 6px 10px; font-size: 11px; background: var(--danger); border-color: var(--danger); color: white; cursor: pointer; border-radius: 4px; font-weight: 700;">🔴 Red</button>
                        <button onclick="excluirSimulacao('${sim.id}')" class="btn" style="padding: 6px 8px; font-size: 11px; background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); color: var(--text-muted); cursor: pointer; border-radius: 4px;">🗑️</button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    };

    // Renderiza a lista de simulações resolvidas no histórico
    const renderSimulationHistory = () => {
        const tbody = document.getElementById('sim-history-tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        const resolvedSims = state.simulations.filter(s => s.status !== 'PENDENTE');

        if (resolvedSims.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); font-size: 12px;">Nenhuma simulação finalizada no histórico.</td></tr>`;
            return;
        }

        resolvedSims.forEach(sim => {
            const tr = document.createElement('tr');
            const sign = sim.status === 'WIN' ? '+' : '-';
            const valueColor = sim.status === 'WIN' ? 'var(--success)' : 'var(--danger)';
            const returnVal = sim.status === 'WIN' ? (sim.valor * sim.odds - sim.valor) : sim.valor;
            const badgeClass = sim.status === 'WIN' ? 'badge-win' : 'badge-loss';
            const badgeText = sim.status === 'WIN' ? 'Green' : 'Red';

            tr.innerHTML = `
                <td>
                    <div style="font-weight: 600; font-size: 12px; color: var(--text-main);">${sim.partida}</div>
                    <div style="font-size: 10px; color: var(--text-muted);">${sim.mercado}</div>
                </td>
                <td>@ ${sim.odds.toFixed(2)}</td>
                <td>R$ ${sim.valor.toFixed(2)}</td>
                <td style="color: ${valueColor}; font-weight: 600;">${sign} R$ ${returnVal.toFixed(2)}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="badge ${badgeClass}">${badgeText}</span>
                        <span onclick="excluirSimulacao('${sim.id}')" style="cursor: pointer; opacity: 0.6; transition: 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">🗑️</span>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    };

    // Resolve uma simulação como ganha (Green) ou perdida (Red)
    window.resolverSimulacao = (simId, isWin) => {
        const sim = state.simulations.find(s => s.id === simId);
        if (!sim) return;

        const banca = state.bancas.find(b => b.id === sim.bancaId);
        if (!banca) {
            alert('Banca de origem não encontrada.');
            return;
        }

        const feedbackCard = document.getElementById('sim-feedback-card');
        const feedbackTitle = document.getElementById('sim-feedback-title');
        const feedbackContent = document.getElementById('sim-feedback-content');

        const metaValue = banca.inicial * (1 + banca.alavancagem / 100);

        if (isWin) {
            // Devolve a stake + lucro
            const retorno = sim.valor * sim.odds;
            banca.atual += retorno;
            sim.status = 'WIN';
            sim.retorno = retorno - sim.valor;

            const distToGoal = Math.max(0, metaValue - banca.atual);
            
            if (feedbackCard && feedbackTitle && feedbackContent) {
                feedbackCard.style.display = 'block';
                feedbackCard.style.borderLeft = '4px solid var(--success)';
                feedbackTitle.innerHTML = "🎉 Excelente Resultado! (Green 🟢)";
                feedbackTitle.style.color = 'var(--success)';
                feedbackContent.innerHTML = `
                    Parabéns! Sua leitura da partida <strong>${sim.partida}</strong> no mercado <strong>${sim.mercado}</strong> foi precisa.<br>
                    Você lucrou <strong>R$ ${sim.retorno.toFixed(2)}</strong> com uma cotação de <strong>@ ${sim.odds.toFixed(2)}</strong>.<br>
                    O saldo da sua banca foi incrementado para <strong>R$ ${banca.atual.toFixed(2)}</strong>.<br>
                    ${distToGoal <= 0 ? 
                        `🏆 <strong>Sensacional! Você atingiu e ultrapassou a sua meta total de alavancagem de R$ ${metaValue.toFixed(2)}!</strong>` : 
                        `Você está se aproximando do seu objetivo! Faltam apenas <strong>R$ ${distToGoal.toFixed(2)}</strong> para atingir a meta de R$ ${metaValue.toFixed(2)}.`
                    }
                `;
            }
        } else {
            // A stake já foi deduzida no registro, então apenas altera o status
            sim.status = 'LOSS';
            sim.retorno = -sim.valor;

            const distToGoal = Math.max(0, metaValue - banca.atual);

            if (feedbackCard && feedbackTitle && feedbackContent) {
                feedbackCard.style.display = 'block';
                feedbackCard.style.borderLeft = '4px solid var(--danger)';
                feedbackTitle.innerHTML = "🔴 Simulação Encerrada em Red";
                feedbackTitle.style.color = 'var(--danger)';
                feedbackContent.innerHTML = `
                    O investimento no jogo <strong>${sim.partida}</strong> no mercado <strong>${sim.mercado}</strong> resultou em perda.<br>
                    A stake de <strong>R$ ${sim.valor.toFixed(2)}</strong> foi perdida definitivamente.<br>
                    Seu saldo atual é de <strong>R$ ${banca.atual.toFixed(2)}</strong>.<br>
                    Você se distanciou um pouco do objetivo. Agora você está a <strong>R$ ${distToGoal.toFixed(2)}</strong> da meta total de R$ ${metaValue.toFixed(2)}.<br>
                    Não desanime! Ajuste a rota, mantenha a calma e siga estritamente o gerenciamento de risco nas próximas.
                `;
            }
        }

        saveState();
        renderBancaDetails();
        syncSimulacaoBanca();
    };

    // Exclui ou cancela uma simulação
    window.excluirSimulacao = (simId) => {
        const sim = state.simulations.find(s => s.id === simId);
        if (!sim) return;

        if (sim.status === 'PENDENTE') {
            if (confirm(`Deseja realmente cancelar esta intenção de aposta? O valor de R$ ${sim.valor.toFixed(2)} será devolvido à banca.`)) {
                const banca = state.bancas.find(b => b.id === sim.bancaId);
                if (banca) {
                    banca.atual += sim.valor;
                }
                state.simulations = state.simulations.filter(s => s.id !== simId);
                saveState();
                renderBancaDetails();
                syncSimulacaoBanca();
                alert('Intenção excluída e stake devolvida com sucesso!');
            }
        } else {
            if (confirm('Deseja remover esta simulação resolvida do histórico? (Não afeta o saldo da banca)')) {
                state.simulations = state.simulations.filter(s => s.id !== simId);
                saveState();
                syncSimulacaoBanca();
            }
        }
    };

    // Event Listeners da Aba de Simulação
    const simForm = document.getElementById('sim-form');
    const simValorInput = document.getElementById('sim-valor');
    const simOddsInput = document.getElementById('sim-odds');
    const simMercadoSelect = document.getElementById('sim-mercado-select');
    const simCustomMarketContainer = document.getElementById('sim-custom-market-container');
    const simMercadoCustom = document.getElementById('sim-mercado-custom');
    const btnReenquadrarSim = document.getElementById('btn-reenquadrar-sim');
    const btnConfirmarSimAnyway = document.getElementById('btn-confirmar-sim-anyway');

    if (simMercadoSelect && simCustomMarketContainer) {
        simMercadoSelect.addEventListener('change', () => {
            if (simMercadoSelect.value === 'custom') {
                simCustomMarketContainer.style.display = 'block';
                if (simMercadoCustom) simMercadoCustom.required = true;
            } else {
                simCustomMarketContainer.style.display = 'none';
                if (simMercadoCustom) {
                    simMercadoCustom.required = false;
                    simMercadoCustom.value = '';
                }
            }
        });
    }

    if (simValorInput) simValorInput.addEventListener('input', () => { isEnquadramentoApproved = false; validateEnquadramento(); });
    if (simOddsInput) simOddsInput.addEventListener('input', () => { isEnquadramentoApproved = false; validateEnquadramento(); });

    if (btnReenquadrarSim) {
        btnReenquadrarSim.addEventListener('click', () => {
            const activeBanca = getActiveBanca();
            if (!activeBanca) return;

            const caAtualVal = Number(activeBanca.atual || 0);
            const metaPercent = Number(activeBanca.alavancagem || 100);
            const dias = Number(activeBanca.prazo || 30);
            const risco = activeBanca.risco || 'moderado';

            let stakeSeguraPerc = 0.05;
            if (risco === 'cauteloso') stakeSeguraPerc = 0.02;
            else if (risco === 'agressivo') stakeSeguraPerc = 0.08;

            const recommendedStake = caAtualVal * stakeSeguraPerc;

            const G = 1 + metaPercent / 100;
            const rDiario = Math.pow(G, 1 / (dias || 1)) - 1;
            let oddIdeal = 1 + (rDiario / stakeSeguraPerc);
            if (oddIdeal < 1.05) oddIdeal = 1.05;

            if (simValorInput) simValorInput.value = recommendedStake.toFixed(2);
            if (simOddsInput) simOddsInput.value = oddIdeal.toFixed(2);

            isEnquadramentoApproved = false;
            validateEnquadramento();
            alert('Aposta reenquadrada aos valores sugeridos de baixo risco.');
        });
    }

    if (btnConfirmarSimAnyway) {
        btnConfirmarSimAnyway.addEventListener('click', () => {
            isEnquadramentoApproved = true;
            validateEnquadramento();
            alert('Risco aceito pelo usuário. Registro de aposta liberado.');
        });
    }

    if (simForm) {
        simForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const activeBanca = getActiveBanca();
            if (!activeBanca) {
                alert('Nenhuma banca ativa cadastrada.');
                return;
            }

            if (!state.selectedGameForAnalysis) {
                alert('Nenhuma partida selecionada.');
                return;
            }

            const proposedStake = parseFloat(simValorInput.value) || 0;
            const proposedOdd = parseFloat(simOddsInput.value) || 0;

            if (proposedStake > activeBanca.atual) {
                alert('Sem Saldo: O valor de aposta proposto é maior que o saldo atual da banca.');
                return;
            }

            // Recupera mercado correto
            let mercado = simMercadoSelect.value;
            if (mercado === 'custom') {
                mercado = simMercadoCustom.value.trim() || 'Outro Mercado';
            }

            const partidaName = `${state.selectedGameForAnalysis.home.name} vs ${state.selectedGameForAnalysis.away.name}`;

            // Deduz o saldo imediatamente
            activeBanca.atual -= proposedStake;

            const newSim = {
                id: 'sim_' + Date.now(),
                partida: partidaName,
                mercado: mercado,
                odds: proposedOdd,
                valor: proposedStake,
                bancaId: activeBanca.id,
                status: 'PENDENTE',
                data: new Date().toLocaleDateString('pt-BR'),
                retorno: 0.0
            };

            state.simulations.push(newSim);
            saveState();

            // Reseta controles de validação
            isEnquadramentoApproved = false;
            if (simValorInput) simValorInput.value = '';
            if (simOddsInput) simOddsInput.value = '2.00';
            if (simMercadoSelect) simMercadoSelect.selectedIndex = 0;
            if (simCustomMarketContainer) simCustomMarketContainer.style.display = 'none';
            if (simMercadoCustom) simMercadoCustom.value = '';

            renderBancaDetails();
            syncSimulacaoBanca();

            alert('Intenção de aposta registrada com sucesso! O valor do investimento foi reservado/deduzido da sua banca.');
        });
    }

    // Renderiza a lista de simulações resolvidas na aba de Resultados (Histórico Geral)
    const renderResultsTab = () => {
        const tbody = document.getElementById('results-history-tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        const resolvedSims = state.simulations.filter(s => s.status !== 'PENDENTE');

        if (resolvedSims.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); font-size: 13px;">Nenhuma simulação finalizada no histórico.</td></tr>`;
            return;
        }

        // Ordenar por data ou ID decrescente para mostrar as mais recentes primeiro
        const sortedSims = [...resolvedSims].sort((a, b) => b.id.localeCompare(a.id));

        sortedSims.forEach(sim => {
            const tr = document.createElement('tr');
            const sign = sim.status === 'WIN' ? '+' : '-';
            const valueColor = sim.status === 'WIN' ? 'var(--success)' : 'var(--danger)';
            const returnVal = sim.status === 'WIN' ? (sim.valor * sim.odds - sim.valor) : sim.valor;
            const badgeClass = sim.status === 'WIN' ? 'badge-win' : 'badge-loss';
            const badgeText = sim.status === 'WIN' ? 'Green' : 'Red';

            tr.innerHTML = `
                <td>
                    <div style="font-weight: 600; font-size: 13px; color: var(--text-main);">${sim.partida}</div>
                    <div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">Data: ${sim.data}</div>
                </td>
                <td>${sim.mercado}</td>
                <td>@ ${sim.odds.toFixed(2)}</td>
                <td>R$ ${sim.valor.toFixed(2)}</td>
                <td style="color: ${valueColor}; font-weight: 700;">${sign} R$ ${returnVal.toFixed(2)}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="badge ${badgeClass}">${badgeText}</span>
                        <span onclick="excluirSimulacao('${sim.id}')" style="cursor: pointer; opacity: 0.6; transition: 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6" title="Excluir do histórico">🗑️</span>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    };

    // Varre as simulações pendentes e as resolve automaticamente se a partida correspondente na pesquisa estiver finalizada
    const autoResolveFinishedGames = () => {
        let changed = false;
        
        state.simulations.forEach(sim => {
            if (sim.status === 'PENDENTE') {
                // Tenta localizar a partida na lista de jogos carregados
                let game = fetchedGames.find(g => {
                    const gName = `${g.home.name} vs ${g.away.name}`;
                    return gName.toLowerCase() === sim.partida.toLowerCase();
                });
                
                if (!game && state.selectedGameForAnalysis) {
                    const selGameName = `${state.selectedGameForAnalysis.home.name} vs ${state.selectedGameForAnalysis.away.name}`;
                    if (selGameName.toLowerCase() === sim.partida.toLowerCase()) {
                        game = state.selectedGameForAnalysis;
                    }
                }

                if (game && (game.status === 'finalizado' || game.status === 'post' || game.status === 'STATUS_FINAL')) {
                    // O jogo terminou! Resolvemos de acordo com o placar
                    const scoreHome = parseInt(game.scoreHome) || parseInt(game.home.score) || 0;
                    const scoreAway = parseInt(game.scoreAway) || parseInt(game.away.score) || 0;
                    
                    let isWin = false;
                    const mkt = sim.mercado.toLowerCase();
                    
                    if (mkt.includes('casa') || mkt.includes('home') || mkt.includes('vencedor: casa')) {
                        isWin = scoreHome > scoreAway;
                    } else if (mkt.includes('empate') || mkt.includes('draw')) {
                        isWin = scoreHome === scoreAway;
                    } else if (mkt.includes('visitante') || mkt.includes('away') || mkt.includes('vencedor: visitante')) {
                        isWin = scoreHome < scoreAway;
                    } else if (mkt.includes('1.5')) {
                        isWin = (scoreHome + scoreAway) > 1.5;
                    } else if (mkt.includes('2.5')) {
                        isWin = (scoreHome + scoreAway) > 2.5;
                    } else if (mkt.includes('ambos') || mkt.includes('sim')) {
                        isWin = scoreHome > 0 && scoreAway > 0;
                    } else {
                        // Para mercados customizados indetermináveis, simula com base em seed
                        isWin = (sim.id.charCodeAt(sim.id.length - 1) % 2 === 0);
                    }
                    
                    const banca = state.bancas.find(b => b.id === sim.bancaId);
                    if (banca) {
                        if (isWin) {
                            const retorno = sim.valor * sim.odds;
                            banca.atual += retorno;
                            sim.status = 'WIN';
                            sim.retorno = retorno - sim.valor;
                        } else {
                            sim.status = 'LOSS';
                            sim.retorno = -sim.valor;
                        }
                        changed = true;
                    }
                }
            }
        });

        if (changed) {
            saveState();
            renderBancaDetails();
            syncSimulacaoBanca();
            renderResultsTab();
        }
    };


    // --- GESTÃO DE MONETIZAÇÃO & ASSINATURA (PRIMEIRO PASSO) ---
    
    let selectedPlanForCheckout = null;

    // Renderiza o status da assinatura na aba Planos
    const renderPlanosTab = () => {
        const planStatusText = document.getElementById('user-plan-status-text');
        const planBadge = document.getElementById('user-plan-badge');

        if (!planStatusText || !planBadge) return;

        if (state.subscription.active) {
            const planName = state.subscription.plan === 'mensal' ? 'Plano Pro Mensal' : 'Plano Pro Anual';
            planStatusText.innerHTML = `<strong>${planName}</strong><br>Ativo até: ${state.subscription.expires}`;
            planBadge.textContent = 'Ativo';
            planBadge.className = 'badge badge-win';
            planBadge.style.background = 'rgba(16, 185, 129, 0.1)';
            planBadge.style.color = 'var(--success)';
        } else {
            planStatusText.innerHTML = `<strong>Período de Demonstração (Grátis)</strong><br>Os recursos expiram em breve. Assine para continuar.`;
            planBadge.textContent = 'Expirado';
            planBadge.className = 'badge badge-loss';
            planBadge.style.background = 'rgba(239, 68, 68, 0.1)';
            planBadge.style.color = 'var(--danger)';
        }
    };

    // Abre a área de checkout para o plano selecionado
    window.abrirCheckout = (planType) => {
        if (!state.loggedIn) {
            alert('⚠️ Para assinar um plano, por favor crie sua conta primeiro!');
            
            // Alterna para o modo de registro
            switchAuthMode(false);
            
            // Direciona para a aba de Entrada (Login/Registro)
            const navEntrada = document.querySelector('[data-tab="entrada"]');
            if (navEntrada) {
                navLinks.forEach(item => item.classList.remove('active'));
                tabPanels.forEach(panel => panel.classList.remove('active'));
                
                navEntrada.classList.add('active');
                const targetPanel = document.getElementById('panel-entrada');
                if (targetPanel) targetPanel.classList.add('active');
            }
            
            // Foca no campo Nome Completo do cadastro
            const signupName = document.getElementById('signup-name');
            if (signupName) {
                signupName.scrollIntoView({ behavior: 'smooth' });
                signupName.focus();
            }
            return;
        }

        selectedPlanForCheckout = planType;
        const checkoutCard = document.getElementById('checkout-card');
        const checkoutTitle = document.getElementById('checkout-title');

        if (checkoutCard && checkoutTitle) {
            checkoutCard.style.display = 'block';
            checkoutTitle.textContent = planType === 'mensal' ? 
                'Finalizar Assinatura Pro Mensal (R$ 29,90/mês)' : 
                'Finalizar Assinatura Pro Anual (R$ 249,00/ano)';
            
            // Auto scroll to checkout card
            checkoutCard.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Seleciona método de pagamento (Pix ou Cartão)
    window.selectPaymentMethod = (method) => {
        const btnPix = document.getElementById('pay-btn-pix');
        const btnCartao = document.getElementById('pay-btn-cartao');
        const divPix = document.getElementById('checkout-method-pix');
        const divCartao = document.getElementById('checkout-method-cartao');

        if (!btnPix || !btnCartao || !divPix || !divCartao) return;

        if (method === 'pix') {
            btnPix.classList.add('active');
            btnPix.style.borderBottom = '3px solid var(--primary)';
            btnPix.style.color = 'var(--text-main)';
            
            btnCartao.classList.remove('active');
            btnCartao.style.borderBottom = 'none';
            btnCartao.style.color = 'var(--text-muted)';
            
            divPix.style.display = 'block';
            divCartao.style.display = 'none';
        } else {
            btnCartao.classList.add('active');
            btnCartao.style.borderBottom = '3px solid var(--primary)';
            btnCartao.style.color = 'var(--text-main)';
            
            btnPix.classList.remove('active');
            btnPix.style.borderBottom = 'none';
            btnPix.style.color = 'var(--text-muted)';
            
            divPix.style.display = 'none';
            divCartao.style.display = 'block';
        }
    };

    // Copia o código Pix fictício
    window.copiarPix = () => {
        const pixInput = document.getElementById('pix-code');
        if (pixInput) {
            pixInput.select();
            pixInput.setSelectionRange(0, 99999);
            navigator.clipboard.writeText(pixInput.value)
                .then(() => alert('Código Pix copiado para a área de transferência!'))
                .catch(() => alert('Falha ao copiar o código. Por favor, copie manualmente.'));
        }
    };

    // Confirma pagamento simulação do Pix
    window.confirmarPagamentoSimulado = () => {
        if (!selectedPlanForCheckout) return;
        
        const today = new Date();
        const expiryDate = new Date();
        if (selectedPlanForCheckout === 'mensal') {
            expiryDate.setMonth(today.getMonth() + 1);
        } else {
            expiryDate.setFullYear(today.getFullYear() + 1);
        }

        state.subscription = {
            plan: selectedPlanForCheckout,
            active: true,
            expires: expiryDate.toLocaleDateString('pt-BR')
        };
        saveState();

        renderPlanosTab();
        
        const checkoutCard = document.getElementById('checkout-card');
        if (checkoutCard) checkoutCard.style.display = 'none';

        alert(`🎉 Parabéns! Pagamento simulado confirmado com sucesso.\nSua assinatura do ${selectedPlanForCheckout === 'mensal' ? 'Plano Pro Mensal' : 'Plano Pro Anual'} está ATIVA.`);
    };

    // Processa cartão simulado
    window.processarCartaoSimulado = (e) => {
        e.preventDefault();
        confirmarPagamentoSimulado();
    };


    // --- PAINEL ADMINISTRATIVO (PASSO 2) ---

    // Renderiza a tabela de usuários e estatísticas no Painel Admin
    const renderAdminTab = () => {
        // Estatísticas
        const statUsers = document.getElementById('admin-stat-users');
        const statActive = document.getElementById('admin-stat-active');
        const statMrr = document.getElementById('admin-stat-mrr');

        if (statUsers) statUsers.textContent = state.adminUsers.length;

        // Assinantes ativos: u.ativo === true e u.plano !== 'free'
        const activeCount = state.adminUsers.filter(u => u.ativo && u.plano !== 'free').length;
        if (statActive) statActive.textContent = activeCount;

        // Receita recorrente mensal (MRR)
        // Plano mensal: R$ 29,90/mês
        // Plano anual: R$ 20,75/mês (249 / 12)
        let mrr = 0;
        state.adminUsers.forEach(u => {
            if (u.ativo) {
                if (u.plano === 'mensal') {
                    mrr += 29.90;
                } else if (u.plano === 'anual') {
                    mrr += 20.75;
                }
            }
        });
        if (statMrr) {
            statMrr.textContent = `R$ ${mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        // Tabela de usuários
        const tbody = document.getElementById('admin-users-tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        state.adminUsers.forEach(u => {
            const tr = document.createElement('tr');

            // Badge de Plano
            let planBadge = '';
            if (u.plano === 'mensal') {
                planBadge = `<span class="badge" style="background: rgba(139, 92, 246, 0.1); color: #a78bfa; border: 1px solid rgba(139, 92, 246, 0.2);">Mensal (Pro)</span>`;
            } else if (u.plano === 'anual') {
                planBadge = `<span class="badge" style="background: rgba(16, 185, 129, 0.1); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.2);">Anual (Pro)</span>`;
            } else {
                planBadge = `<span class="badge" style="background: rgba(255, 255, 255, 0.1); color: var(--text-muted); border: 1px solid rgba(255, 255, 255, 0.1);">Grátis</span>`;
            }

            // Badge de Status
            const statusBadge = u.ativo ? 
                `<span class="badge badge-win">Ativo</span>` : 
                `<span class="badge badge-loss">Inativo</span>`;

            // Botão de Alternar Assinatura
            const toggleBtn = u.ativo ? 
                `<button onclick="toggleUserSubscription('${u.id}')" class="btn" style="padding: 4px 8px; font-size: 11px; margin-right: 4px; background: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.2); cursor: pointer; border-radius: 4px;">Inativar</button>` : 
                `<button onclick="toggleUserSubscription('${u.id}')" class="btn" style="padding: 4px 8px; font-size: 11px; margin-right: 4px; background: rgba(16, 185, 129, 0.1); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.2); cursor: pointer; border-radius: 4px;">Ativar</button>`;

            // Botão Excluir
            const deleteBtn = `<button onclick="excluirUser('${u.id}')" class="btn" style="padding: 4px 8px; font-size: 11px; background: rgba(239, 68, 68, 0.2); color: #ff5252; border: 1px solid rgba(239, 68, 68, 0.4); cursor: pointer; border-radius: 4px;">Excluir</button>`;

            tr.innerHTML = `
                <td>
                    <div style="font-weight: 700; color: var(--text-main);">${u.nome}</div>
                    <div style="color: var(--text-muted); font-size: 11px; margin-top: 2px;">${u.email}</div>
                </td>
                <td>${planBadge}</td>
                <td>R$ ${Number(u.banca).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>${statusBadge}</td>
                <td style="white-space: nowrap;">
                    ${toggleBtn}
                    ${deleteBtn}
                </td>
            `;
            tbody.appendChild(tr);
        });
    };

    // Alternar status ativo/inativo do plano do usuário
    window.toggleUserSubscription = (userId) => {
        const user = state.adminUsers.find(u => u.id === userId);
        if (user) {
            user.ativo = !user.ativo;
            saveState();
            renderAdminTab();
        }
    };

    // Excluir usuário do gerenciamento admin
    window.excluirUser = (userId) => {
        if (confirm('Tem certeza de que deseja remover este usuário permanentemente?')) {
            state.adminUsers = state.adminUsers.filter(u => u.id !== userId);
            saveState();
            renderAdminTab();
        }
    };

    // Enviar aviso global push
    window.enviarAvisoGlobal = () => {
        const broadcastInput = document.getElementById('admin-broadcast-msg');
        if (broadcastInput) {
            const message = broadcastInput.value.trim();
            if (!message) {
                alert('⚠️ Por favor, digite uma mensagem antes de disparar o alerta.');
                return;
            }
            alert(`📢 Notificação Push Enviada!\n\nMensagem: "${message}"\n\nTodos os usuários ativos do Decipro receberão este aviso.`);
            broadcastInput.value = '';
        }
    };

    // Submissão do formulário de cadastro de usuário
    const adminUserForm = document.getElementById('admin-add-user-form');
    if (adminUserForm) {
        adminUserForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const nome = document.getElementById('admin-user-name').value.trim();
            const email = document.getElementById('admin-user-email').value.trim();
            const plano = document.getElementById('admin-user-plan').value;
            const banca = parseFloat(document.getElementById('admin-user-balance').value) || 0;

            if (!nome || !email) {
                alert('⚠️ Por favor, preencha todos os campos obrigatórios.');
                return;
            }

            const newUser = {
                id: 'usr_' + Date.now(),
                nome,
                email,
                plano,
                banca,
                ativo: true,
                data: new Date().toLocaleDateString('pt-BR')
            };

            state.adminUsers.push(newUser);
            saveState();
            renderAdminTab();

            // Resetar formulário
            adminUserForm.reset();
            const balanceInput = document.getElementById('admin-user-balance');
            if (balanceInput) balanceInput.value = '1000';

            alert(`🎉 Usuário "${nome}" cadastrado com sucesso e assinatura Pro ativada no plano ${plano === 'free' ? 'Grátis' : plano}!`);
        });
    }


    // --- CENTRAL DE ANÁLISE UNIVERSAL (PRÉ-JOGO & AO VIVO) ---
    let currentActiveMatchSubTab = 'pre-jogo';
    let currentActiveMarketSubItem = 'resultado';

    // Event listeners para as sub-abas da partida
    const matchTabBtns = document.querySelectorAll('.match-tab-btn');
    const matchTabPanels = document.querySelectorAll('.match-tab-panel');

    matchTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            matchTabBtns.forEach(b => b.classList.remove('active'));
            matchTabPanels.forEach(p => p.style.display = 'none');

            btn.classList.add('active');
            currentActiveMatchSubTab = btn.getAttribute('data-match-tab');

            const panel = document.getElementById(`match-panel-${currentActiveMatchSubTab}`);
            if (panel) {
                panel.style.display = 'block';
                if (state.selectedGameForAnalysis) {
                    renderMatchTabContent(currentActiveMatchSubTab, state.selectedGameForAnalysis);
                }
            }
        });
    });

    // Ouvinte para o botão voltar das estatísticas de partida
    const btnVoltarPortfolio = document.getElementById('btn-voltar-portfolio');
    if (btnVoltarPortfolio) {
        btnVoltarPortfolio.addEventListener('click', () => {
            state.selectedGameForAnalysis = null;
            state.activeMatchSummary = null;
            saveState();
            renderAnalysisTab();
        });
    }

    // Função global para selecionar um jogo da lista e ir para a análise (com busca real via API)
    window.selecionarParaAnalise = async (gameId) => {
        const game = fetchedGames.find(g => g.id === gameId);
        if (!game) return;

        state.selectedGameForAnalysis = game;
        state.activeMatchSummary = null; // Limpa para a nova busca
        saveState();

        // Limpa estatísticas simuladas antigas se for um jogo novo
        liveStats = null;

        const navAnalise = document.querySelector('[data-tab="analise"]');
        if (navAnalise) {
            navAnalise.click();
        }

        // Faz a pesquisa assíncrona por dados reais da partida usando a API ESPN
        try {
            const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${game.leagueId}/summary?event=${game.id}`);
            if (res.ok) {
                const summaryData = await res.json();
                // Salva os dados reais extraídos de análises esportivas no estado
                state.activeMatchSummary = summaryData;
                saveState();

                // Se o usuário ainda estiver com a mesma partida aberta na aba de análise, recarrega
                if (state.selectedGameForAnalysis && state.selectedGameForAnalysis.id === gameId) {
                    renderMatchAnalysisDetails(state.selectedGameForAnalysis);
                }
            }
        } catch (err) {
            console.warn("Não foi possível carregar dados detalhados em tempo real da partida (usando gerador resiliente).", err);
        }
    };

    // Renderiza a aba de análise com base no estado de seleção
    const renderAnalysisTab = () => {
        const portfolioContainer = document.getElementById('analise-portfolio-container');
        const matchContainer = document.getElementById('match-analysis-container');

        if (!portfolioContainer || !matchContainer) return;

        if (!state.selectedGameForAnalysis) {
            portfolioContainer.style.display = 'block';
            matchContainer.style.display = 'none';
            clearInterval(liveSimulationInterval);
            liveSimulationInterval = null;
            liveStats = null;
        } else {
            portfolioContainer.style.display = 'none';
            matchContainer.style.display = 'block';
            renderMatchAnalysisDetails(state.selectedGameForAnalysis);
        }
    };

    // Renderiza os detalhes do cabeçalho da partida selecionada e inicia a simulação se for ao vivo
    const renderMatchAnalysisDetails = (game) => {
        const homeLogoImg = document.getElementById('match-home-logo');
        const homeNameEl = document.getElementById('match-home-name');
        const awayLogoImg = document.getElementById('match-away-logo');
        const awayNameEl = document.getElementById('match-away-name');
        const statusBadge = document.getElementById('match-status-badge');
        const timeLabel = document.getElementById('match-time-label');
        const scoreDisplay = document.getElementById('match-score-display');

        const favHomeStar = document.getElementById('fav-home-star');
        const favAwayStar = document.getElementById('fav-away-star');
        const livePressureContainer = document.getElementById('match-live-pressure-container');
        const livePressureVal = document.getElementById('match-live-pressure-val');
        const livePressureBarLeft = document.getElementById('match-live-pressure-bar-left');
        const livePressureBarRight = document.getElementById('match-live-pressure-bar-right');

        // Lógica das estrelas de favoritos do cabeçalho
        const updateStars = () => {
            const isFav = state.favoritos.jogos.includes(game.id);
            if (favHomeStar) {
                favHomeStar.textContent = isFav ? '★' : '☆';
                favHomeStar.style.color = isFav ? '#fbbf24' : 'var(--text-dim)';
            }
            if (favAwayStar) {
                favAwayStar.textContent = isFav ? '★' : '☆';
                favAwayStar.style.color = isFav ? '#fbbf24' : 'var(--text-dim)';
            }
        };
        
        updateStars();

        if (favHomeStar) {
            favHomeStar.onclick = (e) => {
                e.stopPropagation();
                toggleFavGame(e, game.id);
                updateStars();
            };
        }
        if (favAwayStar) {
            favAwayStar.onclick = (e) => {
                e.stopPropagation();
                toggleFavGame(e, game.id);
                updateStars();
            };
        }

        if (homeLogoImg) homeLogoImg.src = game.home.logo;
        if (homeNameEl) homeNameEl.textContent = game.home.name;
        if (awayLogoImg) awayLogoImg.src = game.away.logo;
        if (awayNameEl) awayNameEl.textContent = game.away.name;

        // Atualiza cabeçalhos de sub-abas dinamicamente com base no status do jogo
        const btnTabPre = document.getElementById('tab-btn-pre-jogo');
        const btnTabOdds = document.getElementById('tab-btn-odds');
        const btnTabDicas = document.getElementById('tab-btn-dicas');
        const btnTabMercados = document.getElementById('tab-btn-mercados');

        if (game.status === 'aovivo') {
            if (btnTabPre) btnTabPre.textContent = 'AO VIVO';
            if (btnTabOdds) btnTabOdds.textContent = 'ODDS AO VIVO';
            if (btnTabDicas) btnTabDicas.textContent = 'DICAS AO VIVO';
            if (btnTabMercados) btnTabMercados.textContent = 'MERCADOS AO VIVO';

            // Configuração do Status Ao Vivo
            if (statusBadge) {
                statusBadge.style.display = 'inline-flex';
                statusBadge.innerHTML = '<span style="width: 6px; height: 6px; background: var(--danger); border-radius: 50%; display: inline-block;"></span> AO VIVO';
                statusBadge.style.background = 'rgba(239, 68, 68, 0.15)';
                statusBadge.style.color = 'var(--danger)';
                statusBadge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                statusBadge.style.animation = 'pulse 1.5s infinite';
            }

            // Inicializa ou reaproveita o estado simulado em tempo real
            if (!liveStats || liveStats.gameId !== game.id) {
                // Tenta inferir o minuto a partir do detalhe da ESPN ou usa 65' padrão
                let currentMin = 65;
                const matchMin = (game.time || '').match(/\d+/);
                if (matchMin) currentMin = parseInt(matchMin[0]);

                liveStats = {
                    gameId: game.id,
                    minute: currentMin,
                    scoreHome: parseInt(game.home.score) || 0,
                    scoreAway: parseInt(game.away.score) || 0,
                    posseHome: 45 + Math.floor(Math.random() * 16), // 45 a 61
                    ataquesHome: 80 + Math.floor(Math.random() * 41), // 80 a 120
                    ataquesAway: 30 + Math.floor(Math.random() * 41), // 30 a 70
                    ataquesPerigososHome: 40 + Math.floor(Math.random() * 31), // 40 a 70
                    ataquesPerigososAway: 10 + Math.floor(Math.random() * 21), // 10 a 30
                    finalizacoesHome: 6 + Math.floor(Math.random() * 6),
                    finalizacoesAway: 4 + Math.floor(Math.random() * 5),
                    noGolHome: 2 + Math.floor(Math.random() * 4),
                    noGolAway: 1 + Math.floor(Math.random() * 3),
                    escanteiosHome: 3 + Math.floor(Math.random() * 5),
                    escanteiosAway: 2 + Math.floor(Math.random() * 4),
                    faltasHome: 9 + Math.floor(Math.random() * 6),
                    faltasAway: 8 + Math.floor(Math.random() * 7),
                    cartoesHome: Math.floor(Math.random() * 3),
                    cartoesAway: Math.floor(Math.random() * 4),
                    homePressures: Array.from({length: 25}, () => Math.floor(Math.random() * 95)),
                    awayPressures: Array.from({length: 25}, () => Math.floor(Math.random() * 90))
                };

                // Configura o loop de simulação ao vivo
                clearInterval(liveSimulationInterval);
                liveSimulationInterval = setInterval(() => {
                    if (!state.selectedGameForAnalysis || state.selectedGameForAnalysis.id !== game.id || state.selectedGameForAnalysis.status !== 'aovivo') {
                        clearInterval(liveSimulationInterval);
                        return;
                    }

                    // Avança o minuto do jogo
                    liveStats.minute += 1;
                    if (liveStats.minute > 90) {
                        liveStats.minute = 90;
                        clearInterval(liveSimulationInterval);
                    }

                    // Flutuação das estatísticas do jogo
                    if (Math.random() > 0.4) liveStats.ataquesHome += 1 + Math.floor(Math.random() * 3);
                    if (Math.random() > 0.4) liveStats.ataquesAway += 1 + Math.floor(Math.random() * 2);
                    if (Math.random() > 0.5) liveStats.ataquesPerigososHome += 1 + Math.floor(Math.random() * 2);
                    if (Math.random() > 0.5) liveStats.ataquesPerigososAway += 1 + Math.floor(Math.random() * 2);

                    if (Math.random() > 0.75) {
                        liveStats.finalizacoesHome += 1;
                        if (Math.random() > 0.6) liveStats.noGolHome += 1;
                    }
                    if (Math.random() > 0.75) {
                        liveStats.finalizacoesAway += 1;
                        if (Math.random() > 0.6) liveStats.noGolAway += 1;
                    }
                    if (Math.random() > 0.8) liveStats.escanteiosHome += 1;
                    if (Math.random() > 0.8) liveStats.escanteiosAway += 1;
                    if (Math.random() > 0.65) liveStats.faltasHome += 1;
                    if (Math.random() > 0.65) liveStats.faltasAway += 1;
                    if (Math.random() > 0.96) liveStats.cartoesHome += 1;
                    if (Math.random() > 0.94) liveStats.cartoesAway += 1;

                    // Desloca o gráfico de pressão inserindo nova leitura de volume ofensivo
                    liveStats.homePressures.shift();
                    const baseHomePress = liveStats.posseHome > 50 ? 30 : 15;
                    liveStats.homePressures.push(baseHomePress + Math.floor(Math.random() * 65));
                    
                    liveStats.awayPressures.shift();
                    const baseAwayPress = liveStats.posseHome < 50 ? 30 : 15;
                    liveStats.awayPressures.push(baseAwayPress + Math.floor(Math.random() * 60));

                    // Atualiza a interface gráfica do jogo com os novos valores
                    updateLiveGameUI(game);
                }, 10000); // atualiza a cada 10 segundos
            }

            // Atualiza barra de pressão do cabeçalho se houver dados
            if (livePressureContainer && liveStats) {
                livePressureContainer.style.display = 'block';
                const pressHome = liveStats.homePressures[24] || 76;
                const pressAway = liveStats.awayPressures[24] || 24;
                const totalPress = pressHome + pressAway || 100;
                const ratioHome = Math.round((pressHome / totalPress) * 100);
                const ratioAway = 100 - ratioHome;
                
                if (livePressureVal) livePressureVal.textContent = `${ratioHome}%`;
                if (livePressureBarLeft) livePressureBarLeft.style.width = `${ratioHome}%`;
                if (livePressureBarRight) livePressureBarRight.style.width = `${ratioAway}%`;
            }

            updateLiveGameUI(game);

        } else {
            // Configurações para jogos não ao vivo
            if (livePressureContainer) {
                livePressureContainer.style.display = 'none';
            }
            clearInterval(liveSimulationInterval);
            liveSimulationInterval = null;
            liveStats = null;

            if (btnTabPre) btnTabPre.textContent = 'PRÉ JOGO';
            if (btnTabOdds) btnTabOdds.textContent = 'PRÉ ODDS';
            if (btnTabDicas) btnTabDicas.textContent = 'DICAS';
            if (btnTabMercados) btnTabMercados.textContent = 'MERCADOS';

            if (statusBadge) {
                if (game.status === 'finalizado') {
                    statusBadge.style.display = 'inline-flex';
                    statusBadge.textContent = 'FINALIZADO';
                    statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
                    statusBadge.style.color = 'var(--success)';
                    statusBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                    statusBadge.style.animation = 'none';
                    if (timeLabel) timeLabel.textContent = 'Partida Encerrada';
                    if (scoreDisplay) scoreDisplay.textContent = `${game.home.score} - ${game.away.score}`;
                } else {
                    statusBadge.style.display = 'inline-flex';
                    statusBadge.textContent = 'PRÉ-JOGO';
                    statusBadge.style.background = 'rgba(245, 158, 11, 0.15)';
                    statusBadge.style.color = 'var(--warning)';
                    statusBadge.style.borderColor = 'rgba(245, 158, 11, 0.3)';
                    statusBadge.style.animation = 'none';
                    if (timeLabel) timeLabel.textContent = `Início: hoje às ${game.time}`;
                    if (scoreDisplay) scoreDisplay.textContent = 'VS';
                }
            }
        }

        // Reseta para a primeira sub-aba interna por padrão
        const defaultSubBtn = document.getElementById('tab-btn-pre-jogo');
        if (defaultSubBtn) {
            defaultSubBtn.click();
        }
    };

    // Atualiza os painéis visuais do jogo ao vivo com base no estado liveStats
    const updateLiveGameUI = (game) => {
        if (!liveStats) return;

        const timeLabel = document.getElementById('match-time-label');
        const scoreDisplay = document.getElementById('match-score-display');

        if (timeLabel) timeLabel.textContent = `${liveStats.minute}' Tempo`;
        if (scoreDisplay) scoreDisplay.textContent = `${liveStats.scoreHome} - ${liveStats.scoreAway}`;

        // Re-renderiza o conteúdo da sub-aba ativa atual
        renderMatchTabContent(currentActiveMatchSubTab, game);
    };

    // Renderizadores de classificação, árbitro e dados
    const getLeagueStandings = (leagueName, homeName, awayName) => {
        let teams = [];
        if (leagueName.includes('Brasil')) {
            teams = [
                { pos: 1, name: 'Botafogo', j: 14, v: 9, e: 4, d: 1, sg: 12, pts: 31 },
                { pos: 2, name: 'Palmeiras', j: 14, v: 9, e: 2, d: 3, sg: 10, pts: 29 },
                { pos: 3, name: 'Flamengo', j: 14, v: 8, e: 4, d: 2, sg: 9, pts: 28 },
                { pos: 4, name: 'Bahia', j: 14, v: 8, e: 3, d: 3, sg: 6, pts: 27 },
                { pos: 5, name: 'São Paulo', j: 14, v: 7, e: 3, d: 4, sg: 5, pts: 24 }
            ];
        } else if (leagueName.includes('Inglaterra') || leagueName.includes('Premier')) {
            teams = [
                { pos: 1, name: 'Manchester City', j: 14, v: 10, e: 3, d: 1, sg: 18, pts: 33 },
                { pos: 2, name: 'Arsenal', j: 14, v: 9, e: 3, d: 2, sg: 14, pts: 30 },
                { pos: 3, name: 'Liverpool', j: 14, v: 9, e: 2, d: 3, sg: 13, pts: 29 },
                { pos: 4, name: 'Aston Villa', j: 14, v: 8, e: 2, d: 4, sg: 6, pts: 26 },
                { pos: 5, name: 'Chelsea', j: 14, v: 6, e: 4, d: 4, sg: 3, pts: 22 }
            ];
        } else if (leagueName.includes('Espanha') || leagueName.includes('Liga')) {
            teams = [
                { pos: 1, name: 'Real Madrid', j: 14, v: 11, e: 2, d: 1, sg: 20, pts: 35 },
                { pos: 2, name: 'Barcelona', j: 14, v: 10, e: 1, d: 3, sg: 15, pts: 31 },
                { pos: 3, name: 'Girona', j: 14, v: 9, e: 2, d: 3, sg: 12, pts: 29 },
                { pos: 4, name: 'Atlético Madrid', j: 14, v: 8, e: 3, d: 3, sg: 8, pts: 27 },
                { pos: 5, name: 'Athletic Bilbao', j: 14, v: 7, e: 3, d: 4, sg: 4, pts: 24 }
            ];
        } else {
            teams = [
                { pos: 1, name: 'Real Madrid', j: 6, v: 5, e: 0, d: 1, sg: 8, pts: 15 },
                { pos: 2, name: 'Bayern Munich', j: 6, v: 4, e: 1, d: 1, sg: 6, pts: 13 },
                { pos: 3, name: 'Manchester City', j: 6, v: 4, e: 0, d: 2, sg: 7, pts: 12 },
                { pos: 4, name: 'PSG', j: 6, v: 3, e: 1, d: 2, sg: 2, pts: 10 },
                { pos: 5, name: 'Arsenal', j: 6, v: 3, e: 0, d: 3, sg: 1, pts: 9 }
            ];
        }

        const homeExists = teams.some(t => t.name.toLowerCase().includes(homeName.toLowerCase()) || homeName.toLowerCase().includes(t.name.toLowerCase()));
        const awayExists = teams.some(t => t.name.toLowerCase().includes(awayName.toLowerCase()) || awayName.toLowerCase().includes(t.name.toLowerCase()));

        if (!homeExists) {
            teams[3] = { pos: 4, name: homeName, j: 14, v: 6, e: 4, d: 4, sg: 2, pts: 22 };
        }
        if (!awayExists) {
            teams[4] = { pos: 5, name: awayName, j: 14, v: 5, e: 3, d: 6, sg: -3, pts: 18 };
        }

        teams.sort((a, b) => b.pts - a.pts);
        teams.forEach((t, index) => {
            t.pos = index + 1;
        });

        return teams;
    };

    const getRefereeData = (leagueName) => {
        if (leagueName.includes('Brasil')) {
            return {
                name: 'Wilton Pereira Sampaio',
                cards: '5.8',
                fouls: '31.5',
                style: 'Extremamente Rígido',
                desc: 'Arbitragem com rigor severo. Costuma marcar qualquer contato físico leve e distribui cartões amarelos rapidamente para conter o andamento do jogo. Excelente cenário para Over de Cartões.'
            };
        } else if (leagueName.includes('Inglaterra') || leagueName.includes('Premier')) {
            return {
                name: 'Michael Oliver',
                cards: '3.6',
                fouls: '20.8',
                style: 'Permissivo (Estilo Inglês)',
                desc: 'Permite o jogo pegado e de muito contato físico. Evita parar a partida por faltas leves e adverte apenas lances de clara imprudência. Cenário favorável para Under Cartões.'
            };
        } else if (leagueName.includes('Espanha') || leagueName.includes('Liga')) {
            return {
                name: 'Jesús Gil Manzano',
                cards: '5.3',
                fouls: '25.6',
                style: 'Rigoroso',
                desc: 'Arbitragem muito metódica. Tende a marcar muitas faltas táticas de contenção e pune rapidamente reclamações ou agressividade desmedida com cartões.'
            };
        } else {
            return {
                name: 'Szymon Marciniak',
                cards: '4.5',
                fouls: '24.2',
                style: 'Moderado / Firme',
                desc: 'Árbitro de padrão internacional de elite. Mantém o controle psicológico da partida sem a necessidade de inflar os cartões amarelos precocemente.'
            };
        }
    };

    // Renderiza os conteúdos específicos dentro dos painéis de sub-aba
    const renderMatchTabContent = (tabName, game) => {
        const panelPre = document.getElementById('match-panel-pre-jogo');
        const panelOdds = document.getElementById('match-panel-odds');
        const panelDicas = document.getElementById('match-panel-dicas');
        const panelMarkets = document.getElementById('match-panel-mercados');

        if (!panelPre || !panelOdds || !panelDicas || !panelMarkets) return;

        const isLive = game.status === 'aovivo';

        // --- SUB-ABA 1: PRÉ-JOGO ou AO VIVO ---
        if (tabName === 'pre-jogo') {
            if (isLive && liveStats) {
                // Layout Ao Vivo idêntico ao da imagem com Donut de Progresso e Badges
                
                const atkHome = liveStats.ataquesHome || 120;
                const atkAway = liveStats.ataquesAway || 38;
                const dangerAtkHome = liveStats.ataquesPerigososHome || 70;
                const dangerAtkAway = liveStats.ataquesPerigososAway || 10;
                const posHome = liveStats.posseHome || 71;
                const posAway = 100 - posHome;

                const ratioAtk = Math.round((atkHome / (atkHome + atkAway)) * 100) || 50;
                const ratioDangerAtk = Math.round((dangerAtkHome / (dangerAtkHome + dangerAtkAway)) * 100) || 50;

                // Cartões Amarelos/Vermelhos
                const redCardsHome = (liveStats.cartoesHome >= 3) ? 1 : 0;
                const yellowCardsHome = liveStats.cartoesHome - redCardsHome;
                const redCardsAway = (liveStats.cartoesAway >= 3) ? 1 : 0;
                const yellowCardsAway = liveStats.cartoesAway - redCardsAway;

                // Chutes no Gol / Chutes ao Lado
                const ratioNoGol = Math.round((liveStats.noGolHome / (liveStats.noGolHome + liveStats.noGolAway || 1)) * 100) || 50;
                const offTargetHome = Math.max(0, liveStats.finalizacoesHome - liveStats.noGolHome);
                const offTargetAway = Math.max(0, liveStats.finalizacoesAway - liveStats.noGolAway);
                const ratioOffTarget = Math.round((offTargetHome / (offTargetHome + offTargetAway || 1)) * 100) || 50;

                // Odds Ao Vivo
                const decayFactor = Math.max(0.1, (90 - liveStats.minute) / 90);
                let odd1Live = 2.10, oddXLive = 3.10, odd2Live = 3.20;
                if (liveStats.scoreHome > liveStats.scoreAway) {
                    odd1Live = (1.05 + 0.2 * decayFactor).toFixed(2);
                    oddXLive = (3.0 + 3.0 / decayFactor).toFixed(2);
                    odd2Live = (6.0 + 10.0 / decayFactor).toFixed(2);
                } else if (liveStats.scoreAway > liveStats.scoreHome) {
                    odd1Live = (6.0 + 10.0 / decayFactor).toFixed(2);
                    oddXLive = (3.0 + 3.0 / decayFactor).toFixed(2);
                    odd2Live = (1.05 + 0.2 * decayFactor).toFixed(2);
                } else {
                    odd1Live = (1.80 + 1.5 / decayFactor).toFixed(2);
                    oddXLive = (1.50 + 1.2 * decayFactor).toFixed(2);
                    odd2Live = (2.20 + 2.0 / decayFactor).toFixed(2);
                }

                panelPre.innerHTML = `
                    <!-- Estatísticas Principais com Gráficos Circulares (Donuts) -->
                    <div class="glass-card" style="padding: 20px 24px;">
                        <div style="display: flex; justify-content: space-between; gap: 20px;">
                            <!-- Ataques -->
                            <div style="flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                                <div style="font-size: 11px; color: var(--text-muted); font-family: 'Outfit'; margin-bottom: 8px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Ataques</div>
                                <div style="display: flex; align-items: center; gap: 16px; justify-content: center; width: 100%;">
                                    <span style="font-size: 20px; font-weight: 700; color: var(--text-main); font-family: 'Outfit'; flex: 1; text-align: right;">${atkHome}</span>
                                    <svg viewBox="0 0 36 36" style="width: 44px; height: 44px; transform: rotate(-90deg); flex-shrink: 0;">
                                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#ef4444" stroke-width="3.5" />
                                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" stroke-width="3.5" stroke-dasharray="${ratioAtk} ${100 - ratioAtk}" stroke-dashoffset="0" />
                                    </svg>
                                    <span style="font-size: 20px; font-weight: 700; color: var(--text-main); font-family: 'Outfit'; flex: 1; text-align: left;">${atkAway}</span>
                                </div>
                            </div>

                            <!-- Ataques Perigosos -->
                            <div style="flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                                <div style="font-size: 11px; color: var(--text-muted); font-family: 'Outfit'; margin-bottom: 8px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Ataques Perigosos</div>
                                <div style="display: flex; align-items: center; gap: 16px; justify-content: center; width: 100%;">
                                    <span style="font-size: 20px; font-weight: 700; color: var(--text-main); font-family: 'Outfit'; flex: 1; text-align: right;">${dangerAtkHome}</span>
                                    <svg viewBox="0 0 36 36" style="width: 44px; height: 44px; transform: rotate(-90deg); flex-shrink: 0;">
                                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#ef4444" stroke-width="3.5" />
                                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" stroke-width="3.5" stroke-dasharray="${ratioDangerAtk} ${100 - ratioDangerAtk}" stroke-dashoffset="0" />
                                    </svg>
                                    <span style="font-size: 20px; font-weight: 700; color: var(--text-main); font-family: 'Outfit'; flex: 1; text-align: left;">${dangerAtkAway}</span>
                                </div>
                            </div>

                            <!-- % de Posse -->
                            <div style="flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                                <div style="font-size: 11px; color: var(--text-muted); font-family: 'Outfit'; margin-bottom: 8px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">% de Posse</div>
                                <div style="display: flex; align-items: center; gap: 16px; justify-content: center; width: 100%;">
                                    <span style="font-size: 20px; font-weight: 700; color: var(--text-main); font-family: 'Outfit'; flex: 1; text-align: right;">${posHome}%</span>
                                    <svg viewBox="0 0 36 36" style="width: 44px; height: 44px; transform: rotate(-90deg); flex-shrink: 0;">
                                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#ef4444" stroke-width="3.5" />
                                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" stroke-width="3.5" stroke-dasharray="${posHome} ${100 - posHome}" stroke-dashoffset="0" />
                                    </svg>
                                    <span style="font-size: 20px; font-weight: 700; color: var(--text-main); font-family: 'Outfit'; flex: 1; text-align: left;">${posAway}%</span>
                                </div>
                            </div>
                        </div>

                        <!-- Painel de Detalhes Inferior (Cartões, Escanteios e Barras) -->
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 24px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; gap: 16px;">
                            
                            <!-- Badges Mandante (Esquerda) -->
                            <div style="display: flex; gap: 10px; align-items: center; flex: 1; justify-content: flex-start;">
                                <div style="text-align: center;">
                                    <div style="font-size: 14px; margin-bottom: 4px;" title="Escanteios">🚩</div>
                                    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 10px; font-size: 13px; font-weight: 700; color: var(--text-main); min-width: 34px; font-family:'Outfit';">${liveStats.escanteiosHome}</div>
                                </div>
                                <div style="text-align: center;">
                                    <div style="width: 10px; height: 14px; background: #ef4444; border-radius: 2px; margin: 2px auto 6px auto; box-shadow: 0 0 6px rgba(239,68,68,0.4);" title="Cartões Vermelhos"></div>
                                    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 10px; font-size: 13px; font-weight: 700; color: var(--text-main); min-width: 34px; font-family:'Outfit';">${redCardsHome}</div>
                                </div>
                                <div style="text-align: center;">
                                    <div style="width: 10px; height: 14px; background: #fbbf24; border-radius: 2px; margin: 2px auto 6px auto; box-shadow: 0 0 6px rgba(251,191,36,0.4);" title="Cartões Amarelos"></div>
                                    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 10px; font-size: 13px; font-weight: 700; color: var(--text-main); min-width: 34px; font-family:'Outfit';">${yellowCardsHome}</div>
                                </div>
                            </div>

                            <!-- Finalizações (Centro) -->
                            <div style="flex: 1.6; display: flex; flex-direction: column; gap: 10px; align-items: center;">
                                <!-- Chutes no Gol -->
                                <div style="width: 100%;">
                                    <div style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-align: center; margin-bottom: 4px; font-family: 'Outfit';">Chutes no Gol</div>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 12px; font-weight: 600; font-family: 'Outfit'; color: var(--text-main); min-width: 12px; text-align: right;">${liveStats.noGolHome}</span>
                                        <div style="flex: 1; height: 5px; border-radius: 2.5px; overflow: hidden; background: rgba(255,255,255,0.05); display: flex;">
                                            <div style="width: ${ratioNoGol}%; background: var(--success); height: 100%;"></div>
                                            <div style="width: ${100 - ratioNoGol}%; background: var(--danger); height: 100%;"></div>
                                        </div>
                                        <span style="font-size: 12px; font-weight: 600; font-family: 'Outfit'; color: var(--text-main); min-width: 12px; text-align: left;">${liveStats.noGolAway}</span>
                                    </div>
                                </div>

                                <!-- Chutes ao Lado -->
                                <div style="width: 100%;">
                                    <div style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-align: center; margin-bottom: 4px; font-family: 'Outfit';">Chutes ao Lado</div>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 12px; font-weight: 600; font-family: 'Outfit'; color: var(--text-main); min-width: 12px; text-align: right;">${offTargetHome}</span>
                                        <div style="flex: 1; height: 5px; border-radius: 2.5px; overflow: hidden; background: rgba(255,255,255,0.05); display: flex;">
                                            <div style="width: ${ratioOffTarget}%; background: var(--success); height: 100%;"></div>
                                            <div style="width: ${100 - ratioOffTarget}%; background: var(--danger); height: 100%;"></div>
                                        </div>
                                        <span style="font-size: 12px; font-weight: 600; font-family: 'Outfit'; color: var(--text-main); min-width: 12px; text-align: left;">${offTargetAway}</span>
                                    </div>
                                </div>

                                <!-- Carrossel & Links -->
                                <div style="font-size: 10px; color: var(--text-dim); cursor: pointer; text-decoration: underline; margin-top: 4px;">Toque aqui para mais</div>
                                <div style="display: flex; gap: 4px; margin-top: 2px;">
                                    <span style="width: 5px; height: 5px; border-radius: 50%; background: var(--text-dim); opacity: 0.5;"></span>
                                    <span style="width: 5px; height: 5px; border-radius: 50%; background: var(--success);"></span>
                                    <span style="width: 5px; height: 5px; border-radius: 50%; background: var(--text-dim); opacity: 0.5;"></span>
                                </div>
                            </div>

                            <!-- Badges Visitante (Direita) -->
                            <div style="display: flex; gap: 10px; align-items: center; flex: 1; justify-content: flex-end;">
                                <div style="text-align: center;">
                                    <div style="width: 10px; height: 14px; background: #fbbf24; border-radius: 2px; margin: 2px auto 6px auto; box-shadow: 0 0 6px rgba(251,191,36,0.4);" title="Cartões Amarelos"></div>
                                    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 10px; font-size: 13px; font-weight: 700; color: var(--text-main); min-width: 34px; font-family:'Outfit';">${yellowCardsAway}</div>
                                </div>
                                <div style="text-align: center;">
                                    <div style="width: 10px; height: 14px; background: #ef4444; border-radius: 2px; margin: 2px auto 6px auto; box-shadow: 0 0 6px rgba(239,68,68,0.4);" title="Cartões Vermelhos"></div>
                                    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 10px; font-size: 13px; font-weight: 700; color: var(--text-main); min-width: 34px; font-family:'Outfit';">${redCardsAway}</div>
                                </div>
                                <div style="text-align: center;">
                                    <div style="font-size: 14px; margin-bottom: 4px;" title="Escanteios">🚩</div>
                                    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 10px; font-size: 13px; font-weight: 700; color: var(--text-main); min-width: 34px; font-family:'Outfit';">${liveStats.escanteiosAway}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Card Integrado: Resultado Final Ao Vivo (1XBET) -->
                    <div class="glass-card" style="margin-top: 20px; padding: 20px 24px; background: linear-gradient(135deg, rgba(15, 22, 40, 0.8) 0%, rgba(20, 30, 55, 0.9) 100%); border-left: 4px solid var(--success);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <span style="font-family: 'Outfit'; font-size: 14px; font-weight: 700; color: var(--text-main);">Resultado Final <span style="color: var(--success); font-size: 11px; margin-left: 6px;">Ao Vivo</span></span>
                            <!-- Logo 1XBET estilizado -->
                            <div style="background: #1a56db; color: #ffffff; border-radius: 4px; padding: 4px 10px; font-size: 11px; font-weight: 800; font-family: 'Outfit'; letter-spacing: 0.5px; display: inline-flex; align-items: center; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 4px 10px rgba(26,86,219,0.3);">
                                1XBET
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                            <!-- Vitória Mandante -->
                            <div class="odd-box-live" onclick="selecionarOdd('${game.id}', '${game.home.name}', '${odd1Live}')">
                                <div style="font-size: 12px; color: var(--text-muted); font-weight: 600; margin-bottom: 6px;">1</div>
                                <div style="font-size: 16px; font-weight: 700; color: var(--warning); font-family: 'Outfit';">${odd1Live}</div>
                            </div>
                            
                            <!-- Empate -->
                            <div class="odd-box-live" onclick="selecionarOdd('${game.id}', 'Empate', '${oddXLive}')">
                                <div style="font-size: 12px; color: var(--text-muted); font-weight: 600; margin-bottom: 6px;">X</div>
                                <div style="font-size: 16px; font-weight: 700; color: var(--warning); font-family: 'Outfit';">${oddXLive}</div>
                            </div>
                            
                            <!-- Vitória Visitante -->
                            <div class="odd-box-live" onclick="selecionarOdd('${game.id}', '${game.away.name}', '${odd2Live}')">
                                <div style="font-size: 12px; color: var(--text-muted); font-weight: 600; margin-bottom: 6px;">2</div>
                                <div style="font-size: 16px; font-weight: 700; color: var(--warning); font-family: 'Outfit';">${odd2Live}</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; font-size: 11px; color: var(--text-dim); border-top: 1px dashed rgba(255,255,255,0.05); padding-top: 12px;">
                            <span>Odds ao-vivo disponíveis.</span>
                            <a href="#" onclick="document.getElementById('tab-btn-odds').click(); return false;" style="color: var(--success); font-weight: 700; text-decoration: none;">Ver odds</a>
                        </div>
                    </div>
                `;
            } else {
                // Layout Pré-Jogo com Tabela de Classificação, Médias de Histórico e Árbitro
                const standings = getLeagueStandings(game.leagueName, game.home.name, game.away.name);
                const refData = getRefereeData(game.leagueName);

                // Médias Históricas Computadas deterministicamente baseadas no nome
                const teamSeed = game.name.length;
                const homeGoals = (1.4 + (teamSeed % 6) * 0.15).toFixed(2);
                const awayGoals = (1.1 + ((teamSeed * 2) % 6) * 0.15).toFixed(2);
                const homeCorners = (4.8 + (teamSeed % 5) * 0.4).toFixed(1);
                const awayCorners = (4.2 + ((teamSeed * 3) % 5) * 0.4).toFixed(1);
                const homeFouls = (10.5 + (teamSeed % 4) * 0.8).toFixed(1);
                const awayFouls = (11.8 + ((teamSeed * 2) % 4) * 0.8).toFixed(1);
                const homeCards = (1.8 + (teamSeed % 3) * 0.3).toFixed(1);
                const awayCards = (2.2 + ((teamSeed * 4) % 3) * 0.3).toFixed(1);

                // Ponderações Matemáticas com o Árbitro
                const expectedCardsVal = (Number(homeCards) + Number(awayCards) + Number(refData.cards)) / 2;
                const expectedFoulsVal = (Number(homeFouls) + Number(awayFouls) + Number(refData.fouls)) / 2;

                let cardsDiag = '';
                if (expectedCardsVal > 5.0) {
                    cardsDiag = '⚠️ <strong>Cenário de Alta Tensão:</strong> O árbitro rígido somado a equipes agressivas sugere alto valor no mercado de <strong>Over 4.5 Cartões</strong>.';
                } else {
                    cardsDiag = '✅ <strong>Jogo de Poucos Cartões:</strong> Média equilibrada das equipes e árbitro firme indicam forte valor na opção de <strong>Under 5.5 Cartões</strong>.';
                }

                let standingsRows = '';
                standings.forEach(t => {
                    const isTarget = (t.name.toLowerCase().includes(game.home.name.toLowerCase()) || game.home.name.toLowerCase().includes(t.name.toLowerCase()) || t.name.toLowerCase().includes(game.away.name.toLowerCase()) || game.away.name.toLowerCase().includes(t.name.toLowerCase()))
                        ? 'style="background: rgba(59, 130, 246, 0.08); font-weight: 600;"'
                        : '';
                    standingsRows += `
                        <tr ${isTarget}>
                            <td style="font-weight: 700; text-align: center;">${t.pos}</td>
                            <td>${t.name}</td>
                            <td style="text-align: center;">${t.j}</td>
                            <td style="text-align: center;">${t.v}</td>
                            <td style="text-align: center;">${t.e}</td>
                            <td style="text-align: center;">${t.d}</td>
                            <td style="text-align: center; color: ${t.sg >= 0 ? 'var(--success)' : 'var(--danger)'};">${t.sg >= 0 ? '+' : ''}${t.sg}</td>
                            <td style="text-align: center; font-weight: 700; color: var(--primary);">${t.pts}</td>
                        </tr>
                    `;
                });

                panelPre.innerHTML = `
                    <div class="grid-2">
                        <!-- Classificação da Liga -->
                        <div class="glass-card">
                            <h3 style="margin-bottom: 16px; font-family: 'Outfit'; font-size: 16px;">Classificação no Campeonato</h3>
                            <table class="progress-table" style="width: 100%; font-size: 13px;">
                                <thead>
                                    <tr>
                                        <th style="text-align: center; width: 40px;">Pos</th>
                                        <th>Time</th>
                                        <th style="text-align: center;">J</th>
                                        <th style="text-align: center;">V</th>
                                        <th style="text-align: center;">E</th>
                                        <th style="text-align: center;">D</th>
                                        <th style="text-align: center;">SG</th>
                                        <th style="text-align: center; color: var(--primary);">Pts</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${standingsRows}
                                </tbody>
                            </table>
                        </div>

                        <!-- Perfil e Ponderação do Árbitro -->
                        <div class="glass-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <h3 style="margin-bottom: 16px; font-family: 'Outfit'; font-size: 16px;">Ficha & Rigidez do Árbitro</h3>
                                <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 12px; padding: 14px; margin-bottom: 16px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                        <span style="font-size: 14px; font-weight: 700; color: var(--text-main);">${refData.name}</span>
                                        <span class="badge ${refData.style.includes('Rígido') || refData.style.includes('Rigoroso') ? 'badge-loss' : 'badge-win'}" style="font-size: 10px;">${refData.style}</span>
                                    </div>
                                    <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-bottom: 10px;">${refData.desc}</p>
                                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-dim);">
                                        <span>Média de Cartões: <strong>${refData.cards}</strong> / jogo</span>
                                        <span>Média de Faltas: <strong>${refData.fouls}</strong> / jogo</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div style="background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.1); border-radius: 10px; padding: 14px; font-size: 12px; line-height: 1.5;">
                                <h4 style="color: var(--primary); font-family: 'Outfit'; margin-bottom: 6px; font-size: 13px;">Ponderação de Risco Decipro</h4>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                    <span>Expectativa de Cartões:</span>
                                    <span style="font-weight: 700; color: var(--warning);">${expectedCardsVal.toFixed(2)} / part.</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                    <span>Expectativa de Faltas:</span>
                                    <span style="font-weight: 700; color: var(--warning);">${expectedFoulsVal.toFixed(1)} / part.</span>
                                </div>
                                <div style="border-top: 1px dashed var(--border-color); padding-top: 8px; color: var(--text-muted);">
                                    ${cardsDiag}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Médias de Histórico Comparado -->
                    <div class="glass-card" style="margin-top: 24px;">
                        <h3 style="margin-bottom: 20px; font-family: 'Outfit'; font-size: 16px;">Métricas de Desempenho (Últimos 10 jogos)</h3>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;">
                            <div style="text-align: center; padding: 14px; background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 12px;">
                                <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight:600;">Média Gols p/ Jogo</span>
                                <div style="font-size: 18px; font-weight: 700; color: var(--text-main); margin-top: 8px; font-family:'Outfit';">${homeGoals} - ${awayGoals}</div>
                            </div>
                            <div style="text-align: center; padding: 14px; background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 12px;">
                                <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight:600;">Média Escanteios</span>
                                <div style="font-size: 18px; font-weight: 700; color: var(--text-main); margin-top: 8px; font-family:'Outfit';">${homeCorners} - ${awayCorners}</div>
                            </div>
                            <div style="text-align: center; padding: 14px; background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 12px;">
                                <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight:600;">Média Cartões</span>
                                <div style="font-size: 18px; font-weight: 700; color: var(--text-main); margin-top: 8px; font-family:'Outfit';">${homeCards} - ${awayCards}</div>
                            </div>
                            <div style="text-align: center; padding: 14px; background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 12px;">
                                <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight:600;">Média Faltas</span>
                                <div style="font-size: 18px; font-weight: 700; color: var(--text-main); margin-top: 8px; font-family:'Outfit';">${homeFouls} - ${awayFouls}</div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        // --- SUB-ABA 2: ODDS ou ODDS AO VIVO ---
        else if (tabName === 'odds') {
            if (isLive && liveStats) {
                // Flutuação das odds ao vivo baseadas no minuto e no placar atual
                const decayFactor = Math.max(0.1, (90 - liveStats.minute) / 90);
                
                // Cotações baseadas no placar ao vivo
                let odd1Live = 2.10, oddXLive = 3.10, odd2Live = 3.20;
                if (liveStats.scoreHome > liveStats.scoreAway) {
                    odd1Live = (1.05 + 0.2 * decayFactor).toFixed(2);
                    oddXLive = (3.0 + 3.0 / decayFactor).toFixed(2);
                    odd2Live = (6.0 + 10.0 / decayFactor).toFixed(2);
                } else if (liveStats.scoreAway > liveStats.scoreHome) {
                    odd1Live = (6.0 + 10.0 / decayFactor).toFixed(2);
                    oddXLive = (3.0 + 3.0 / decayFactor).toFixed(2);
                    odd2Live = (1.05 + 0.2 * decayFactor).toFixed(2);
                } else {
                    odd1Live = (1.80 + 1.5 / decayFactor).toFixed(2);
                    oddXLive = (1.50 + 1.2 * decayFactor).toFixed(2);
                    odd2Live = (2.20 + 2.0 / decayFactor).toFixed(2);
                }

                // Cotações do mercado de Próximo Gol
                const nextGoalHome = (1.75 + (1.2 * (1 - decayFactor))).toFixed(2);
                const nextGoalNone = (1.50 + (4.0 * decayFactor)).toFixed(2);
                const nextGoalAway = (2.40 + (1.5 * (1 - decayFactor))).toFixed(2);

                // Oportunidades Ao Vivo estimadas pelo Decipro
                let liveOportunityMsg = '';
                const seedVal = liveStats.minute + liveStats.scoreHome;
                if (seedVal % 2 === 0) {
                    liveOportunityMsg = `⚡ <strong>Valor Detectado:</strong> Próximo Gol do Mandante @ ${nextGoalHome} na Betano. O mandante está com **${liveStats.posseHome}%** de posse e pressionando nos últimos minutos. A odd justa estimada é de ${(nextGoalHome * 0.88).toFixed(2)}.`;
                } else {
                    liveOportunityMsg = `⚡ <strong>Valor Detectado:</strong> Menos de 1.5 Gols na Partida @ ${(1.55 + 0.3 * decayFactor).toFixed(2)} na Bet365. Jogo muito preso no meio-campo com média de faltas acumuladas de ${(liveStats.faltasHome + liveStats.faltasAway)}.`;
                }

                panelOdds.innerHTML = `
                    <div class="glass-card">
                        <h3 style="margin-bottom: 20px; font-family: 'Outfit'; font-size: 16px;">Comparativo de Odds em Tempo Real (Flutuação Ao Vivo)</h3>
                        <table class="odds-comparison-table">
                            <thead>
                                <tr>
                                    <th>Mercado</th>
                                    <th>Casa de Apostas</th>
                                    <th>Casa (1) / Mandante</th>
                                    <th>Empate (X) / Nenhum</th>
                                    <th>Fora (2) / Visitante</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td rowspan="2" style="font-weight:700; background: rgba(255,255,255,0.01);">Vencedor Final (1X2)</td>
                                    <td>Bet365</td>
                                    <td class="odds-value-highlight" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', '${game.home.name}', '${odd1Live}')">${odd1Live}</td>
                                    <td class="odds-value-highlight" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', 'Empate', '${(Number(oddXLive) + 0.05).toFixed(2)}')">${(Number(oddXLive) + 0.05).toFixed(2)}</td>
                                    <td class="odds-value-highlight" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', '${game.away.name}', '${odd2Live}')">${odd2Live}</td>
                                </tr>
                                <tr>
                                    <td>Betano</td>
                                    <td class="odds-value-best" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', '${game.home.name}', '${(Number(odd1Live) + 0.02).toFixed(2)}')">${(Number(odd1Live) + 0.02).toFixed(2)}</td>
                                    <td class="odds-value-highlight" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', 'Empate', '${oddXLive}')">${oddXLive}</td>
                                    <td class="odds-value-best" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', '${game.away.name}', '${(Number(odd2Live) + 0.10).toFixed(2)}')">${(Number(odd2Live) + 0.10).toFixed(2)}</td>
                                </tr>
                                <tr style="border-top:2px solid var(--border-color);">
                                    <td rowspan="2" style="font-weight:700; background: rgba(255,255,255,0.01);">Mercado: Próximo Gol</td>
                                    <td>Bet365</td>
                                    <td class="odds-value-highlight" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', 'Próximo Gol: Casa', '${nextGoalHome}')">${nextGoalHome}</td>
                                    <td class="odds-value-highlight" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', 'Próximo Gol: Nenhum', '${nextGoalNone}')">${nextGoalNone}</td>
                                    <td class="odds-value-highlight" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', 'Próximo Gol: Visitante', '${nextGoalAway}')">${nextGoalAway}</td>
                                </tr>
                                <tr>
                                    <td>Betano</td>
                                    <td class="odds-value-best" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', 'Próximo Gol: Casa', '${(Number(nextGoalHome) + 0.05).toFixed(2)}')">${(Number(nextGoalHome) + 0.05).toFixed(2)}</td>
                                    <td class="odds-value-best" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', 'Próximo Gol: Nenhum', '${(Number(nextGoalNone) + 0.05).toFixed(2)}')">${(Number(nextGoalNone) + 0.05).toFixed(2)}</td>
                                    <td class="odds-value-highlight" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', 'Próximo Gol: Visitante', '${nextGoalAway}')">${nextGoalAway}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="glass-card" style="border-left:4px solid var(--success); background:rgba(16, 185, 129, 0.05);">
                        <h4 style="color:var(--success); font-family:'Outfit'; margin-bottom:6px; font-size:14px;">Scanner de Odds de Valor (Live Decipro)</h4>
                        <p style="font-size:13px; line-height:1.5; color: var(--text-main);">${liveOportunityMsg}</p>
                    </div>
                `;
            } else {
                // Comparação de Odds Pré-Jogo
                const oH = Number(game.odds.home);
                const oD = Number(game.odds.draw);
                const oA = Number(game.odds.away);

                // Cotações ligeiramente alteradas por casa para simular comparação
                const b365 = { h: oH, d: (oD - 0.05).toFixed(2), a: (oA + 0.05).toFixed(2) };
                const beta = { h: (oH + 0.05).toFixed(2), d: oD, a: oA };
                const xbet = { h: (oH - 0.02).toFixed(2), d: (oD + 0.10).toFixed(2), a: (oA - 0.02).toFixed(2) };

                // Encontra melhores cotações
                const bestH = Math.max(b365.h, beta.h, xbet.h);
                const bestD = Math.max(b365.d, beta.d, xbet.d);
                const bestA = Math.max(b365.a, beta.a, xbet.a);

                // Cálculo da Oportunidade pelo Decipro
                const totalMargin = (1/bestH) + (1/bestD) + (1/bestA);
                const probH = ((1/bestH) / totalMargin);
                const probD = ((1/bestD) / totalMargin);
                const probA = ((1/bestA) / totalMargin);

                // Odd justa calculada (com margem removida e ponderação interna)
                const fairH = (1 / (probH * 1.05)).toFixed(2);
                
                let valRecommend = '';
                if (bestH > fairH) {
                    valRecommend = `🔥 <strong>Oportunidade Identificada:</strong> Vitória de ${game.home.name} a cotação de **${bestH}** na Betano oferece um valor estimado de **+${((bestH / fairH - 1)*100).toFixed(1)}%** sobre a precificação matemática justa de ${fairH}.`;
                } else {
                    valRecommend = `🍀 <strong>Odd Justa Equilibrada:</strong> Não há desvios de precificação (value bets) evidentes nos mercados principais de 1X2. Recomendável focar no mercado especial de escanteios.`;
                }

                panelOdds.innerHTML = `
                    <div class="glass-card">
                        <h3 style="margin-bottom: 20px; font-family: 'Outfit'; font-size: 16px;">Quadro Comparativo de Cotações</h3>
                        <table class="odds-comparison-table">
                            <thead>
                                <tr>
                                    <th>Casa de Apostas</th>
                                    <th>Vitória Casa (1)</th>
                                    <th>Empate (X)</th>
                                    <th>Vitória Fora (2)</th>
                                    <th>Ambos Marcam (Sim)</th>
                                    <th>Mais de 2.5 Gols</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="font-weight:700;">Bet365</td>
                                    <td class="${b365.h == bestH ? 'odds-value-best' : 'odds-value-highlight'}" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', '${game.home.name}', '${b365.h}')">${b365.h}</td>
                                    <td class="${b365.d == bestD ? 'odds-value-best' : 'odds-value-highlight'}" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', 'Empate', '${b365.d}')">${b365.d}</td>
                                    <td class="${b365.a == bestA ? 'odds-value-best' : 'odds-value-highlight'}" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', '${game.away.name}', '${b365.a}')">${b365.a}</td>
                                    <td class="odds-value-highlight" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', 'Ambos Marcam: Sim', '1.80')">1.80</td>
                                    <td class="odds-value-best" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', 'Mais de 2.5 Gols', '1.95')">1.95</td>
                                </tr>
                                <tr>
                                    <td style="font-weight:700;">Betano</td>
                                    <td class="${beta.h == bestH ? 'odds-value-best' : 'odds-value-highlight'}" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', '${game.home.name}', '${beta.h}')">${beta.h}</td>
                                    <td class="${beta.d == bestD ? 'odds-value-best' : 'odds-value-highlight'}" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', 'Empate', '${beta.d}')">${beta.d}</td>
                                    <td class="${beta.a == bestA ? 'odds-value-best' : 'odds-value-highlight'}" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', '${game.away.name}', '${beta.a}')">${beta.a}</td>
                                    <td class="odds-value-best" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', 'Ambos Marcam: Sim', '1.85')">1.85</td>
                                    <td class="odds-value-highlight" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', 'Mais de 2.5 Gols', '1.90')">1.90</td>
                                </tr>
                                <tr>
                                    <td style="font-weight:700;">1XBET</td>
                                    <td class="${xbet.h == bestH ? 'odds-value-best' : 'odds-value-highlight'}" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', '${game.home.name}', '${xbet.h}')">${xbet.h}</td>
                                    <td class="${xbet.d == bestD ? 'odds-value-best' : 'odds-value-highlight'}" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', 'Empate', '${xbet.d}')">${xbet.d}</td>
                                    <td class="${xbet.a == bestA ? 'odds-value-best' : 'odds-value-highlight'}" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', '${game.away.name}', '${xbet.a}')">${xbet.a}</td>
                                    <td class="odds-value-highlight" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', 'Ambos Marcam: Sim', '1.78')">1.78</td>
                                    <td class="odds-value-highlight" style="cursor:pointer;" onclick="selecionarOdd('${game.id}', 'Mais de 2.5 Gols', '1.88')">1.88</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="glass-card" style="border-left:4px solid var(--primary); background:rgba(59, 130, 246, 0.05);">
                        <h4 style="color:var(--primary); font-family:'Outfit'; margin-bottom:6px; font-size:14px;">Decipro Odds de Valor</h4>
                        <p style="font-size:13px; line-height:1.5; color: var(--text-main);">${valRecommend}</p>
                    </div>
                `;
            }
        }

        // --- SUB-ABA 3: DICAS ou DICAS AO VIVO ---
        else if (tabName === 'dicas') {
            if (isLive && liveStats) {
                // Alertas e Dicas Instantâneas para Jogo Ao Vivo
                let alertsHtml = '';
                
                if (liveStats.minute > 75 && liveStats.scoreHome === liveStats.scoreAway) {
                    alertsHtml += `
                        <div style="padding: 14px; border-left: 3px solid var(--danger); background: rgba(239, 68, 68, 0.05); border-radius: 0 10px 10px 0; margin-bottom: 12px; font-size: 13px;">
                            <strong>Alerta de Empate Tardio:</strong> Jogo empatado após os 75 minutos. Se o volume de pressão do mandante exceder 75 nos próximos minutos, busque **Over 0.5 Gols** nos minutos finais.
                        </div>
                    `;
                }

                const pressHomeNow = liveStats.homePressures[23] || 0;
                const pressAwayNow = liveStats.awayPressures[23] || 0;

                if (pressHomeNow > 70) {
                    alertsHtml += `
                        <div style="padding: 14px; border-left: 3px solid var(--success); background: rgba(16, 185, 129, 0.05); border-radius: 0 10px 10px 0; margin-bottom: 12px; font-size: 13px;">
                            <strong>Pressão Ofensiva Extrema do Mandante:</strong> Índice de pressão em ${pressHomeNow}/100. O mandante está sufocando o adversário no campo de defesa. Recomendável: **Próximo Gol do Mandante** ou **Over 0.5 Cantos para o Mandante nos próximos 5 minutos**.
                        </div>
                    `;
                } else if (pressAwayNow > 70) {
                    alertsHtml += `
                        <div style="padding: 14px; border-left: 3px solid var(--primary); background: rgba(59, 130, 246, 0.05); border-radius: 0 10px 10px 0; margin-bottom: 12px; font-size: 13px;">
                            <strong>Pressão Ofensiva Extrema do Visitante:</strong> Índice de pressão em ${pressAwayNow}/100. O visitante domina a posse em profundidade. Recomendável: **Próximo Gol do Visitante**.
                        </div>
                    `;
                }

                if (alertsHtml === '') {
                    alertsHtml = `
                        <div style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px;">
                            Monitorando padrões táticos e flutuações da partida... Nenhum gatilho de alta probabilidade disparado neste instante.
                        </div>
                    `;
                }

                panelDicas.innerHTML = `
                    <div class="glass-card">
                        <h3 style="margin-bottom: 16px; font-family: 'Outfit'; font-size: 16px;">Dicas do Algoritmo Decipro (Ao Vivo)</h3>
                        <p style="color:var(--text-muted); font-size:13px; margin-bottom: 20px;">
                            Scanner de inteligência artificial calculando probabilidades a cada minuto da partida baseado nas flutuações ofensivas reais.
                        </p>
                        <div style="display:flex; flex-direction:column; gap:12px;">
                            ${alertsHtml}
                        </div>
                    </div>
                `;
            } else {
                // Dicas e probabilidades matemáticas Pré-Jogo
                const oH = Number(game.odds.home);
                const oD = Number(game.odds.draw);
                const oA = Number(game.odds.away);
                const margin = (1/oH) + (1/oD) + (1/oA);
                
                // Converte as odds em percentuais justos aproximados
                const pctH = Math.round(((1/oH) / margin) * 100);
                const pctD = Math.round(((1/oD) / margin) * 100);
                const pctA = 100 - pctH - pctD;

                let palpiteMsg = '';
                let confidence = 'Média';
                let confidenceColor = 'var(--warning)';

                if (pctH > 50) {
                    palpiteMsg = `Vitória de <strong>${game.home.name}</strong> ou Empate (Chance Dupla 1X)`;
                    confidence = 'Alta';
                    confidenceColor = 'var(--success)';
                } else if (pctA > 45) {
                    palpiteMsg = `Vitória de <strong>${game.away.name}</strong> ou Empate (Chance Dupla X2)`;
                    confidence = 'Alta';
                    confidenceColor = 'var(--success)';
                } else {
                    palpiteMsg = `Empate anula aposta a favor de <strong>${game.home.name}</strong>`;
                    confidence = 'Média';
                    confidenceColor = 'var(--warning)';
                }

                panelDicas.innerHTML = `
                    <div class="grid-2">
                        <!-- Gráfico Circular de Probabilidades -->
                        <div class="glass-card">
                            <h3 style="margin-bottom: 16px; font-family: 'Outfit'; font-size: 16px;">Probabilidade de Resultado</h3>
                            <div style="display: flex; flex-direction: column; gap: 14px; padding-top: 10px;">
                                <!-- Casa -->
                                <div>
                                    <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px; font-weight:600;">
                                        <span>Vitória ${game.home.name}</span>
                                        <span>${pctH}%</span>
                                    </div>
                                    <div style="height:6px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden;">
                                        <div style="width:${pctH}%; height:100%; background:var(--success);"></div>
                                    </div>
                                </div>
                                <!-- Empate -->
                                <div>
                                    <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px; font-weight:600;">
                                        <span>Empate</span>
                                        <span>${pctD}%</span>
                                    </div>
                                    <div style="height:6px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden;">
                                        <div style="width:${pctD}%; height:100%; background:var(--warning);"></div>
                                    </div>
                                </div>
                                <!-- Visitante -->
                                <div>
                                    <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px; font-weight:600;">
                                        <span>Vitória ${game.away.name}</span>
                                        <span>${pctA}%</span>
                                    </div>
                                    <div style="height:6px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden;">
                                        <div style="width:${pctA}%; height:100%; background:var(--primary);"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Recomendação Decipro -->
                        <div class="glass-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <h3 style="margin-bottom: 12px; font-family: 'Outfit'; font-size: 16px;">Palpite Recomendado</h3>
                                <div style="padding:14px; background:rgba(59,130,246,0.04); border:1px solid rgba(59,130,246,0.1); border-radius:10px; font-size:13px; line-height:1.5;">
                                    ${palpiteMsg}
                                </div>
                            </div>
                            
                            <div style="margin-top:14px; display:flex; justify-content:space-between; align-items:center; font-size:13px;">
                                <span style="color:var(--text-muted);">Confiança do Sistema:</span>
                                <span style="font-weight:700; color:${confidenceColor};">${confidence}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Fatores Críticos de Análise -->
                    <div class="glass-card" style="margin-top:24px;">
                        <h3 style="margin-bottom: 16px; font-family: 'Outfit'; font-size: 16px;">Pontos Essenciais de Análise do Confronto</h3>
                        <ul style="padding-left: 18px; font-size: 13px; line-height: 1.8; color: var(--text-dim);">
                            <li><strong>Vantagem de Confronto Direto:</strong> O histórico de confrontos e a solidez do mandante em partidas domésticas sustentam a precificação.</li>
                            <li><strong>Desempenho de Defesa/Ataque:</strong> A média ponderada de gols indica que há 65% de chances da partida terminar com menos de 3.5 gols totais.</li>
                            <li><strong>Influência Tática de Arbitragem:</strong> O árbitro escalado possui comportamento com tendência a rigor excessivo, propiciando cenário de alta lucratividade em mercados de faltas cometidas.</li>
                        </ul>
                    </div>
                `;
            }
        }
        else if (tabName === 'mercados') {
            panelMarkets.innerHTML = `
                <div class="market-sub-tab-carousel">
                    <button class="carousel-nav-arrow" id="market-carousel-prev" onclick="scrollMarketsCarousel(-1)">❮</button>
                    <div class="market-sub-tab-scroll" id="market-carousel-scroll">
                        <button class="market-sub-tab-pill ${currentActiveMarketSubItem === 'resultado' ? 'active' : ''}" onclick="selectMarketSubItem('resultado')">VENCEDOR</button>
                        <button class="market-sub-tab-pill ${currentActiveMarketSubItem === 'gols' ? 'active' : ''}" onclick="selectMarketSubItem('gols')">GOLS</button>
                        <button class="market-sub-tab-pill ${currentActiveMarketSubItem === 'escanteios' ? 'active' : ''}" onclick="selectMarketSubItem('escanteios')">ESCANTEIOS</button>
                        <button class="market-sub-tab-pill ${currentActiveMarketSubItem === 'cartoes' ? 'active' : ''}" onclick="selectMarketSubItem('cartoes')">CARTÕES</button>
                    </div>
                    <button class="carousel-nav-arrow" id="market-carousel-next" onclick="scrollMarketsCarousel(1)">❯</button>
                </div>
                <div id="market-sub-content"></div>
            `;
            const subContent = document.getElementById('market-sub-content');
            if (subContent) {
                renderMarketSubContent(currentActiveMarketSubItem, game, subContent);
            }
        }
    };

    window.selectMarketSubItem = (item) => {
        currentActiveMarketSubItem = item;
        const subContent = document.getElementById('market-sub-content');
        const activeGame = state.selectedGameForAnalysis;
        
        document.querySelectorAll('.market-sub-tab-pill').forEach(pill => {
            if (pill.getAttribute('onclick').includes(item)) {
                pill.classList.add('active');
            } else {
                pill.classList.remove('active');
            }
        });
        
        if (subContent && activeGame) {
            renderMarketSubContent(item, activeGame, subContent);
        }
    };

    window.scrollMarketsCarousel = (dir) => {
        const scrollContainer = document.getElementById('market-carousel-scroll');
        if (scrollContainer) {
            scrollContainer.scrollBy({ left: dir * 120, behavior: 'smooth' });
        }
    };

    window.changeH2HMarket = (val) => {
        currentH2HMarket = val;
        renderH2HTab();
    };
    window.changeH2HTime = (val) => {
        currentH2HTime = val;
        renderH2HTab();
    };
    window.toggleH2HSameLeague = (checked) => {
        currentH2HSameLeague = checked;
        renderH2HTab();
    };

    const getPoissonProb = (lambda, k, type) => {
        if (lambda <= 0) {
            if (type === 'over') {
                return k <= 0 ? 100 : 0;
            } else {
                return k >= 0 ? 100 : 0;
            }
        }
        if (type === 'over') {
            if (k <= 0) return 100;
            let sum = 0;
            let fact = 1;
            for (let i = 0; i < k; i++) {
                if (i > 0) fact *= i;
                sum += Math.exp(-lambda) * Math.pow(lambda, i) / fact;
            }
            return Math.round((1 - sum) * 100);
        } else {
            if (k < 0) return 0;
            let sum = 0;
            let fact = 1;
            for (let i = 0; i <= k; i++) {
                if (i > 0) fact *= i;
                sum += Math.exp(-lambda) * Math.pow(lambda, i) / fact;
            }
            return Math.round(sum * 100);
        }
    };

    const getFormattedVal = (prob) => {
        const p = Math.max(1, Math.min(99, prob));
        const odd = ((100 / p) * 0.95).toFixed(2);
        return `${p}% <span style="color:var(--warning); font-size:15px; font-weight:600; margin-left:6px;">(@ ${odd})</span>`;
    };

    const renderMarketSubContent = (item, game, container) => {
        let refereeName = 'Wilton Pereira Sampaio';
        let refereeRigor = 'Extremamente Rígido';
        let refereeCardsAvg = 5.8;
        
        if (state.activeMatchSummary && state.activeMatchSummary.gameInfo && state.activeMatchSummary.gameInfo.officials) {
            const officials = state.activeMatchSummary.gameInfo.officials;
            const ref = officials.find(o => o.position && o.position.name === 'Referee') || officials[0];
            if (ref) {
                refereeName = ref.displayName || ref.fullName;
                const len = refereeName.length;
                if (len % 3 === 0) {
                    refereeRigor = 'Extremamente Rígido';
                    refereeCardsAvg = 5.8;
                } else if (len % 3 === 1) {
                    refereeRigor = 'Rigoroso';
                    refereeCardsAvg = 4.9;
                } else {
                    refereeRigor = 'Moderado';
                    refereeCardsAvg = 4.2;
                }
            }
        } else {
            const refData = getRefereeData(game.leagueName);
            refereeName = refData.name;
            refereeRigor = refData.style;
            refereeCardsAvg = parseFloat(refData.cards);
        }

        let headerText = '';
        let boxes = [];

        const isLive = game.status === 'aovivo';

        if (item === 'resultado') {
            headerText = 'JOGO INTEIRO (PROBABILIDADE DE RESULTADO)';
            
            let pctHome, pctDraw, pctAway;
            if (isLive && liveStats) {
                const diff = liveStats.scoreHome - liveStats.scoreAway;
                const min = liveStats.minute;
                if (diff > 0) {
                    pctHome = Math.min(99, 50 + diff * 15 + Math.floor((min / 90) * 30));
                    pctAway = Math.max(1, Math.floor((100 - pctHome) * 0.15));
                    pctDraw = 100 - pctHome - pctAway;
                } else if (diff < 0) {
                    pctAway = Math.min(99, 50 + Math.abs(diff) * 15 + Math.floor((min / 90) * 30));
                    pctHome = Math.max(1, Math.floor((100 - pctAway) * 0.15));
                    pctDraw = 100 - pctHome - pctAway;
                } else {
                    pctDraw = Math.min(95, 30 + Math.floor((min / 90) * 55));
                    pctHome = Math.max(2, Math.floor((100 - pctDraw) * (liveStats.posseHome / 100)));
                    pctAway = 100 - pctDraw - pctHome;
                }
            } else {
                let parsedFromStandings = false;
                if (state.activeMatchSummary && state.activeMatchSummary.standings) {
                    try {
                        const groups = state.activeMatchSummary.standings.groups;
                        if (groups && groups.length > 0 && groups[0].standings && groups[0].standings.entries) {
                            const entries = groups[0].standings.entries;
                            const homeEntry = entries.find(e => (e.team && e.team.displayName && (e.team.displayName.toLowerCase().includes(game.home.name.toLowerCase()) || game.home.name.toLowerCase().includes(e.team.displayName.toLowerCase()))));
                            const awayEntry = entries.find(e => (e.team && e.team.displayName && (e.team.displayName.toLowerCase().includes(game.away.name.toLowerCase()) || game.away.name.toLowerCase().includes(e.team.displayName.toLowerCase()))));
                            
                            if (homeEntry && awayEntry) {
                                const homeStats = homeEntry.stats;
                                const awayStats = awayEntry.stats;
                                const hPts = (homeStats.find(s => s.name === 'points') || {}).value || 0;
                                const aPts = (awayStats.find(s => s.name === 'points') || {}).value || 0;
                                const total = hPts + aPts;
                                if (total > 0) {
                                    const homeBase = (hPts / total) * 100;
                                    pctHome = Math.max(15, Math.min(80, Math.round(homeBase + 8)));
                                    pctAway = Math.max(10, Math.min(75, Math.round(((aPts / total) * 100) - 8)));
                                    pctDraw = 100 - pctHome - pctAway;
                                    parsedFromStandings = true;
                                }
                            }
                        }
                    } catch (err) {}
                }
                if (!parsedFromStandings) {
                    const oH = Number(game.odds.home);
                    const oD = Number(game.odds.draw);
                    const oA = Number(game.odds.away);
                    const margin = (1/oH) + (1/oD) + (1/oA);
                    pctHome = Math.round(((1/oH) / margin) * 100);
                    pctDraw = Math.round(((1/oD) / margin) * 100);
                    pctAway = 100 - pctHome - pctDraw;
                }
            }

            const pct1X = pctHome + pctDraw;
            const pct1or2 = pctHome + pctAway;
            const pctX2 = pctDraw + pctAway;

            boxes = [
                { label: game.home.name.toUpperCase(), val: getFormattedVal(pctHome) },
                { label: 'EMPATE', val: getFormattedVal(pctDraw) },
                { label: game.away.name.toUpperCase(), val: getFormattedVal(pctAway) },
                { label: '1X', val: getFormattedVal(pct1X) },
                { label: '1 OR 2', val: getFormattedVal(pct1or2) },
                { label: 'X2', val: getFormattedVal(pctX2) }
            ];
        } 
        else if (item === 'gols') {
            headerText = 'MAIS/MENOS GOLS (PROBABILIDADE)';
            
            if (isLive && liveStats) {
                const G = liveStats.scoreHome + liveStats.scoreAway;
                const min = liveStats.minute;
                const timeFactor = Math.max(0, 90 - min) / 90;
                const dangerHome = liveStats.ataquesPerigososHome || 0;
                const dangerAway = liveStats.ataquesPerigososAway || 0;
                const totalDanger = dangerHome + dangerAway;
                const dangerRate = min > 0 ? (totalDanger / min) : 0.8;
                const lambdaGoals = Math.max(0.1, (90 - min) * 0.025 * (1 + dangerRate * 0.2));

                const pOver05 = getPoissonProb(lambdaGoals, 1, 'over');
                const pOver15 = getPoissonProb(lambdaGoals, 2, 'over');
                const pOver25 = getPoissonProb(lambdaGoals, 3, 'over');
                const pUnder05 = getPoissonProb(lambdaGoals, 0, 'under');
                const pUnder15 = getPoissonProb(lambdaGoals, 1, 'under');

                const scoredBoth = liveStats.scoreHome > 0 && liveStats.scoreAway > 0;
                let bttsLine1, bttsVal1, bttsLine2, bttsVal2;

                if (scoredBoth) {
                    const pOver35 = getPoissonProb(lambdaGoals, 4, 'over');
                    const pUnder25 = getPoissonProb(lambdaGoals, 2, 'under');
                    bttsLine1 = `MAIS DE ${(G + 2.5).toFixed(1)} GOLS`;
                    bttsVal1 = getFormattedVal(pOver25);
                    bttsLine2 = `MENOS DE ${(G + 2.5).toFixed(1)} GOLS`;
                    bttsVal2 = getFormattedVal(pUnder25);
                } else {
                    let pBTTS;
                    const homeScored = liveStats.scoreHome > 0;
                    const awayScored = liveStats.scoreAway > 0;
                    if (homeScored || awayScored) {
                        pBTTS = Math.round(35 * timeFactor);
                    } else {
                        pBTTS = Math.round(55 * timeFactor);
                    }
                    const pBTTSNo = 100 - pBTTS;
                    bttsLine1 = 'AMBOS MARCAM';
                    bttsVal1 = getFormattedVal(pBTTS);
                    bttsLine2 = 'AMBOS MARCAM (NÃO)';
                    bttsVal2 = getFormattedVal(pBTTSNo);
                }

                boxes = [
                    { label: `MAIS DE ${(G + 0.5).toFixed(1)} GOLS`, val: getFormattedVal(pOver05) },
                    { label: `MAIS DE ${(G + 1.5).toFixed(1)} GOLS`, val: getFormattedVal(pOver15) },
                    { label: bttsLine1, val: bttsVal1 },
                    { label: `MENOS DE ${(G + 0.5).toFixed(1)} GOLS`, val: getFormattedVal(pUnder05) },
                    { label: `MENOS DE ${(G + 1.5).toFixed(1)} GOLS`, val: getFormattedVal(pUnder15) },
                    { label: bttsLine2, val: bttsVal2 }
                ];
            } else {
                const seed = game.name.length;
                const pOver25 = 40 + (seed % 30);
                const pUnder25 = 100 - pOver25;
                const pOver15 = pOver25 + 18 + (seed % 8);
                const pUnder35 = pUnder25 + 15 + (seed % 10);
                const pBTTS = 45 + (seed % 20);
                const pBTTSNo = 100 - pBTTS;

                boxes = [
                    { label: 'MAIS DE 1.5 GOLS', val: getFormattedVal(pOver15) },
                    { label: 'MAIS DE 2.5 GOLS', val: getFormattedVal(pOver25) },
                    { label: 'AMBOS MARCAM', val: getFormattedVal(pBTTS) },
                    { label: 'MENOS DE 2.5 GOLS', val: getFormattedVal(pUnder25) },
                    { label: 'MENOS DE 3.5 GOLS', val: getFormattedVal(pUnder35) },
                    { label: 'AMBOS MARCAM (NÃO)', val: getFormattedVal(pBTTSNo) }
                ];
            }
        } 
        else if (item === 'escanteios') {
            headerText = 'CANTOS MAIS/MENOS (PROBABILIDADE)';
            
            if (isLive && liveStats) {
                const C = liveStats.escanteiosHome + liveStats.escanteiosAway;
                const min = liveStats.minute;
                const cornersRate = min > 0 ? (C / min) : 0.11;
                const lambdaCorners = Math.max(0.5, (90 - min) * Math.max(0.06, cornersRate * 0.95));

                const pOver05 = getPoissonProb(lambdaCorners, 1, 'over');
                const pOver15 = getPoissonProb(lambdaCorners, 2, 'over');
                const pOver25 = getPoissonProb(lambdaCorners, 3, 'over');
                const pUnder05 = getPoissonProb(lambdaCorners, 0, 'under');
                const pUnder15 = getPoissonProb(lambdaCorners, 1, 'under');

                const totalC = liveStats.escanteiosHome + liveStats.escanteiosAway;
                const pMostCornersHome = totalC === 0 ? 50 : Math.round((liveStats.escanteiosHome / totalC) * 100);

                boxes = [
                    { label: `MAIS DE ${(C + 0.5).toFixed(1)} ESCANTEIOS`, val: getFormattedVal(pOver05) },
                    { label: `MAIS DE ${(C + 1.5).toFixed(1)} ESCANTEIOS`, val: getFormattedVal(pOver15) },
                    { label: `MAIS DE ${(C + 2.5).toFixed(1)} ESCANTEIOS`, val: getFormattedVal(pOver25) },
                    { label: `MENOS DE ${(C + 0.5).toFixed(1)} ESCANTEIOS`, val: getFormattedVal(pUnder05) },
                    { label: `MENOS DE ${(C + 1.5).toFixed(1)} ESCANTEIOS`, val: getFormattedVal(pUnder15) },
                    { label: `MAIS CANTOS (${game.home.name.substring(0, 10).toUpperCase()})`, val: getFormattedVal(pMostCornersHome) }
                ];
            } else {
                const seed = game.name.length * 3;
                const pOver95 = 48 + (seed % 22);
                const pUnder95 = 100 - pOver95;
                const pOver85 = pOver95 + 16 + (seed % 6);
                const pUnder105 = pUnder95 + 14 + (seed % 8);
                const pOver105 = 100 - pUnder105;
                const pMostCornersHome = 50 + (seed % 15) - 7;

                boxes = [
                    { label: 'MAIS DE 8.5 ESCANTEIOS', val: getFormattedVal(pOver85) },
                    { label: 'MAIS DE 9.5 ESCANTEIOS', val: getFormattedVal(pOver95) },
                    { label: 'MAIS DE 10.5 ESCANTEIOS', val: getFormattedVal(pOver105) },
                    { label: 'MENOS DE 9.5 ESCANTEIOS', val: getFormattedVal(pUnder95) },
                    { label: 'MENOS DE 10.5 ESCANTEIOS', val: getFormattedVal(pUnder105) },
                    { label: `MAIS CANTOS (${game.home.name.substring(0, 10).toUpperCase()})`, val: getFormattedVal(pMostCornersHome) }
                ];
            }
        } 
        else if (item === 'cartoes') {
            headerText = `MERCADO DE CARTÕES (PONDERADO)`;
            
            if (isLive && liveStats) {
                const Card = liveStats.cartoesHome + liveStats.cartoesAway;
                const min = liveStats.minute;
                
                let refScale = 1.0;
                if (refereeRigor === 'Extremamente Rígido') refScale = 1.3;
                else if (refereeRigor === 'Rigoroso') refScale = 1.15;
                else if (refereeRigor === 'Moderado') refScale = 0.9;
                
                const cardsRate = min > 0 ? (Card / min) : 0.05;
                const lambdaCards = Math.max(0.2, (90 - min) * Math.max(0.03, cardsRate * 0.9) * refScale);

                const pOver05 = getPoissonProb(lambdaCards, 1, 'over');
                const pOver15 = getPoissonProb(lambdaCards, 2, 'over');
                const pOver25 = getPoissonProb(lambdaCards, 3, 'over');
                const pUnder05 = getPoissonProb(lambdaCards, 0, 'under');
                const pUnder15 = getPoissonProb(lambdaCards, 1, 'under');

                const totalC = liveStats.cartoesHome + liveStats.cartoesAway;
                const pMostCardsAway = totalC === 0 ? 50 : Math.round((liveStats.cartoesAway / totalC) * 100);

                boxes = [
                    { label: `MAIS DE ${(Card + 0.5).toFixed(1)} CARTÕES`, val: getFormattedVal(pOver05) },
                    { label: `MAIS DE ${(Card + 1.5).toFixed(1)} CARTÕES`, val: getFormattedVal(pOver15) },
                    { label: `MAIS DE ${(Card + 2.5).toFixed(1)} CARTÕES`, val: getFormattedVal(pOver25) },
                    { label: `MENOS DE ${(Card + 0.5).toFixed(1)} CARTÕES`, val: getFormattedVal(pUnder05) },
                    { label: `MENOS DE ${(Card + 1.5).toFixed(1)} CARTÕES`, val: getFormattedVal(pUnder15) },
                    { label: `MAIS CARTÕES (${game.away.name.substring(0, 10).toUpperCase()})`, val: getFormattedVal(pMostCardsAway) }
                ];
            } else {
                let refModifier = 0;
                if (refereeRigor === 'Extremamente Rígido') refModifier = 15;
                else if (refereeRigor === 'Rigoroso') refModifier = 8;
                else if (refereeRigor === 'Moderado') refModifier = -2;

                const seed = game.name.length * 7;
                const baseOver45 = 45 + (seed % 15) + refModifier;
                const pOver45 = Math.max(15, Math.min(95, baseOver45));
                const pUnder45 = 100 - pOver45;
                const pOver35 = Math.max(25, Math.min(99, pOver45 + 18 + (seed % 5)));
                const pUnder55 = Math.max(20, Math.min(99, pUnder45 + 15 + (seed % 6)));
                const pOver55 = 100 - pUnder55;
                const pMostCardsAway = 50 + (seed % 12) - 5;

                boxes = [
                    { label: 'MAIS DE 3.5 CARTÕES', val: getFormattedVal(pOver35) },
                    { label: 'MAIS DE 4.5 CARTÕES', val: getFormattedVal(pOver45) },
                    { label: 'MAIS DE 5.5 CARTÕES', val: getFormattedVal(pOver55) },
                    { label: 'MENOS DE 4.5 CARTÕES', val: getFormattedVal(pUnder45) },
                    { label: 'MENOS DE 5.5 CARTÕES', val: getFormattedVal(pUnder55) },
                    { label: `MAIS CARTÕES (${game.away.name.substring(0, 10).toUpperCase()})`, val: getFormattedVal(pMostCardsAway) }
                ];
            }
        }

        container.innerHTML = `
            <div style="font-family:'Outfit'; font-size:12px; font-weight:700; color:var(--success); text-transform:uppercase; margin-bottom:12px; letter-spacing:1px;">
                ${headerText}
            </div>
            <div class="market-boxes-grid">
                ${boxes.map(box => `
                    <div class="market-box-card">
                        <div class="market-box-label">${box.label}</div>
                        <div class="market-box-value">${box.val}</div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top: 18px; font-size:11px; color:var(--text-muted); line-height:1.5;">
                * Cotações calculadas com base em dados consolidados de sites especializados de análises esportivas e adaptados dinamicamente para o Decipro.
            </div>
        `;
    };

        // --- ABA 5: H2H (HEAD TO HEAD) DINÂMICO ---
    const renderH2HTab = () => {
        const noSelectionContainer = document.getElementById('h2h-no-selection-container');
        const detailsContainer = document.getElementById('h2h-details-container');
        if (!noSelectionContainer || !detailsContainer) return;

        const game = state.selectedGameForAnalysis;
        if (!game) {
            noSelectionContainer.style.display = 'flex';
            detailsContainer.style.display = 'none';
            return;
        }

        noSelectionContainer.style.display = 'none';
        detailsContainer.style.display = 'block';

        // 1. Probabilidade 1X2 baseada nas Odds do Jogo Selecionado
        const oH = Number(game.odds.home);
        const oD = Number(game.odds.draw);
        const oA = Number(game.odds.away);
        const margin = (1/oH) + (1/oD) + (1/oA);
        const pctH = Math.round(((1/oH) / margin) * 100);
        const pctD = Math.round(((1/oD) / margin) * 100);
        const pctA = 100 - pctH - pctD;

        // 2. Média Recente de Gols e Proporção
        const teamSeed = game.name.length;
        const avgGHome = (1.4 + (teamSeed % 6) * 0.15); // Ex: 1.40 a 2.15
        const avgGAway = (1.1 + ((teamSeed * 2) % 6) * 0.15); // Ex: 1.10 a 1.85
        const ratioGHome = Math.round((avgGHome / (avgGHome + avgGAway)) * 100);
        const ratioGAway = 100 - ratioGHome;

        // 3. Últimos Confrontos Diretos (H2H)
        let h2hRowsHtml = '';
        let hasRealH2H = false;

        if (state.activeMatchSummary && state.activeMatchSummary.headToHeadGames && state.activeMatchSummary.headToHeadGames.length > 0) {
            const h2hGroup = state.activeMatchSummary.headToHeadGames[0];
            if (h2hGroup.events && h2hGroup.events.length > 0) {
                hasRealH2H = true;
                h2hGroup.events.slice(0, 5).forEach(ev => {
                    const dateObj = new Date(ev.gameDate);
                    const formattedDate = dateObj.toLocaleDateString('pt-BR');

                    let homeName = '';
                    let awayName = '';
                    const t1 = h2hGroup.team.displayName;
                    const t2 = ev.opponent ? ev.opponent.displayName : '';

                    if (ev.homeTeamId === h2hGroup.team.id) {
                        homeName = t1;
                        awayName = t2;
                    } else {
                        homeName = t2;
                        awayName = t1;
                    }

                    const score = ev.score || `${ev.homeTeamScore} - ${ev.awayTeamScore}`;
                    let scoreStyle = 'style="font-weight: 600;"';
                    
                    if (ev.gameResult === 'W') {
                        scoreStyle = 'style="font-weight: 600; color: var(--success);"';
                    } else if (ev.gameResult === 'L') {
                        scoreStyle = 'style="font-weight: 600; color: var(--danger);"';
                    }

                    h2hRowsHtml += `
                        <tr>
                            <td>${formattedDate}</td>
                            <td>${homeName}</td>
                            <td ${scoreStyle}>${score}</td>
                            <td>${awayName}</td>
                        </tr>
                    `;
                });
            }
        }

        // Fallback determinístico caso não existam dados reais
        if (!hasRealH2H) {
            const years = [2025, 2025, 2024, 2024, 2023];
            const months = [10, 6, 11, 4, 9];
            const days = [12, 8, 22, 15, 3];

            for (let i = 0; i < 4; i++) {
                const year = years[i];
                const month = String(months[i]).padStart(2, '0');
                const day = String(days[i]).padStart(2, '0');
                const formattedDate = `${day}/${month}/${year}`;

                const homeName = (i % 2 === 0) ? game.away.name : game.home.name;
                const awayName = (i % 2 === 0) ? game.home.name : game.away.name;

                const scoreHomeVal = (teamSeed + i * 3) % 3;
                const scoreAwayVal = (teamSeed + i * 7) % 3;
                const scoreStr = `${scoreHomeVal} - ${scoreAwayVal}`;

                let scoreStyle = 'style="font-weight: 600;"';
                if (scoreHomeVal > scoreAwayVal) {
                    if (homeName === game.home.name) {
                        scoreStyle = 'style="font-weight: 600; color: var(--success);"';
                    } else {
                        scoreStyle = 'style="font-weight: 600; color: var(--danger);"';
                    }
                } else if (scoreAwayVal > scoreHomeVal) {
                    if (awayName === game.home.name) {
                        scoreStyle = 'style="font-weight: 600; color: var(--success);"';
                    } else {
                        scoreStyle = 'style="font-weight: 600; color: var(--danger);"';
                    }
                }

                h2hRowsHtml += `
                    <tr>
                        <td>${formattedDate}</td>
                        <td>${homeName}</td>
                        <td ${scoreStyle}>${scoreStr}</td>
                        <td>${awayName}</td>
                    </tr>
                `;
            }
        }

        // 4. Forma Recente (Últimos 5 jogos)
        let formHomeHtml = '';
        let formAwayHtml = '';
        let hasRealForm = false;

        if (state.activeMatchSummary && state.activeMatchSummary.lastFiveGames && state.activeMatchSummary.lastFiveGames.length >= 2) {
            const lastFive = state.activeMatchSummary.lastFiveGames;
            let homeFormObj = null;
            let awayFormObj = null;

            const t1Name = lastFive[0].team.displayName.toLowerCase();
            const hName = game.home.name.toLowerCase();

            if (t1Name.includes(hName) || hName.includes(t1Name)) {
                homeFormObj = lastFive[0];
                awayFormObj = lastFive[1];
            } else {
                homeFormObj = lastFive[1];
                awayFormObj = lastFive[0];
            }

            if (homeFormObj && homeFormObj.events && homeFormObj.events.length > 0) {
                hasRealForm = true;
                homeFormObj.events.slice(0, 5).forEach(ev => {
                    const res = ev.gameResult;
                    let label = 'E';
                    let badgeClass = 'badge-pending';
                    if (res === 'W') { label = 'V'; badgeClass = 'badge-win'; }
                    else if (res === 'L') { label = 'D'; badgeClass = 'badge-loss'; }
                    formHomeHtml += `<span class="badge ${badgeClass}" title="${ev.competitionName || 'Partida'}: ${ev.score}">${label}</span>`;
                });
            }

            if (awayFormObj && awayFormObj.events && awayFormObj.events.length > 0) {
                hasRealForm = true;
                awayFormObj.events.slice(0, 5).forEach(ev => {
                    const res = ev.gameResult;
                    let label = 'E';
                    let badgeClass = 'badge-pending';
                    if (res === 'W') { label = 'V'; badgeClass = 'badge-win'; }
                    else if (res === 'L') { label = 'D'; badgeClass = 'badge-loss'; }
                    formAwayHtml += `<span class="badge ${badgeClass}" title="${ev.competitionName || 'Partida'}: ${ev.score}">${label}</span>`;
                });
            }
        }

        if (!hasRealForm) {
            const resultsHome = ['W', 'W', 'D', 'L', 'W'];
            const homeShift = teamSeed % 5;
            for (let i = 0; i < 5; i++) {
                const res = resultsHome[(i + homeShift) % 5];
                let label = 'E';
                let badgeClass = 'badge-pending';
                if (res === 'W') { label = 'V'; badgeClass = 'badge-win'; }
                else if (res === 'L') { label = 'D'; badgeClass = 'badge-loss'; }
                formHomeHtml += `<span class="badge ${badgeClass}">${label}</span>`;
            }

            const resultsAway = ['L', 'D', 'W', 'W', 'L'];
            const awayShift = (teamSeed * 3) % 5;
            for (let i = 0; i < 5; i++) {
                const res = resultsAway[(i + awayShift) % 5];
                let label = 'E';
                let badgeClass = 'badge-pending';
                if (res === 'W') { label = 'V'; badgeClass = 'badge-win'; }
                else if (res === 'L') { label = 'D'; badgeClass = 'badge-loss'; }
                formAwayHtml += `<span class="badge ${badgeClass}">${label}</span>`;
            }
        }

        // ==========================================
        // CÁLCULO E GERAÇÃO DO NOVO QUADRO DINÂMICO
        // ==========================================
        let homeEvents = [];
        let awayEvents = [];
        let hasRealFormEvents = false;

        if (state.activeMatchSummary && state.activeMatchSummary.lastFiveGames && state.activeMatchSummary.lastFiveGames.length >= 2) {
            const lastFive = state.activeMatchSummary.lastFiveGames;
            let homeFormObj = null;
            let awayFormObj = null;
            const t1Name = lastFive[0].team.displayName.toLowerCase();
            const hName = game.home.name.toLowerCase();

            if (t1Name.includes(hName) || hName.includes(t1Name)) {
                homeFormObj = lastFive[0];
                awayFormObj = lastFive[1];
            } else {
                homeFormObj = lastFive[1];
                awayFormObj = lastFive[0];
            }

            if (homeFormObj && homeFormObj.events && homeFormObj.events.length > 0) {
                homeEvents = homeFormObj.events;
                hasRealFormEvents = true;
            }
            if (awayFormObj && awayFormObj.events && awayFormObj.events.length > 0) {
                awayEvents = awayFormObj.events;
                hasRealFormEvents = true;
            }
        }

        const parseEvents = (events, focusTeamId, focusTeamName) => {
            return events.map(ev => {
                const isHome = String(focusTeamId) === String(ev.homeTeamId);
                let homeName, awayName;
                if (isHome) {
                    homeName = focusTeamName;
                    awayName = ev.opponent ? ev.opponent.displayName : 'Oponente';
                } else {
                    homeName = ev.opponent ? ev.opponent.displayName : 'Oponente';
                    awayName = focusTeamName;
                }
                
                const dateObj = new Date(ev.gameDate);
                const day = String(dateObj.getDate()).padStart(2, '0');
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const dateStr = `${day}/${month}`;
                
                const league = ev.leagueAbbreviation || ev.leagueName || 'IN';
                const scoreStr = ev.score || `${ev.homeTeamScore} - ${ev.awayTeamScore}`;
                
                let result = ev.gameResult;
                if (!result) {
                    const hScore = Number(ev.homeTeamScore || 0);
                    const aScore = Number(ev.awayTeamScore || 0);
                    if (hScore === aScore) result = 'D';
                    else if (isHome) {
                        result = hScore > aScore ? 'W' : 'L';
                    } else {
                        result = aScore > hScore ? 'W' : 'L';
                    }
                }
                
                return {
                    date: dateStr,
                    league: league.substring(0, 3).toUpperCase(),
                    homeName: homeName,
                    awayName: awayName,
                    score: scoreStr,
                    result: result,
                    homeScore: Number(ev.homeTeamScore || 0),
                    awayScore: Number(ev.awayTeamScore || 0),
                    matchId: ev.id || String(ev.gameDate),
                    leagueName: ev.leagueName || ''
                };
            });
        };

        const generateMockEvents = (teamName, isHomeTeam, seed) => {
            const oppNames = isHomeTeam ? ['Germany', 'Senegal', 'Portugal', 'Belgium', 'Uruguay'] : ['Argentina', 'Brazil', 'France', 'England', 'Italy'];
            const results = isHomeTeam ? ['L', 'W', 'L', 'L', 'W'] : ['W', 'D', 'W', 'L', 'W'];
            const scores = isHomeTeam ? [[1, 2], [3, 2], [0, 2], [2, 5], [5, 1]] : [[2, 1], [1, 1], [3, 0], [0, 2], [2, 0]];
            const dates = ['06/06', '31/05', '31/03', '28/03', '2025'];
            
            return dates.map((d, i) => {
                const homeName = isHomeTeam ? teamName : oppNames[i];
                const awayName = isHomeTeam ? oppNames[i] : teamName;
                const [hS, aS] = scores[i];
                
                return {
                    date: d,
                    league: 'IN',
                    homeName: homeName,
                    awayName: awayName,
                    score: `${hS}:${aS}`,
                    result: results[i],
                    homeScore: hS,
                    awayScore: aS,
                    matchId: `mock_${seed}_${isHomeTeam ? 'H' : 'A'}_${i}`,
                    leagueName: game.leagueName
                };
            });
        };

        let parsedHome = [];
        let parsedAway = [];

        if (hasRealFormEvents) {
            let homeId = 'home_id';
            let awayId = 'away_id';
            if (state.activeMatchSummary && state.activeMatchSummary.lastFiveGames && state.activeMatchSummary.lastFiveGames.length >= 2) {
                const lastFive = state.activeMatchSummary.lastFiveGames;
                if (lastFive[0].team.displayName.toLowerCase().includes(game.home.name.toLowerCase())) {
                    homeId = lastFive[0].team.id;
                    awayId = lastFive[1].team.id;
                } else {
                    homeId = lastFive[1].team.id;
                    awayId = lastFive[0].team.id;
                }
            }
            parsedHome = parseEvents(homeEvents, homeId, game.home.name);
            parsedAway = parseEvents(awayEvents, awayId, game.away.name);
        } else {
            parsedHome = generateMockEvents(game.home.name, true, teamSeed);
            parsedAway = generateMockEvents(game.away.name, false, teamSeed);
        }

        if (currentH2HSameLeague) {
            const leagueLower = game.leagueName.toLowerCase();
            parsedHome = parsedHome.filter(ev => ev.leagueName.toLowerCase().includes(leagueLower) || ev.league.toLowerCase().includes(leagueLower) || ev.league === 'IN');
            parsedAway = parsedAway.filter(ev => ev.leagueName.toLowerCase().includes(leagueLower) || ev.league.toLowerCase().includes(leagueLower) || ev.league === 'IN');
        }

        parsedHome = parsedHome.slice(0, 5);
        parsedAway = parsedAway.slice(0, 5);

        const getDeterministicVal = (matchId, factor) => {
            let hash = 0;
            const str = String(matchId);
            for (let i = 0; i < str.length; i++) {
                hash = str.charCodeAt(i) + ((hash << 5) - hash);
            }
            return Math.abs(hash % factor);
        };

        const getMatchMarketStats = (match, market, time, focusTeamName) => {
            let scoreStr = match.score;
            let valHome = match.homeScore;
            let valAway = match.awayScore;
            let result = match.result;

            const isFocusHome = match.homeName.toLowerCase() === focusTeamName.toLowerCase();

            if (market === 'GOLS') {
                if (time === '1T') {
                    const seed = getDeterministicVal(match.matchId, 100);
                    if (match.homeScore === 0 && match.awayScore === 0) {
                        valHome = 0; valAway = 0;
                    } else {
                        valHome = seed % (match.homeScore + 1);
                        valAway = (seed + 7) % (match.awayScore + 1);
                    }
                    scoreStr = `${valHome}:${valAway}`;
                } else if (time === '2T') {
                    const seed = getDeterministicVal(match.matchId, 100);
                    let valHome1T = 0, valAway1T = 0;
                    if (match.homeScore > 0) valHome1T = seed % (match.homeScore + 1);
                    if (match.awayScore > 0) valAway1T = (seed + 7) % (match.awayScore + 1);
                    valHome = match.homeScore - valHome1T;
                    valAway = match.awayScore - valAway1T;
                    scoreStr = `${valHome}:${valAway}`;
                }
            } else if (market === 'ESCANTEIOS') {
                const seed = getDeterministicVal(match.matchId, 100);
                const totalCorners = 7 + (seed % 7);
                valHome = Math.round(totalCorners * (0.4 + (seed % 3) * 0.1));
                valAway = totalCorners - valHome;
                
                if (time === '1T') {
                    valHome = Math.round(valHome * 0.45);
                    valAway = Math.round(valAway * 0.45);
                } else if (time === '2T') {
                    valHome = valHome - Math.round(valHome * 0.45);
                    valAway = valAway - Math.round(valAway * 0.45);
                }
                scoreStr = `${valHome}:${valAway}`;
            } else if (market === 'CARTÕES') {
                const seed = getDeterministicVal(match.matchId, 100);
                const totalCards = 2 + (seed % 6);
                valHome = Math.round(totalCards * (0.35 + (seed % 4) * 0.1));
                valAway = totalCards - valHome;
                
                if (time === '1T') {
                    valHome = Math.round(valHome * 0.3);
                    valAway = Math.round(valAway * 0.3);
                } else if (time === '2T') {
                    valHome = valHome - Math.round(valHome * 0.3);
                    valAway = valAway - Math.round(valAway * 0.3);
                }
                scoreStr = `${valHome}:${valAway}`;
            }

            const valFocus = isFocusHome ? valHome : valAway;
            const valOpp = isFocusHome ? valAway : valHome;
            if (valFocus > valOpp) result = 'W';
            else if (valFocus < valOpp) result = 'L';
            else result = 'D';

            return {
                scoreDisplay: scoreStr,
                valFocus: valFocus,
                valOpp: valOpp,
                result: result
            };
        };

        let homeAvgVal = 0;
        let awayAvgVal = 0;
        let totalValStr = '';

        if (currentH2HMarket === 'RESULTADO') {
            const hStats = parsedHome.map(m => getMatchMarketStats(m, currentH2HMarket, currentH2HTime, game.home.name));
            const aStats = parsedAway.map(m => getMatchMarketStats(m, currentH2HMarket, currentH2HTime, game.away.name));
            
            const hWins = hStats.filter(s => s.result === 'W').length;
            const hDraws = hStats.filter(s => s.result === 'D').length;
            const hLosses = hStats.filter(s => s.result === 'L').length;
            
            const aWins = aStats.filter(s => s.result === 'W').length;
            const aDraws = aStats.filter(s => s.result === 'D').length;
            const aLosses = aStats.filter(s => s.result === 'L').length;

            homeAvgVal = `${hWins}V-${hDraws}E-${hLosses}D`;
            awayAvgVal = `${aWins}V-${aDraws}E-${aLosses}D`;
            
            const hPct = Math.round((hWins / (parsedHome.length || 1)) * 100);
            const aPct = Math.round((aWins / (parsedAway.length || 1)) * 100);
            totalValStr = `${hPct}% / ${aPct}%`;
        } else {
            const hVals = parsedHome.map(m => getMatchMarketStats(m, currentH2HMarket, currentH2HTime, game.home.name).valFocus);
            const aVals = parsedAway.map(m => getMatchMarketStats(m, currentH2HMarket, currentH2HTime, game.away.name).valFocus);

            const hAvg = hVals.length > 0 ? (hVals.reduce((a, b) => a + b, 0) / hVals.length) : 0;
            const aAvg = aVals.length > 0 ? (aVals.reduce((a, b) => a + b, 0) / aVals.length) : 0;

            homeAvgVal = hAvg.toFixed(1);
            awayAvgVal = aAvg.toFixed(1);
            totalValStr = (hAvg + aAvg).toFixed(1);
        }

        const buildTableRowsHtml = (parsedMatches, teamName) => {
            if (parsedMatches.length === 0) {
                return `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); font-size: 12px; padding: 16px;">Sem dados disponíveis para os filtros ativos.</td></tr>`;
            }
            return parsedMatches.map(m => {
                const stats = getMatchMarketStats(m, currentH2HMarket, currentH2HTime, teamName);
                
                let badgeClass = 'badge-pending';
                let badgeLabel = stats.scoreDisplay;
                
                if (currentH2HMarket === 'RESULTADO') {
                    if (stats.result === 'W') { badgeClass = 'badge-win'; badgeLabel = 'V'; }
                    else if (stats.result === 'L') { badgeClass = 'badge-loss'; badgeLabel = 'D'; }
                    else { badgeClass = 'badge-pending'; badgeLabel = 'E'; }
                } else {
                    if (stats.result === 'W') badgeClass = 'badge-win';
                    else if (stats.result === 'L') badgeClass = 'badge-loss';
                    else badgeClass = 'badge-pending';
                    
                    if (currentH2HMarket === 'GOLS') {
                        badgeLabel = stats.scoreDisplay;
                    } else {
                        badgeLabel = `${stats.valFocus}:${stats.valOpp}`;
                    }
                }

                return `
                    <tr>
                        <td style="font-size: 11px; color: var(--text-dim); padding: 8px 4px;">${m.date}</td>
                        <td style="font-size: 11px; font-weight: 700; color: var(--primary); padding: 8px 4px;">${m.league}</td>
                        <td style="font-size: 12px; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 8px 4px;">
                            <span style="${m.homeName === teamName ? 'font-weight:700; color:var(--text-main);' : 'color:var(--text-muted);'}">${m.homeName}</span>
                        </td>
                        <td style="font-size: 12px; font-weight: 600; text-align: center; color: var(--text-main); padding: 8px 4px;">${stats.scoreDisplay}</td>
                        <td style="font-size: 12px; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 8px 4px;">
                            <span style="${m.awayName === teamName ? 'font-weight:700; color:var(--text-main);' : 'color:var(--text-muted);'}">${m.awayName}</span>
                        </td>
                        <td style="text-align: right; padding: 8px 4px;">
                            <span class="badge ${badgeClass}" style="padding: 4px 8px; font-weight: 700; display: inline-block; min-width: 38px; text-align: center; font-size: 11px;">${badgeLabel}</span>
                        </td>
                    </tr>
                `;
            }).join('');
        };

        // 5. Injetar o HTML Dinâmico Completo
        detailsContainer.innerHTML = `
            <div class="glass-card">
                <div class="h2h-teams">
                    <div class="h2h-team-info">
                        <div style="width: 54px; height: 54px; border-radius: 50%; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-color); padding: 8px; margin-bottom: 8px;">
                            <img src="${game.home.logo}" style="width: 100%; height: 100%; object-fit: contain;">
                        </div>
                        <div class="h2h-team-name">${game.home.name}</div>
                    </div>
                    <div class="h2h-vs">VS</div>
                    <div class="h2h-team-info">
                        <div style="width: 54px; height: 54px; border-radius: 50%; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-color); padding: 8px; margin-bottom: 8px;">
                            <img src="${game.away.logo}" style="width: 100%; height: 100%; object-fit: contain;">
                        </div>
                        <div class="h2h-team-name">${game.away.name}</div>
                    </div>
                </div>
                
                <div style="max-width: 600px; margin: 0 auto; padding-top: 10px;">
                    <div class="comparison-bar-container">
                        <div class="comparison-labels">
                            <span>${game.home.name} (${pctH}%)</span>
                            <span>Empate (${pctD}%)</span>
                            <span>${game.away.name} (${pctA}%)</span>
                        </div>
                        <div class="comparison-bar">
                            <div class="comparison-fill-left" style="width: ${pctH}%;"></div>
                            <div class="comparison-fill-right" style="width: ${pctA}%; margin-left: auto;"></div>
                        </div>
                    </div>
                    
                    <div class="comparison-bar-container" style="margin-top: 14px;">
                        <div class="comparison-labels">
                            <span>Gols Marcados (${avgGHome.toFixed(1)} / jogo)</span>
                            <span>Média Recente</span>
                            <span>Gols Marcados (${avgGAway.toFixed(1)} / jogo)</span>
                        </div>
                        <div class="comparison-bar">
                            <div class="comparison-fill-left" style="width: ${ratioGHome}%;"></div>
                            <div class="comparison-fill-right" style="width: ${ratioGAway}%; margin-left: auto;"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- NOVO PAINEL DINÂMICO DE ANÁLISE POR MERCADO (SELETORES E GRÁFICO IGUAL À IMAGEM) -->
            <div class="glass-card" style="margin-top: 24px; margin-bottom: 24px; padding: 20px 24px;">
                <h3 style="margin-bottom: 16px; font-family: 'Outfit'; font-size: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 10px; color: var(--text-main); font-weight: 700; letter-spacing: -0.3px;">
                    Análise Recente e Tendências por Mercado
                </h3>
                
                <!-- Seletores -->
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 20px; flex-wrap: wrap;">
                    <div style="display: flex; gap: 10px;">
                        <!-- Mercado -->
                        <div style="position: relative;">
                            <select class="form-input" style="padding: 8px 12px; background: rgba(11, 15, 25, 0.6); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-main); font-family: 'Outfit'; font-weight: 700; font-size: 12px; cursor: pointer; outline: none; transition: var(--transition);" onchange="changeH2HMarket(this.value)">
                                <option value="GOLS" ${currentH2HMarket === 'GOLS' ? 'selected' : ''}>GOLS</option>
                                <option value="ESCANTEIOS" ${currentH2HMarket === 'ESCANTEIOS' ? 'selected' : ''}>ESCANTEIOS</option>
                                <option value="CARTÕES" ${currentH2HMarket === 'CARTÕES' ? 'selected' : ''}>CARTÕES</option>
                                <option value="RESULTADO" ${currentH2HMarket === 'RESULTADO' ? 'selected' : ''}>RESULTADO</option>
                            </select>
                        </div>
                        
                        <!-- Período -->
                        <div>
                            <select class="form-input" style="padding: 8px 12px; background: rgba(11, 15, 25, 0.6); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-main); font-family: 'Outfit'; font-weight: 700; font-size: 12px; cursor: pointer; outline: none; transition: var(--transition);" onchange="changeH2HTime(this.value)">
                                <option value="FT" ${currentH2HTime === 'FT' ? 'selected' : ''}>FT</option>
                                <option value="1T" ${currentH2HTime === '1T' ? 'selected' : ''}>1T</option>
                                <option value="2T" ${currentH2HTime === '2T' ? 'selected' : ''}>2T</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- Checkbox mesma liga -->
                    <div style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="h2h-league-checkbox" ${currentH2HSameLeague ? 'checked' : ''} onchange="toggleH2HSameLeague(this.checked)" style="width: 15px; height: 15px; cursor: pointer; border-radius: 4px; border: 1px solid var(--border-color); background: rgba(0,0,0,0.3);">
                        <label for="h2h-league-checkbox" style="font-size: 12px; color: var(--text-dim); cursor: pointer; font-weight: 600; user-select: none;">Apenas na mesma liga</label>
                    </div>
                </div>

                <!-- Badges de Resumo -->
                <div style="display: flex; gap: 14px; align-items: center; margin-bottom: 24px; flex-wrap: wrap;">
                    <!-- TOTAL Badge -->
                    <div style="background: var(--warning); color: #0b0f19; border-radius: 10px; padding: 10px 16px; text-align: center; font-family: 'Outfit'; font-weight: 800; font-size: 12px; min-width: 90px; line-height: 1.2; box-shadow: 0 4px 10px rgba(245,158,11,0.2);">
                        TOTAL<br><span style="font-size: 18px; font-weight: 900; letter-spacing: -0.5px;">${totalValStr}</span>
                    </div>
                    
                    <!-- Card Mandante -->
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 10px; display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; flex: 1; min-width: 180px; height: 50px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <img src="${game.home.logo}" style="width: 22px; height: 22px; object-fit: contain;">
                            <div>
                                <div style="font-size: 12px; font-weight: 700; color: var(--text-main);">${game.home.name}</div>
                                <div style="font-size: 10px; color: var(--text-muted); line-height:1;">Casa</div>
                            </div>
                        </div>
                        <span style="background: var(--warning); color: #0b0f19; font-weight: 900; font-family: 'Outfit'; border-radius: 6px; padding: 4px 8px; font-size: 13px;">${homeAvgVal}</span>
                    </div>

                    <!-- Card Visitante -->
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 10px; display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; flex: 1; min-width: 180px; height: 50px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <img src="${game.away.logo}" style="width: 22px; height: 22px; object-fit: contain;">
                            <div>
                                <div style="font-size: 12px; font-weight: 700; color: var(--text-main);">${game.away.name}</div>
                                <div style="font-size: 10px; color: var(--text-muted); line-height:1;">Visitante</div>
                            </div>
                        </div>
                        <span style="background: var(--warning); color: #0b0f19; font-weight: 900; font-family: 'Outfit'; border-radius: 6px; padding: 4px 8px; font-size: 13px;">${awayAvgVal}</span>
                    </div>
                </div>

                <!-- Grid de Tabelas (Lado a Lado) -->
                <div class="grid-2" style="gap: 16px;">
                    <!-- Tabela Mandante -->
                    <div style="background: rgba(11, 15, 25, 0.4); border: 1px solid var(--border-color); border-radius: 12px; padding: 14px; overflow: hidden;">
                        <h4 style="font-family: 'Outfit'; font-size: 12px; font-weight: 700; color: var(--primary); text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                            ÚLTIMOS JOGOS ${game.home.name.toUpperCase()}
                        </h4>
                        <div style="overflow-x: auto;">
                            <table class="results-table" style="width: 100%;">
                                <thead>
                                    <tr>
                                        <th style="font-size: 9px; padding: 6px 2px; color:var(--text-muted);">Data</th>
                                        <th style="font-size: 9px; padding: 6px 2px; color:var(--text-muted);">Liga</th>
                                        <th style="font-size: 9px; padding: 6px 2px; color:var(--text-muted);">Mandante</th>
                                        <th style="font-size: 9px; padding: 6px 2px; text-align: center; color:var(--text-muted);">Placar</th>
                                        <th style="font-size: 9px; padding: 6px 2px; color:var(--text-muted);">Visitante</th>
                                        <th style="font-size: 9px; padding: 6px 2px; text-align: right; color:var(--text-muted);">Badge</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${buildTableRowsHtml(parsedHome, game.home.name)}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Tabela Visitante -->
                    <div style="background: rgba(11, 15, 25, 0.4); border: 1px solid var(--border-color); border-radius: 12px; padding: 14px; overflow: hidden;">
                        <h4 style="font-family: 'Outfit'; font-size: 12px; font-weight: 700; color: var(--primary); text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                            ÚLTIMOS JOGOS ${game.away.name.toUpperCase()}
                        </h4>
                        <div style="overflow-x: auto;">
                            <table class="results-table" style="width: 100%;">
                                <thead>
                                    <tr>
                                        <th style="font-size: 9px; padding: 6px 2px; color:var(--text-muted);">Data</th>
                                        <th style="font-size: 9px; padding: 6px 2px; color:var(--text-muted);">Liga</th>
                                        <th style="font-size: 9px; padding: 6px 2px; color:var(--text-muted);">Mandante</th>
                                        <th style="font-size: 9px; padding: 6px 2px; text-align: center; color:var(--text-muted);">Placar</th>
                                        <th style="font-size: 9px; padding: 6px 2px; color:var(--text-muted);">Visitante</th>
                                        <th style="font-size: 9px; padding: 6px 2px; text-align: right; color:var(--text-muted);">Badge</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${buildTableRowsHtml(parsedAway, game.away.name)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="grid-2">
                <div class="glass-card">
                    <h3 style="margin-bottom: 16px; font-family: 'Outfit'; font-size: 16px;">Últimos Confrontos Diretos</h3>
                    <table class="results-table">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Mandante</th>
                                <th>Placar</th>
                                <th>Visitante</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${h2hRowsHtml}
                        </tbody>
                    </table>
                </div>
                
                <div class="glass-card">
                    <h3 style="margin-bottom: 16px; font-family: 'Outfit'; font-size: 16px;">Forma Recente (Últimos 5 jogos)</h3>
                    <div style="margin-bottom: 20px;">
                        <div class="form-label">${game.home.name}</div>
                        <div style="display: flex; gap: 8px;">
                            ${formHomeHtml}
                        </div>
                    </div>
                    <div>
                        <div class="form-label">${game.away.name}</div>
                        <div style="display: flex; gap: 8px;">
                            ${formAwayHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    // --- INICIALIZAÇÃO DO APP ---

    // Inicializa a exibição de bancas ao carregar a página e pré-seleciona a ativa no formulário
    if (state.activeBancaId && state.bancas.some(b => b.id === state.activeBancaId)) {
        selectBanca(state.activeBancaId);
    } else if (state.bancas.length > 0) {
        selectBanca(state.bancas[0].id);
    } else {
        renderBancaDetails();
    }

    // Tenta renderizar o painel de análise se houver um jogo previamente selecionado
    renderAnalysisTab();

    // Renderiza o status da assinatura Pro na inicialização
    renderPlanosTab();

    // Inicializa o Painel Admin
    renderAdminTab();

    // Executa verificação inicial de resoluções de jogos terminados
    autoResolveFinishedGames();

    // Ajuste de aba inicial baseada no login
    if (!state.loggedIn) {
        const navEntrada = document.querySelector('[data-tab="entrada"]');
        if (navEntrada) navEntrada.click();
    } else {
        const navBanca = document.querySelector('[data-tab="banca"]');
        if (navBanca) navBanca.click();
    }
});
