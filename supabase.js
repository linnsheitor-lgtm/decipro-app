// supabase.js - Integração do Decipro com o Banco de Dados Supabase

// Para rodar localmente, você deve importar o CDN do Supabase no index.html:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

const SUPABASE_URL = "SUA_SUPABASE_URL_AQUI";
const SUPABASE_ANON_KEY = "SUA_SUPABASE_ANON_KEY_AQUI";

let supabaseClient = null;

// Inicializa o cliente do Supabase
async function initSupabase() {
    if (typeof supabase !== 'undefined') {
        let url = SUPABASE_URL;
        let key = SUPABASE_ANON_KEY;

        // Se as chaves estiverem com o placeholder padrão, busca da rota serverless do Vercel
        if (url === "SUA_SUPABASE_URL_AQUI" || url === "") {
            try {
                const res = await fetch('/api/config');
                const config = await res.json();
                url = config.supabaseUrl;
                key = config.supabaseAnonKey;
            } catch (e) {
                console.warn("Não foi possível carregar as credenciais da API Vercel:", e);
            }
        }

        if (url && key && url !== "SUA_SUPABASE_URL_AQUI") {
            supabaseClient = supabase.createClient(url, key);
            console.log("Supabase inicializado com sucesso!");
        } else {
            console.warn("Supabase não inicializado. Configure as chaves no arquivo supabase.js ou na Vercel.");
        }
    } else {
        console.warn("Script do Supabase JS não carregado no index.html.");
    }
}

// 1. SISTEMA DE AUTENTICAÇÃO (Auth)
const dbAuth = {
    // Registrar novo usuário
    async registrar(email, senha, nome) {
        if (!supabaseClient) return null;
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password: senha,
            options: {
                data: { name: nome }
            }
        });
        if (error) throw error;
        return data;
    },

    // Fazer login
    async login(email, senha) {
        if (!supabaseClient) return null;
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password: senha
        });
        if (error) throw error;
        return data;
    },

    // Fazer logout
    async logout() {
        if (!supabaseClient) return;
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
    },

    // Obter usuário logado atualmente
    usuarioAtual() {
        if (!supabaseClient) return null;
        return supabaseClient.auth.getUser();
    }
};

// 2. SINCRONIZAÇÃO DE BANCAS
const dbBancas = {
    // Obter todas as bancas do usuário logado
    async obterTodas() {
        if (!supabaseClient) return [];
        const { data, error } = await supabaseClient
            .from('bancas')
            .select('*')
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        return data;
    },

    // Criar ou atualizar uma banca
    async salvar(banca) {
        if (!supabaseClient) return null;
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado.");

        const payload = {
            user_id: user.id,
            nome: banca.nome,
            plataforma: banca.plataforma,
            inicial: banca.inicial,
            atual: banca.atual,
            alavancagem_meta: banca.alavancagem,
            prazo_dias: banca.prazo,
            risco: banca.risco
        };

        let query;
        if (banca.id && banca.id.startsWith('banca_')) {
            // Se for temporário/anterior, cria um novo
            query = supabaseClient.from('bancas').insert([payload]);
        } else if (banca.id) {
            // Se já for ID do Supabase (UUID), atualiza
            query = supabaseClient.from('bancas').update(payload).eq('id', banca.id);
        } else {
            // Cadastro de nova banca
            query = supabaseClient.from('bancas').insert([payload]);
        }

        const { data, error } = await query.select();
        if (error) throw error;
        return data[0];
    },

    // Excluir banca
    async excluir(bancaId) {
        if (!supabaseClient) return;
        const { error } = await supabaseClient
            .from('bancas')
            .delete()
            .eq('id', bancaId);
        if (error) throw error;
    }
};

// 3. SINCRONIZAÇÃO DE SIMULAÇÕES
const dbSimulacoes = {
    // Obter todas as simulações
    async obterTodas() {
        if (!supabaseClient) return [];
        const { data, error } = await supabaseClient
            .from('simulacoes')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    // Salvar simulação
    async salvar(sim) {
        if (!supabaseClient) return null;
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado.");

        const payload = {
            user_id: user.id,
            banca_id: sim.bancaId,
            partida: sim.partida,
            mercado: sim.mercado,
            odds: sim.odds,
            valor: sim.valor,
            status: sim.status,
            retorno: sim.retorno
        };

        let query;
        if (sim.id && sim.id.startsWith('sim_')) {
            query = supabaseClient.from('simulacoes').insert([payload]);
        } else if (sim.id) {
            query = supabaseClient.from('simulacoes').update(payload).eq('id', sim.id);
        } else {
            query = supabaseClient.from('simulacoes').insert([payload]);
        }

        const { data, error } = await query.select();
        if (error) throw error;
        return data[0];
    },

    // Excluir simulação
    async excluir(simId) {
        if (!supabaseClient) return;
        const { error } = await supabaseClient
            .from('simulacoes')
            .delete()
            .eq('id', simId);
        if (error) throw error;
    }
};

// Expor módulos globalmente no app
window.DeciproDB = {
    init: initSupabase,
    auth: dbAuth,
    bancas: dbBancas,
    simulacoes: dbSimulacoes,
    getClient: () => supabaseClient
};

