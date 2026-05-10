const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    service: 'gmail', // Se for outro provedor, altere aqui
    auth: {
        user: 'mundo10pet@gmail.com', // Coloque o e-mail que vai disparar as mensagens
        pass: 'hhkt sbzx aetw rfxg' // No Gmail, você precisa gerar uma "Senha de Aplicativo" nas configurações de segurança
    }
});

// Função para validar se o e-mail tem um formato real
function validarEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Função que envia o e-mail com os dados (menos a senha)
async function enviarEmailContaCriada(destinatario, nome, role, cpf) {
    const mailOptions = {
        from: 'Mundo Pet <SEU_EMAIL_AQUI@gmail.com>', // Mesmo e-mail configurado acima
        to: destinatario,
        subject: 'Sua conta no Mundo Pet foi criada!',
        html: `
            <h2>Olá, ${nome}!</h2>
            <p>Sua conta no sistema <strong>Mundo Pet</strong> foi criada com sucesso.</p>
            <h3>Suas Informações:</h3>
            <ul>
                <li><strong>Nome:</strong> ${nome}</li>
                <li><strong>E-mail:</strong> ${destinatario}</li>
                <li><strong>CPF:</strong> ${cpf || 'Não informado'}</li>
                <li><strong>Cargo/Perfil:</strong> ${role}</li>
            </ul>
            <p><em>Por questões de segurança, sua senha não é exibida neste e-mail.</em></p>
            <p>Seja bem-vindo(a) à nossa plataforma!</p>
        `
    };
    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Erro ao enviar e-mail:", error);
    }
}
const app = express();
const port = process.env.PORT || 8080;
const SECRET_KEY = "MundoPet_Security_2026_PIM";

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const db = new sqlite3.Database('./mundopet_persistente_v2.db');

db.serialize(() => {
    console.log("🛠️  Configurando banco de dados...");

    db.run(`CREATE TABLE IF NOT EXISTS clinicas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        cnpj TEXT UNIQUE,
        telefone TEXT,
        endereco TEXT,
        email_contato TEXT,
        categorias_prontuario TEXT,
        tipos_animais TEXT,
        cargos TEXT
    )`)
});

    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clinic_id INTEGER,
        nome TEXT,
        cpf TEXT,
        email TEXT UNIQUE,
        senha TEXT,
        role TEXT,
        especialidade TEXT,
        status TEXT DEFAULT 'Ativo',
        FOREIGN KEY (clinic_id) REFERENCES clinicas(id)
    )`, () => {
        db.run(`ALTER TABLE usuarios ADD COLUMN especialidade TEXT`, (err) => {});
    });

    db.run(`CREATE TABLE IF NOT EXISTS transacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clinic_id INTEGER,
        data TEXT,
        descricao TEXT,
        categoria TEXT,
        valor REAL,
        tipo TEXT,
        metodo TEXT,
        FOREIGN KEY (clinic_id) REFERENCES clinicas(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS estoque (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clinic_id INTEGER,
        nome TEXT,
        lote TEXT,
        val TEXT,
        qtd INTEGER,
        fornecedor TEXT,
        descricao TEXT,
        valor REAL,
        FOREIGN KEY (clinic_id) REFERENCES clinicas(id)
    )`);

    // NOVA TABELA: Auditoria Automática e Imutável
    db.run(`CREATE TABLE IF NOT EXISTS auditoria (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clinic_id INTEGER,
        data_hora TEXT,
        usuario TEXT,
        acao TEXT,
        FOREIGN KEY (clinic_id) REFERENCES clinicas(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS agenda (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clinic_id INTEGER,
            cliente TEXT,
            pet TEXT,
            data TEXT,
            hora TEXT,
            tipo TEXT,
            especialidade TEXT,
            veterinario TEXT,
            obs TEXT,
            status TEXT DEFAULT 'Agendado',
            FOREIGN KEY (clinic_id) REFERENCES clinicas(id)
        )`, () => {
            db.run(`ALTER TABLE agenda ADD COLUMN status TEXT DEFAULT 'Agendado'`, (err) => {});
        });
        db.run(`CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clinic_id INTEGER,
        nome TEXT NOT NULL,
        cpf TEXT,
        telefone TEXT,
        endereco TEXT,
        pets TEXT,
        FOREIGN KEY (clinic_id) REFERENCES clinicas(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS prontuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clinic_id INTEGER,
        agendamento_id INTEGER,
        cliente TEXT,
        pet TEXT,
        data TEXT,
        veterinario TEXT,
        peso TEXT,
        sintomas TEXT,
        diagnostico TEXT,
        prescricao TEXT,
        FOREIGN KEY (clinic_id) REFERENCES clinicas(id)
    )`);

// --- FUNÇÃO INTERNA DE AUDITORIA ---
function registrarAuditoria(clinic_id, usuario, acao) {
    if (!clinic_id) return;
    const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    db.run(`INSERT INTO auditoria (clinic_id, data_hora, usuario, acao) VALUES (?, ?, ?, ?)`, 
        [clinic_id, dataHora, usuario, acao]);
}

// --- ROTAS DE AUTENTICAÇÃO E CADASTRO ---

app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;
    
    db.get(`SELECT * FROM usuarios WHERE email = ? AND senha = ?`, [email, senha], (err, user) => {
        if (err) return res.status(500).json({ error: "Erro no servidor." });
        if (!user) return res.status(401).json({ error: "E-mail ou senha incorretos." });

        const token = jwt.sign({ id: user.id, role: user.role, clinic_id: user.clinic_id }, SECRET_KEY, { expiresIn: '2h' });
        
        // Registro de login opcional (comentado para evitar poluição visual, ative se desejar)
        // registrarAuditoria(user.clinic_id, user.nome, 'Realizou login no sistema.');

        res.json({ success: true, token, user: { nome: user.nome, role: user.role, clinic_id: user.clinic_id, email: user.email } });
    });
});

app.post('/api/assinatura-completa', async (req, res) => {
    const { clinica, colaboradores } = req.body;

    // Trava: Verifica se o formato do e-mail do admin é válido
    if (!validarEmail(clinica.emailAdmin)) {
        return res.status(400).json({ error: "O e-mail do administrador é inválido." });
    }

    db.run(`INSERT INTO clinicas (nome, cnpj, telefone) VALUES (?, ?, ?)`, [clinica.nome, clinica.cnpj, clinica.telefone], function(err) {
        if (err) return res.status(400).json({ error: "CNPJ já cadastrado ou erro no banco." });
        
        const clinicaId = this.lastID;
        
        db.run(`INSERT INTO usuarios (clinic_id, nome, cpf, email, senha, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
        [clinicaId, 'Admin Master', '', clinica.emailAdmin, clinica.senhaAdmin, 'Administrador', 'Ativo'], async function(err) {
            
            // Dispara e-mail para o administrador
            await enviarEmailContaCriada(clinica.emailAdmin, 'Admin Master', 'Administrador', '');

            if(colaboradores && colaboradores.length > 0) {
                const stmt = db.prepare(`INSERT INTO usuarios (clinic_id, nome, cpf, email, senha, role, status, especialidade) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
                for (const c of colaboradores) {
                    if (validarEmail(c.email)) {
                        stmt.run([clinicaId, c.nome, c.cpf, c.email, '123456', c.cargo, 'Ativo', c.especialidade || null]);
                        // Dispara e-mail para cada colaborador extra cadastrado
                        await enviarEmailContaCriada(c.email, c.nome, c.cargo, c.cpf);
                    }
                }
                stmt.finalize();
            }

            registrarAuditoria(clinicaId, 'Sistema', 'Clínica cadastrada e ambiente inicializado no sistema.');

            res.json({ success: true, message: "Sistema ativado com sucesso!" });
        });
    });
});
// --- ROTA DE AUDITORIA (Somente Leitura) ---
app.get('/api/auditoria/:clinica_id', (req, res) => {
    db.all(`SELECT data_hora, usuario, acao FROM auditoria WHERE clinic_id = ? ORDER BY id DESC`, [req.params.clinica_id], (err, rows) => {
        if (err) return res.status(500).json({ error: "Erro ao buscar logs de auditoria." });
        res.json(rows);
    });
});

// --- ROTAS DE COLABORADORES ---

app.post('/api/colaborador', (req, res) => {
    const { nome, cpf, email, senha, cargo, clinica_id, especialidade } = req.body;
    
    // Trava: Verifica se o e-mail do novo funcionário é válido
    if (!validarEmail(email)) {
        return res.status(400).json({ error: "O e-mail fornecido é inválido." });
    }

    db.get(`SELECT email FROM usuarios WHERE email = ?`, [email], (err, row) => {
        if (err) return res.status(500).json({ error: "Erro interno no servidor." });
        if (row) return res.status(400).json({ error: "E-mail já cadastrado no sistema." });
        
        db.run(`INSERT INTO usuarios (clinic_id, nome, cpf, email, senha, role, status, especialidade) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
        [clinica_id, nome, cpf, email, senha, cargo, 'Ativo', especialidade || null], async function(err) {
            
            // Dispara e-mail para o novo colaborador
            await enviarEmailContaCriada(email, nome, cargo, cpf);

            registrarAuditoria(clinica_id, req.headers['x-usuario-nome'] || 'Desconhecido', `Cadastrou o colaborador: ${nome} (${cargo})`);
            res.json({ success: true, message: "Colaborador cadastrado com sucesso!", id: this.lastID });
        });
    });
});

app.put('/api/colaborador/:id', (req, res) => {
    const { nome, cpf, email, cargo, especialidade } = req.body;
    db.run(`UPDATE usuarios SET nome = ?, cpf = ?, email = ?, role = ?, especialidade = ? WHERE id = ?`,
        [nome, cpf, email, cargo, especialidade || null, req.params.id], err => {
            if (err) return res.status(500).json({ error: "Erro ao atualizar." });
            
            registrarAuditoria(req.headers['x-clinic-id'], req.headers['x-usuario-nome'] || 'Desconhecido', `Atualizou os dados do colaborador ID: ${req.params.id}`);
            res.json({ success: true });
    });
});

app.put('/api/colaborador/:id/status', (req, res) => {
    const { status } = req.body;
    db.run(`UPDATE usuarios SET status = ? WHERE id = ?`, [status, req.params.id], err => {
        if (err) return res.status(500).json({ error: "Erro ao atualizar status." });
        
        registrarAuditoria(req.headers['x-clinic-id'], req.headers['x-usuario-nome'] || 'Desconhecido', `Alterou o status do colaborador ID: ${req.params.id} para '${status}'`);
        res.json({ success: true });
    });
});

app.get('/api/colaboradores/:clinica_id', (req, res) => {
    db.all(`SELECT id, nome, cpf, email, role as cargo, status, especialidade FROM usuarios WHERE clinic_id = ?`, [req.params.clinica_id], (err, rows) => {
        if (err) return res.status(500).json({ error: "Erro ao buscar colaboradores." });
        res.json(rows.map(r => ({ ...r, ultimoAcesso: 'Hoje' })));
    });
});

// --- ROTAS FINANCEIRAS ---

app.get('/api/transacoes/:clinica_id', (req, res) => {
    db.all(`SELECT * FROM transacoes WHERE clinic_id = ? ORDER BY id DESC`, [req.params.clinica_id], (err, rows) => {
        if (err) return res.status(500).json({ error: "Erro ao buscar transações." });
        res.json(rows.map(r => ({
            id: r.id, data: r.data, desc: r.descricao, cat: r.categoria, valor: r.valor, tipo: r.tipo, metodo: r.metodo
        })));
    });
});

app.post('/api/transacoes', (req, res) => {
    const { clinic_id, data, descricao, categoria, valor, tipo, metodo } = req.body;
    db.run(`INSERT INTO transacoes (clinic_id, data, descricao, categoria, valor, tipo, metodo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [clinic_id, data, descricao, categoria, valor, tipo, metodo], function(err) {
        if (err) return res.status(500).json({ error: "Erro ao salvar transação." });
        
        registrarAuditoria(clinic_id, req.headers['x-usuario-nome'] || 'Desconhecido', `Lançou nova transação financeira: ${descricao} no valor de R$ ${valor}`);
        res.json({ success: true, id: this.lastID });
    });
});

app.put('/api/transacoes/:id', (req, res) => {
    const { data, descricao, categoria, valor, tipo, metodo } = req.body;
    db.run(`UPDATE transacoes SET data=?, descricao=?, categoria=?, valor=?, tipo=?, metodo=? WHERE id=?`,
        [data, descricao, categoria, valor, tipo, metodo, req.params.id], err => {
            if (err) return res.status(500).json({ error: "Erro ao atualizar transação." });
            
            registrarAuditoria(req.headers['x-clinic-id'], req.headers['x-usuario-nome'] || 'Desconhecido', `Atualizou informações da transação financeira ID: ${req.params.id}`);
            res.json({ success: true });
        });
});

app.delete('/api/transacoes/:id', (req, res) => {
    db.run(`DELETE FROM transacoes WHERE id = ?`, [req.params.id], err => {
        if (err) return res.status(500).json({ error: "Erro ao deletar transação." });
        
        registrarAuditoria(req.headers['x-clinic-id'], req.headers['x-usuario-nome'] || 'Desconhecido', `Excluiu permanentemente a transação financeira ID: ${req.params.id}`);
        res.json({ success: true });
    });
});

// --- ROTAS DE ESTOQUE ---

app.get('/api/estoque/:clinica_id', (req, res) => {
    db.all(`SELECT * FROM estoque WHERE clinic_id = ?`, [req.params.clinica_id], (err, rows) => {
        if (err) return res.status(500).json({ error: "Erro ao buscar estoque." });
        res.json(rows);
    });
});

app.post('/api/estoque', (req, res) => {
    const { clinic_id, nome, lote, val, qtd, fornecedor, descricao, valor, gerarTransacao } = req.body;
    
    db.run(`INSERT INTO estoque (clinic_id, nome, lote, val, qtd, fornecedor, descricao, valor) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [clinic_id, nome, lote, val, qtd, fornecedor, descricao, valor], function(err) {
        if (err) return res.status(500).json({ error: "Erro ao salvar no estoque." });
        const estoqueId = this.lastID;

        registrarAuditoria(clinic_id, req.headers['x-usuario-nome'] || 'Desconhecido', `Cadastrou novo item no estoque: ${nome} (Lote: ${lote}, Qtd: ${qtd})`);

        if (gerarTransacao && valor > 0) {
            const dataAtual = new Date().toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
            const descTransacao = `Compra de Estoque: ${nome} (Qtd: ${qtd} | Lote: ${lote})`;
            
            db.run(`INSERT INTO transacoes (clinic_id, data, descricao, categoria, valor, tipo, metodo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [clinic_id, dataAtual, descTransacao, 'Medicamentos', valor, 'saida', 'Pix'], function(errTrans) {
                if (errTrans) console.error("Erro ao gerar transação automática:", errTrans);
                
                registrarAuditoria(clinic_id, 'Sistema (Automático)', `Gerou despesa automática referente à aquisição do estoque de ${nome}`);
                res.json({ success: true, id: estoqueId, transacaoGerada: true });
            });
        } else {
            res.json({ success: true, id: estoqueId });
        }
    });
});

app.put('/api/estoque/:id/ajustar', (req, res) => {
    const { qtd } = req.body;
    db.run(`UPDATE estoque SET qtd = ? WHERE id = ?`, [qtd, req.params.id], err => {
        if (err) return res.status(500).json({ error: "Erro ao atualizar estoque." });
        
        registrarAuditoria(req.headers['x-clinic-id'], req.headers['x-usuario-nome'] || 'Desconhecido', `Ajustou a quantidade em estoque do item ID: ${req.params.id} para a quantidade ${qtd}`);
        res.json({ success: true });
    });
});

app.delete('/api/estoque/:id', (req, res) => {
    db.run(`DELETE FROM estoque WHERE id = ?`, [req.params.id], err => {
        if (err) return res.status(500).json({ error: "Erro ao deletar item do estoque." });
        
        registrarAuditoria(req.headers['x-clinic-id'], req.headers['x-usuario-nome'] || 'Desconhecido', `Removeu permanentemente o item de estoque ID: ${req.params.id}`);
        res.json({ success: true });
    });
});

// --- ROTAS DE CONFIGURAÇÕES / CLÍNICA ---

app.put('/api/clinica/:id', (req, res) => {
    const { nome, cnpj, telefone, endereco, email_contato, categorias_prontuario, tipos_animais, cargos } = req.body;
    
    db.run(`UPDATE clinicas SET nome = ?, cnpj = ?, telefone = ?, endereco = ?, email_contato = ?, categorias_prontuario = ?, tipos_animais = ?, cargos = ? WHERE id = ?`, 
    [nome, cnpj, telefone, endereco, email_contato, categorias_prontuario, tipos_animais, cargos, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: "Erro ao atualizar configurações." });
        
        registrarAuditoria(req.params.id, req.headers['x-usuario-nome'] || 'Desconhecido', `Alterou as configurações/dados globais da clínica.`);
        res.json({ success: true, message: "Configurações atualizadas com sucesso!" });
    });
});

app.put('/api/usuario/senha', (req, res) => {
    const { email, senha } = req.body;
    db.run(`UPDATE usuarios SET senha = ? WHERE email = ?`, [senha, email], function(err) {
        if (err) return res.status(500).json({ error: "Erro ao atualizar senha." });
        
        registrarAuditoria(req.headers['x-clinic-id'], req.headers['x-usuario-nome'] || 'Desconhecido', `Atualizou a senha de segurança da própria conta.`);
        res.json({ success: true });
    });
});

app.get('/api/clinica/:id', (req, res) => {
    db.get(`SELECT * FROM clinicas WHERE id = ?`, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: "Erro ao buscar clínica." });
        res.json(row || {});
    });
});
// --- ROTAS DE AGENDA ---

app.get('/api/agenda/:clinica_id', (req, res) => {
    db.all(`SELECT * FROM agenda WHERE clinic_id = ? ORDER BY data ASC, hora ASC`, [req.params.clinica_id], (err, rows) => {
        if (err) return res.status(500).json({ error: "Erro ao buscar agenda." });
        res.json(rows);
    });
});

app.post('/api/agenda', (req, res) => {
    const { clinic_id, cliente, pet, data, hora, tipo, especialidade, veterinario, obs } = req.body;
    
    db.run(`INSERT INTO agenda (clinic_id, cliente, pet, data, hora, tipo, especialidade, veterinario, obs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
    [clinic_id, cliente, pet, data, hora, tipo, especialidade, veterinario, obs], function(err) {
        if (err) return res.status(500).json({ error: "Erro ao salvar agendamento." });
        
        registrarAuditoria(clinic_id, req.headers['x-usuario-nome'] || 'Desconhecido', `Agendou ${tipo} para o pet ${pet} (${data} às ${hora})`);
        res.json({ success: true, message: "Agendamento salvo!", id: this.lastID });
    });
});

// --- ROTAS DE CLIENTES ---

app.get('/api/clientes/:clinica_id', (req, res) => {
    db.all(`SELECT * FROM clientes WHERE clinic_id = ? ORDER BY nome ASC`, [req.params.clinica_id], (err, rows) => {
        if (err) return res.status(500).json({ error: "Erro ao buscar clientes." });
        res.json(rows);
    });
});

app.post('/api/clientes', (req, res) => {
    const { clinic_id, nome, cpf, telefone, endereco, pets } = req.body;
    db.run(`INSERT INTO clientes (clinic_id, nome, cpf, telefone, endereco, pets) VALUES (?, ?, ?, ?, ?, ?)`, 
    [clinic_id, nome, cpf, telefone, endereco, JSON.stringify(pets || [])], function(err) {
        if (err) {
            console.error("Erro no Banco:", err);
            return res.status(500).json({ error: "Erro ao salvar cliente." });
        }
        
        registrarAuditoria(clinic_id, req.headers['x-usuario-nome'] || 'Desconhecido', `Cadastrou o cliente: ${nome}`);
        res.json({ success: true, id: this.lastID });
    });
});

app.put('/api/clientes/:id', (req, res) => {
    const { campo, valor } = req.body;
    
    // Trava de segurança para atualizar apenas os campos permitidos
    const camposPermitidos = ['nome', 'cpf', 'telefone', 'endereco'];
    if (!camposPermitidos.includes(campo)) {
        return res.status(400).json({ error: "Campo inválido para edição." });
    }

    db.run(`UPDATE clientes SET ${campo} = ? WHERE id = ?`, [valor, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: "Erro ao atualizar cliente." });
        
        registrarAuditoria(req.headers['x-clinic-id'], req.headers['x-usuario-nome'] || 'Desconhecido', `Editou o campo ${campo} do cliente ID: ${req.params.id}`);
        res.json({ success: true });
    });
});

app.put('/api/agenda/status/:id', (req, res) => {
    const { status } = req.body;
    db.run(`UPDATE agenda SET status = ? WHERE id = ?`, [status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: "Erro ao atualizar status na agenda." });
        res.json({ success: true });
    });
});

// --- ROTAS DE PRONTUÁRIOS ---
app.get('/api/prontuarios/:clinica_id', (req, res) => {
    db.all(`SELECT * FROM prontuarios WHERE clinic_id = ? ORDER BY id DESC`, [req.params.clinica_id], (err, rows) => {
        if (err) return res.status(500).json({ error: "Erro ao buscar prontuários." });
        res.json(rows);
    });
});

app.post('/api/prontuarios', (req, res) => {
    const { clinic_id, agendamento_id, cliente, pet, data, veterinario, peso, sintomas, diagnostico, prescricao } = req.body;
    db.run(`INSERT INTO prontuarios (clinic_id, agendamento_id, cliente, pet, data, veterinario, peso, sintomas, diagnostico, prescricao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
    [clinic_id, agendamento_id, cliente, pet, data, veterinario, peso, sintomas, diagnostico, prescricao], function(err) {
        if (err) return res.status(500).json({ error: "Erro ao salvar prontuário." });
        registrarAuditoria(clinic_id, req.headers['x-usuario-nome'] || 'Desconhecido', `Registrou prontuário para o pet ${pet}`);
        res.json({ success: true, message: "Prontuário salvo!", id: this.lastID });
    });
});

app.listen(port, () => {
    console.log(`🚀 Servidor Mundo Pet rodando em http://localhost:${port}`)
});
