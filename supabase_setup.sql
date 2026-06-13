-- Habilita extensão para UUIDs se necessário
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE PERFIS DE USUÁRIOS (Sincronizada com Supabase Auth)
CREATE TABLE public.perfis (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    plano TEXT DEFAULT 'free' CHECK (plano IN ('free', 'mensal', 'anual')),
    assinatura_ativa BOOLEAN DEFAULT FALSE,
    assinatura_validade TIMESTAMPTZ,
    role TEXT DEFAULT 'cliente' CHECK (role IN ('cliente', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilita RLS para Perfis
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver seu próprio perfil"
    ON public.perfis FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Usuários podem editar seu próprio perfil"
    ON public.perfis FOR UPDATE
    USING (auth.uid() = id);

-- 2. TABELA DE BANCAS
CREATE TABLE public.bancas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    nome TEXT NOT NULL,
    plataforma TEXT DEFAULT 'Bet365',
    inicial NUMERIC(12, 2) NOT NULL,
    atual NUMERIC(12, 2) NOT NULL,
    alavancagem_meta NUMERIC(5, 2) DEFAULT 100.00,
    prazo_dias INTEGER DEFAULT 30,
    risco TEXT DEFAULT 'moderado' CHECK (risco IN ('cauteloso', 'moderado', 'agressivo')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilita RLS para Bancas
ALTER TABLE public.bancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários gerenciam suas próprias bancas"
    ON public.bancas FOR ALL
    USING (auth.uid() = user_id);

-- 3. TABELA DE SIMULAÇÕES
CREATE TABLE public.simulacoes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    banca_id UUID REFERENCES public.bancas ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    partida TEXT NOT NULL,
    mercado TEXT NOT NULL,
    odds NUMERIC(5, 2) NOT NULL,
    valor NUMERIC(12, 2) NOT NULL,
    status TEXT DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'WIN', 'LOSS')),
    retorno NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilita RLS para Simulações
ALTER TABLE public.simulacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários gerenciam suas próprias simulações"
    ON public.simulacoes FOR ALL
    USING (auth.uid() = user_id);

-- 4. POLÍTICAS ESPECIAIS PARA ADMINISTRADORES
-- Permite que usuários com role='admin' visualizem todos os perfis
CREATE POLICY "Admins podem ver todos os perfis"
    ON public.perfis FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.perfis
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Permite que admins editem planos e status de qualquer usuário
CREATE POLICY "Admins podem editar perfis de todos"
    ON public.perfis FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.perfis
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 5. TRIGGER AUTOMÁTICO DE NOVOS CADASTROS
-- Copia os dados do Auth do Supabase para a tabela perfis ao registrar conta
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.perfis (id, nome, email, plano, assinatura_ativa, role)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'name', 'Usuário Decipro'),
        new.email,
        'free',
        false,
        'cliente'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
