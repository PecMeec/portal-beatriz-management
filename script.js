// ===== DADOS LOCAL STORAGE =====
const DB = {
    alunos: JSON.parse(localStorage.getItem('alunos')) || [],
    modulos: JSON.parse(localStorage.getItem('modulos')) || [],
    aulas: JSON.parse(localStorage.getItem('aulas')) || [],
    presencas: JSON.parse(localStorage.getItem('presencas')) || [],
    pagamentos: JSON.parse(localStorage.getItem('pagamentos')) || [],
    avaliacoes: JSON.parse(localStorage.getItem('avaliacoes')) || [],
};

let alunoEmEdicao = null;
let aulaAtualSelecionada = null;
let alunoPresencaSelecionado = null;
let pagamentoEmEdicao = null;

// ===== FUNÇÕES DE UTILIDADE =====
function saveDB() {
    localStorage.setItem('alunos', JSON.stringify(DB.alunos));
    localStorage.setItem('modulos', JSON.stringify(DB.modulos));
    localStorage.setItem('aulas', JSON.stringify(DB.aulas));
    localStorage.setItem('presencas', JSON.stringify(DB.presencas));
    localStorage.setItem('pagamentos', JSON.stringify(DB.pagamentos));
    localStorage.setItem('avaliacoes', JSON.stringify(DB.avaliacoes));
}

// Otimização: Atualizar status de pagamentos automaticamente (Regra de 5 dias)
function atualizarStatusPagamentos() {
    const hoje = new Date();
    let alterado = false;

    DB.pagamentos.forEach(pag => {
        if (pag.status === 'pendente') {
            const vencimento = new Date(pag.dataVencimento);
            const diffTime = hoje - vencimento;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > 5) {
                pag.status = 'atrasado';
                alterado = true;
            }
        }
    });

    if (alterado) saveDB();
}

// ===== FUNÇÕES DE NAVEGAÇÃO =====
function goToPage(pageName) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageName).classList.add('active');
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick')?.includes(pageName)) {
            btn.classList.add('active');
        }
    });
    
    if (pageName === 'dashboard') loadDashboard();
    else if (pageName === 'alunos') loadAlunos();
    else if (pageName === 'modulos') loadModulos();
    else if (pageName === 'presencas') loadPresencasPage();
    else if (pageName === 'financeiro') loadFinanceiro();
    else if (pageName === 'relatorios') loadRelatorios();
}

// ===== DASHBOARD =====
function loadDashboard() {
    atualizarStatusPagamentos();
    
    // Beatriz quer ver apenas alunos ativos no total do dashboard
    const alunosAtivos = DB.alunos.filter(a => a.status === 'ativo').length;
    document.getElementById('total-alunos').textContent = alunosAtivos;
    document.getElementById('total-modulos').textContent = DB.modulos.length;
    
    const pagamentosAtrasados = DB.pagamentos.filter(p => p.status === 'atrasado').length;
    document.getElementById('pagamentos-atrasados').textContent = pagamentosAtrasados;
    
    const alunosDevedores = new Set(DB.pagamentos.filter(p => p.status === 'pendente' || p.status === 'atrasado').map(p => p.alunoId)).size;
    document.getElementById('alunos-devedores').textContent = alunosDevedores;
}

// ===== ALUNOS =====
function loadAlunos() {
    renderAlunos(DB.alunos);
}

function renderAlunos(alunos) {
    const container = document.getElementById('alunos-list');
    
    if (alunos.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhum aluno encontrado com os filtros atuais.</div>';
        return;
    }

    container.innerHTML = alunos.map(aluno => {
        const temDebito = DB.pagamentos.some(p => p.alunoId === aluno.id && (p.status === 'pendente' || p.status === 'atrasado'));
        const statusDebito = temDebito ? '<span style="color: #EF4444; font-weight: bold; font-size: 12px; display: block; margin-top: 5px;">💳 COM DÉBITO</span>' : '';
        
        return `
            <div class="aluno-card">
                <div class="aluno-name">${aluno.nome}</div>
                <div class="aluno-info">
                    ${aluno.email ? `<span>📧 ${aluno.email}</span>` : ''}
                    ${aluno.telefone ? `<span>📱 ${aluno.telefone}</span>` : ''}
                </div>
                <div class="aluno-info">
                    <span>📚 ${aluno.curso || 'Sem curso'}</span>
                </div>
                <div class="aluno-info">
                    <span>💰 R$ ${aluno.valor ? aluno.valor.toFixed(2) : '0.00'}</span>
                    <span>📅 Início: ${new Date(aluno.dataInicio).toLocaleDateString('pt-BR')}</span>
                </div>
                ${statusDebito}
                <div class="aluno-status status-${aluno.status}">
                    ${aluno.status === 'ativo' ? '✓ Ativo' : aluno.status === 'pausado' ? '⏸ Pausado' : '✕ Inativo'}
                </div>
                <div style="margin-top: 15px; display: flex; flex-wrap: wrap; gap: 10px;">
                    <button class="btn-secondary" onclick="editarAluno(${aluno.id})">Editar</button>
                    <button class="btn-secondary" onclick="deletarAluno(${aluno.id})" style="color: #EF4444; border-color: #EF4444;">Deletar</button>
                </div>
            </div>
        `;
    }).join('');
}

function filterAlunos() {
    const search = document.getElementById('search-alunos').value.toLowerCase();
    const status = document.getElementById('filter-status').value;
    const curso = document.getElementById('filter-curso').value;

    const filtered = DB.alunos.filter(aluno => {
        const matchSearch = aluno.nome.toLowerCase().includes(search);
        const matchStatus = !status || aluno.status === status;
        const matchCurso = !curso || aluno.curso === curso;
        return matchSearch && matchStatus && matchCurso;
    });

    renderAlunos(filtered);
}

function openAlunoModal() {
    alunoEmEdicao = null;
    document.getElementById('modal-aluno-titulo').textContent = 'Cadastrar Novo Aluno';
    document.getElementById('form-aluno').reset();
    document.getElementById('modal-aluno').classList.add('active');
}

function closeAlunoModal() {
    document.getElementById('modal-aluno').classList.remove('active');
    document.getElementById('form-aluno').reset();
    alunoEmEdicao = null;
}

function salvarAluno(event) {
    event.preventDefault();

    const aluno = {
        id: alunoEmEdicao ? alunoEmEdicao.id : Date.now(),
        nome: document.getElementById('aluno-nome').value,
        email: document.getElementById('aluno-email').value,
        telefone: document.getElementById('aluno-telefone').value,
        curso: document.getElementById('aluno-curso').value,
        valor: parseFloat(document.getElementById('aluno-valor').value),
        diaVencimento: parseInt(document.getElementById('aluno-dia-vencimento').value),
        dataInicio: document.getElementById('aluno-data').value,
        status: document.getElementById('aluno-status').value,
    };

    if (alunoEmEdicao) {
        const index = DB.alunos.findIndex(a => a.id === alunoEmEdicao.id);
        DB.alunos[index] = aluno;
    } else {
        DB.alunos.push(aluno);
        criarPagamentoMensalidade(aluno);
    }

    saveDB();
    closeAlunoModal();
    loadAlunos();
    loadDashboard();
}

function editarAluno(id) {
    alunoEmEdicao = DB.alunos.find(a => a.id === id);
    if (!alunoEmEdicao) return;

    document.getElementById('modal-aluno-titulo').textContent = 'Editar Aluno';
    document.getElementById('aluno-nome').value = alunoEmEdicao.nome;
    document.getElementById('aluno-email').value = alunoEmEdicao.email || '';
    document.getElementById('aluno-telefone').value = alunoEmEdicao.telefone || '';
    document.getElementById('aluno-curso').value = alunoEmEdicao.curso;
    document.getElementById('aluno-valor').value = alunoEmEdicao.valor;
    document.getElementById('aluno-dia-vencimento').value = alunoEmEdicao.diaVencimento;
    document.getElementById('aluno-data').value = alunoEmEdicao.dataInicio;
    document.getElementById('aluno-status').value = alunoEmEdicao.status;

    document.getElementById('modal-aluno').classList.add('active');
}

function deletarAluno(id) {
    if (confirm('Tem certeza que deseja excluir este aluno?')) {
        DB.alunos = DB.alunos.filter(a => a.id !== id);
        // Opcional: Limpar pagamentos órfãos? Beatriz pediu opção de limpar.
        saveDB();
        loadAlunos();
        loadDashboard();
    }
}

function criarPagamentoMensalidade(aluno) {
    const hoje = new Date();
    const diaVencimento = aluno.diaVencimento;
    let dataVencimento = new Date(hoje.getFullYear(), hoje.getMonth(), diaVencimento);
    
    if (dataVencimento < hoje) {
        dataVencimento = new Date(hoje.getFullYear(), hoje.getMonth() + 1, diaVencimento);
    }

    const pagamento = {
        id: Date.now(),
        alunoId: aluno.id,
        descricao: 'Mensalidade - ' + (dataVencimento.getMonth() + 1) + '/' + dataVencimento.getFullYear(),
        valor: aluno.valor,
        dataVencimento: dataVencimento.toISOString().split('T')[0],
        dataPagamento: null,
        status: 'pendente',
        tipo: 'mensalidade',
    };

    DB.pagamentos.push(pagamento);
    saveDB();
}

// ===== MÓDULOS =====
function loadModulos() {
    const container = document.getElementById('modulos-list');
    
    if (DB.modulos.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhum módulo criado.</p>';
        return;
    }

    container.innerHTML = DB.modulos.map(modulo => `
        <button class="modulo-btn ${window.moduloSelecionado === modulo.id ? 'active' : ''}" onclick="selecionarModulo(${modulo.id})">
            ${modulo.nome} (${modulo.nivel})
        </button>
    `).join('');
}

function selecionarModulo(id) {
    window.moduloSelecionado = id;
    loadModulos();
    
    const modulo = DB.modulos.find(m => m.id === id);
    const aulasModulo = DB.aulas.filter(a => a.moduloId === id);
    
    document.getElementById('btn-nova-aula').style.display = 'block';
    const container = document.getElementById('aulas-list');
    
    if (aulasModulo.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma aula cadastrada para este módulo.</p>';
        return;
    }

    container.innerHTML = aulasModulo.map(aula => `
        <div class="aula-card">
            <h4>${aula.titulo}</h4>
            <p class="aula-info">📅 ${new Date(aula.dataAula).toLocaleDateString('pt-BR')} | ⏱ ${aula.duracao} min</p>
            <p style="font-size: 13px; margin-top: 5px;">${aula.descricao || 'Sem descrição'}</p>
        </div>
    `).join('');
}

function openModuloModal() {
    document.getElementById('modal-modulo').classList.add('active');
}

function closeModuloModal() {
    document.getElementById('modal-modulo').classList.remove('active');
    document.getElementById('form-modulo').reset();
}

function salvarModulo(event) {
    event.preventDefault();

    const modulo = {
        id: Date.now(),
        nome: document.getElementById('modulo-nome').value,
        descricao: document.getElementById('modulo-descricao').value,
        nivel: document.getElementById('modulo-nivel').value,
        dataInicio: document.getElementById('modulo-data').value,
        ativo: true,
    };

    DB.modulos.push(modulo);
    saveDB();

    closeModuloModal();
    loadModulos();
    loadDashboard();
}

function openAulaModal() {
    document.getElementById('modal-aula').classList.add('active');
}

function closeAulaModal() {
    document.getElementById('modal-aula').classList.remove('active');
    document.getElementById('form-aula').reset();
}

function salvarAula(event) {
    event.preventDefault();

    const aula = {
        id: Date.now(),
        moduloId: window.moduloSelecionado,
        titulo: document.getElementById('aula-titulo').value,
        descricao: document.getElementById('aula-descricao').value,
        dataAula: document.getElementById('aula-data').value,
        duracao: parseInt(document.getElementById('aula-duracao').value) || 60,
    };

    DB.aulas.push(aula);
    saveDB();

    closeAulaModal();
    selecionarModulo(window.moduloSelecionado);
}

// ===== PRESENÇA (MELHORADA COM FILTRO DE MÓDULO) =====
function loadPresencasPage() {
    const selectModulo = document.getElementById('select-modulo-presenca');
    selectModulo.innerHTML = '<option value="">-- Selecione um módulo --</option>' + 
        DB.modulos.map(m => `<option value="${m.id}">${m.nome} (${m.nivel})</option>`).join('');
    
    document.getElementById('select-aula').innerHTML = '<option value="">-- Selecione primeiro o módulo --</option>';
    document.getElementById('presencas-table').innerHTML = '';
}

function carregarAulasDoModulo() {
    const moduloId = parseInt(document.getElementById('select-modulo-presenca').value);
    const selectAula = document.getElementById('select-aula');
    
    if (!moduloId) {
        selectAula.innerHTML = '<option value="">-- Selecione primeiro o módulo --</option>';
        return;
    }

    const aulasModulo = DB.aulas.filter(a => a.moduloId === moduloId);
    
    if (aulasModulo.length === 0) {
        selectAula.innerHTML = '<option value="">Nenhuma aula encontrada</option>';
    } else {
        selectAula.innerHTML = '<option value="">-- Selecione uma aula --</option>' + 
            aulasModulo.map(aula => `<option value="${aula.id}">${aula.titulo} (${new Date(aula.dataAula).toLocaleDateString('pt-BR')})</option>`).join('');
    }
    document.getElementById('presencas-table').innerHTML = '';
}

function carregarPresencas() {
    const aulaId = parseInt(document.getElementById('select-aula').value);
    const moduloId = parseInt(document.getElementById('select-modulo-presenca').value);
    
    if (!aulaId || !moduloId) {
        document.getElementById('presencas-table').innerHTML = '';
        return;
    }

    aulaAtualSelecionada = aulaId;
    const aula = DB.aulas.find(a => a.id === aulaId);
    const modulo = DB.modulos.find(m => m.id === moduloId);
    const presencasAula = DB.presencas.filter(p => p.aulaId === aulaId);

    // Filtrar alunos que pertencem a este módulo/nível
    const alunosDoModulo = DB.alunos.filter(aluno => {
        // Regra: Se o módulo é "particular", só mostra alunos "Particular"
        // Se o módulo é "básico", só mostra alunos "Inglês Básico"
        // Se o módulo é "avançado", só mostra alunos "Inglês Avançado"
        if (modulo.nivel === 'particular') return aluno.curso === 'Particular';
        if (modulo.nivel === 'basico') return aluno.curso === 'Inglês Básico';
        if (modulo.nivel === 'avancado') return aluno.curso === 'Inglês Avançado';
        return true;
    });

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3>Presença: ${aula.titulo}</h3>
            <span class="card-desc">${alunosDoModulo.length} alunos vinculados</span>
        </div>
        <table class="presenca-table">
            <thead>
                <tr>
                    <th>Aluno</th>
                    <th>Status</th>
                    <th>Nota/Obs</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (alunosDoModulo.length === 0) {
        html += `<tr><td colspan="4" class="empty-state">Nenhum aluno vinculado a este nível (${modulo.nivel}).</td></tr>`;
    } else {
        alunosDoModulo.forEach(aluno => {
            const presenca = presencasAula.find(p => p.alunoId === aluno.id);
            const status = presenca ? presenca.status : 'não registrado';
            const nota = presenca && presenca.nota ? presenca.nota : '-';

            html += `
                <tr>
                    <td><strong>${aluno.nome}</strong></td>
                    <td>
                        <span class="status-badge status-${status}">
                            ${status === 'presente' ? '✓ Presente' : status === 'falta' ? '✕ Falta' : status === 'reposta' ? '⏸ Reposta' : 'Não registrado'}
                        </span>
                    </td>
                    <td><small>${nota} / ${presenca?.observacao || '-'}</small></td>
                    <td>
                        <button class="btn-secondary" onclick="abrirModalPresenca(${aulaId}, ${aluno.id}, '${aluno.nome}')">Registrar</button>
                    </td>
                </tr>
            `;
        });
    }

    html += `</tbody></table>`;
    document.getElementById('presencas-table').innerHTML = html;
}

function abrirModalPresenca(aulaId, alunoId, alunoNome) {
    alunoPresencaSelecionado = { aulaId, alunoId, alunoNome };
    document.getElementById('presenca-aluno-nome').value = alunoNome;
    
    // Carregar dados se já existirem
    const presencaExistente = DB.presencas.find(p => p.aulaId === aulaId && p.alunoId === alunoId);
    if (presencaExistente) {
        document.getElementById('presenca-status').value = presencaExistente.status;
        document.getElementById('presenca-justificativa').value = presencaExistente.justificativa || 'nenhuma';
        document.getElementById('presenca-nota').value = presencaExistente.nota || '';
        document.getElementById('presenca-observacao').value = presencaExistente.observacao || '';
    } else {
        document.getElementById('presenca-status').value = '';
        document.getElementById('presenca-justificativa').value = 'nenhuma';
        document.getElementById('presenca-nota').value = '';
        document.getElementById('presenca-observacao').value = '';
    }
    
    atualizarCamposPresenca();
    document.getElementById('modal-presenca').classList.add('active');
}

function closePresencaModal() {
    document.getElementById('modal-presenca').classList.remove('active');
    alunoPresencaSelecionado = null;
}

function atualizarCamposPresenca() {
    const status = document.getElementById('presenca-status').value;
    const justificativaGroup = document.getElementById('justificativa-group');
    const reposicaoGroup = document.getElementById('reposicao-group');

    if (status === 'falta') {
        justificativaGroup.style.display = 'block';
        const justificativa = document.getElementById('presenca-justificativa').value;
        // Só mostra opção de reposição se for falta sem justificativa
        reposicaoGroup.style.display = justificativa === 'nenhuma' ? 'block' : 'none';
    } else {
        justificativaGroup.style.display = 'none';
        reposicaoGroup.style.display = 'none';
    }
    atualizarAvisoReposicao();
}

function atualizarAvisoReposicao() {
    const checkbox = document.getElementById('presenca-repor');
    const aviso = document.getElementById('aviso-reposicao');
    aviso.style.display = checkbox.checked ? 'block' : 'none';
}

function salvarPresencaComJustificativa(event) {
    event.preventDefault();
    if (!alunoPresencaSelecionado) return;

    const status = document.getElementById('presenca-status').value;
    const justificativa = document.getElementById('presenca-justificativa').value || '-';
    const nota = document.getElementById('presenca-nota').value;
    const observacao = document.getElementById('presenca-observacao').value;
    const querRepor = document.getElementById('presenca-repor').checked;

    // Remover registro anterior se existir
    DB.presencas = DB.presencas.filter(p => !(p.aulaId === alunoPresencaSelecionado.aulaId && p.alunoId === alunoPresencaSelecionado.alunoId));

    const presenca = {
        id: Date.now(),
        aulaId: alunoPresencaSelecionado.aulaId,
        alunoId: alunoPresencaSelecionado.alunoId,
        status,
        justificativa,
        nota: nota ? parseFloat(nota) : null,
        observacao: observacao,
        querRepor: querRepor,
        dataRegistro: new Date().toISOString(),
    };

    DB.presencas.push(presenca);

    // Se for falta sem justificativa E o aluno quiser repor, gera débito de R$ 35,00
    if (status === 'falta' && justificativa === 'nenhuma' && querRepor) {
        criarDebitoPorFalta(alunoPresencaSelecionado.alunoId);
    }

    saveDB();
    closePresencaModal();
    carregarPresencas();
    loadDashboard();
}

function criarDebitoPorFalta(alunoId) {
    const aluno = DB.alunos.find(a => a.id === alunoId);
    if (!aluno) return;

    const pagamento = {
        id: Date.now(),
        alunoId,
        descricao: 'Aula Reposta - Falta sem Justificativa',
        valor: 35.00,
        dataVencimento: new Date().toISOString().split('T')[0],
        dataPagamento: null,
        status: 'pendente',
        tipo: 'reposta',
    };

    DB.pagamentos.push(pagamento);
}

// ===== FINANCEIRO (MELHORADO COM FILTROS E LIMPEZA) =====
function loadFinanceiro() {
    atualizarStatusPagamentos();
    
    // Preencher filtros se vazios
    const filterMes = document.getElementById('filter-financeiro-mes');
    if (filterMes.options.length <= 1) {
        const meses = [...new Set(DB.pagamentos.map(p => p.dataVencimento.substring(0, 7)))].sort().reverse();
        meses.forEach(m => {
            const option = document.createElement('option');
            option.value = m;
            option.textContent = m.split('-').reverse().join('/');
            filterMes.appendChild(option);
        });
    }

    const filterModulo = document.getElementById('filter-financeiro-modulo');
    if (filterModulo.options.length <= 1) {
        DB.modulos.forEach(m => {
            const option = document.createElement('option');
            option.value = m.nivel;
            option.textContent = m.nome;
            filterModulo.appendChild(option);
        });
    }

    const statusFilter = document.getElementById('filter-financeiro-status').value;
    const mesFilter = document.getElementById('filter-financeiro-mes').value;
    const moduloFilter = document.getElementById('filter-financeiro-modulo').value;

    let filtrados = DB.pagamentos;

    if (statusFilter) filtrados = filtrados.filter(p => p.status === statusFilter);
    if (mesFilter) filtrados = filtrados.filter(p => p.dataVencimento.startsWith(mesFilter));
    if (moduloFilter) {
        filtrados = filtrados.filter(p => {
            const aluno = DB.alunos.find(a => a.id === p.alunoId);
            if (!aluno) return false;
            if (moduloFilter === 'basico') return aluno.curso === 'Inglês Básico';
            if (moduloFilter === 'avancado') return aluno.curso === 'Inglês Avançado';
            if (moduloFilter === 'particular') return aluno.curso === 'Particular';
            return true;
        });
    }

    renderFinanceiro(filtrados);
}

function renderFinanceiro(pagamentos) {
    const container = document.getElementById('financeiro-table-body');
    if (pagamentos.length === 0) {
        container.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">Nenhum pagamento encontrado com estes filtros.</td></tr>';
        return;
    }

    container.innerHTML = pagamentos.map(pag => {
        const aluno = DB.alunos.find(a => a.id === pag.alunoId);
        const statusClass = pag.status === 'pago' ? 'status-pago' : pag.status === 'pendente' ? 'status-pendente' : 'status-atrasado';
        const statusText = pag.status === 'pago' ? '✓ Pago' : pag.status === 'pendente' ? '⏳ Pendente' : '⚠️ Atrasado';

        return `
            <tr>
                <td>${aluno?.nome || '<span style="color:red">Aluno Excluído</span>'}</td>
                <td>${pag.descricao}</td>
                <td>R$ ${pag.valor.toFixed(2)}</td>
                <td>${new Date(pag.dataVencimento).toLocaleDateString('pt-BR')}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="btn-secondary" onclick="abrirModalPagamento(${pag.id})">Atualizar</button>
                </td>
            </tr>
        `;
    }).join('');
}

function limparRegistrosAntigos() {
    if (confirm('Deseja remover todos os registros de pagamentos de alunos que já foram excluídos?')) {
        const idsAlunosAtivos = new Set(DB.alunos.map(a => a.id));
        DB.pagamentos = DB.pagamentos.filter(p => idsAlunosAtivos.has(p.alunoId));
        saveDB();
        loadFinanceiro();
        alert('Registros limpos com sucesso!');
    }
}

function abrirModalPagamento(pagamentoId) {
    pagamentoEmEdicao = DB.pagamentos.find(p => p.id === pagamentoId);
    if (!pagamentoEmEdicao) return;
    const aluno = DB.alunos.find(a => a.id === pagamentoEmEdicao.alunoId);
    document.getElementById('pagamento-aluno-nome').value = aluno?.nome || 'Desconhecido';
    document.getElementById('pagamento-descricao').value = pagamentoEmEdicao.descricao;
    document.getElementById('pagamento-valor').value = `R$ ${pagamentoEmEdicao.valor.toFixed(2)}`;
    document.getElementById('pagamento-data').value = pagamentoEmEdicao.dataPagamento || new Date().toISOString().split('T')[0];
    document.getElementById('pagamento-novo-status').value = pagamentoEmEdicao.status;
    document.getElementById('modal-pagamento').classList.add('active');
}

function closeModalPagamento() {
    document.getElementById('modal-pagamento').classList.remove('active');
}

function salvarPagamento(event) {
    event.preventDefault();
    if (!pagamentoEmEdicao) return;
    pagamentoEmEdicao.status = document.getElementById('pagamento-novo-status').value;
    pagamentoEmEdicao.dataPagamento = document.getElementById('pagamento-data').value;
    saveDB();
    closeModalPagamento();
    loadFinanceiro();
    loadDashboard();
}

// ===== RELATÓRIOS (MELHORADOS) =====
let charts = {};

function toggleSection(id) {
    const content = document.getElementById(id);
    const header = content.previousElementSibling;
    content.classList.toggle('active');
    header.classList.toggle('collapsed');
}

function loadRelatorios() {
    const exportSelect = document.getElementById('export-month-select');
    if (exportSelect.options.length <= 1) {
        const meses = [...new Set(DB.pagamentos.map(p => p.dataVencimento.substring(0, 7)))].sort().reverse();
        meses.forEach(m => {
            const option = document.createElement('option');
            option.value = m;
            option.textContent = m.split('-').reverse().join('/');
            exportSelect.appendChild(option);
        });
    }

    renderResumoMensal();
    renderDesempenhoAlunos();
    renderSituacaoFinanceira();
    renderEstatisticasNivel();
    renderGraficos();
}

function exportarRelatorioPDF() {
    const element = document.querySelector('.relatorios-container');
    const mesSelecionado = document.getElementById('export-month-select').value || new Date().toISOString().substring(0, 7);
    
    // Abrir todas as seções para o PDF
    document.querySelectorAll('.collapsible-content').forEach(c => c.classList.add('active'));
    document.querySelectorAll('.section-header').forEach(h => h.classList.remove('collapsed'));

    const opt = {
        margin: 10,
        filename: `Relatorio_Beatriz_${mesSelecionado}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Adicionar um título temporário para o PDF
    const header = document.createElement('div');
    header.innerHTML = `<h1 style="color: #592581; text-align: center; margin-bottom: 20px;">Relatório de Gestão - Beatriz Management</h1>
                        <p style="text-align: center; margin-bottom: 30px;">Referência: ${mesSelecionado.split('-').reverse().join('/')}</p>`;
    element.prepend(header);

    html2pdf().set(opt).from(element).save().then(() => {
        header.remove();
    });
}

function renderGraficos() {
    // Destruir gráficos existentes se houver
    if (charts.financeiro) charts.financeiro.destroy();
    if (charts.niveis) charts.niveis.destroy();

    // Dados Financeiros
    const receitaPaga = DB.pagamentos.filter(p => p.status === 'pago').reduce((sum, p) => sum + p.valor, 0);
    const receitaPendente = DB.pagamentos.filter(p => p.status === 'pendente').reduce((sum, p) => sum + p.valor, 0);
    const receitaAtrasada = DB.pagamentos.filter(p => p.status === 'atrasado').reduce((sum, p) => sum + p.valor, 0);

    const ctxFin = document.getElementById('chart-financeiro').getContext('2d');
    charts.financeiro = new Chart(ctxFin, {
        type: 'pie',
        data: {
            labels: ['Pago', 'Pendente', 'Atrasado'],
            datasets: [{
                data: [receitaPaga, receitaPendente, receitaAtrasada],
                backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: 'Distribuição Financeira (R$)', color: '#592581', font: { size: 16, weight: 'bold' } }
            }
        }
    });

    // Dados por Nível
    const niveis = { basico: 0, avancado: 0, particular: 0 };
    DB.alunos.filter(a => a.status === 'ativo').forEach(aluno => {
        if (aluno.curso === 'Inglês Básico') niveis.basico++;
        else if (aluno.curso === 'Inglês Avançado') niveis.avancado++;
        else if (aluno.curso === 'Particular') niveis.particular++;
    });

    const ctxNiv = document.getElementById('chart-alunos-nivel').getContext('2d');
    charts.niveis = new Chart(ctxNiv, {
        type: 'bar',
        data: {
            labels: ['Básico', 'Avançado', 'Particular'],
            datasets: [{
                label: 'Alunos Ativos',
                data: [niveis.basico, niveis.avancado, niveis.particular],
                backgroundColor: ['#A78BFA', '#8B5CF6', '#592581'],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Alunos Ativos por Nível', color: '#592581', font: { size: 16, weight: 'bold' } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });
}

function renderResumoMensal() {
    // Foco apenas em alunos ativos conforme solicitado
    const alunosAtivos = DB.alunos.filter(a => a.status === 'ativo');
    const totalAlunosAtivos = alunosAtivos.length;
    
    const idsAtivos = new Set(alunosAtivos.map(a => a.id));
    const presencasAtivos = DB.presencas.filter(p => idsAtivos.has(p.alunoId));
    const presencasPositivas = presencasAtivos.filter(p => p.status === 'presente').length;
    const frequenciaMedia = presencasAtivos.length > 0 ? Math.round((presencasPositivas / presencasAtivos.length) * 100) : 0;
    
    const receitaPaga = DB.pagamentos.filter(p => p.status === 'pago').reduce((sum, p) => sum + p.valor, 0);
    const receitaPendente = DB.pagamentos.filter(p => p.status === 'pendente' || p.status === 'atrasado').reduce((sum, p) => sum + p.valor, 0);
    
    document.getElementById('rel-total-alunos').textContent = totalAlunosAtivos;
    document.getElementById('rel-frequencia-media').textContent = frequenciaMedia + '%';
    document.getElementById('rel-receita-total').textContent = 'R$ ' + receitaPaga.toFixed(2).replace('.', ',');
    document.getElementById('rel-pendencias').textContent = 'R$ ' + receitaPendente.toFixed(2).replace('.', ',');
}

function renderDesempenhoAlunos() {
    const container = document.getElementById('relatorio-alunos');
    const alunosAtivos = DB.alunos.filter(a => a.status === 'ativo');
    
    if (alunosAtivos.length === 0) {
        container.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Nenhum aluno ativo cadastrado</td></tr>';
        return;
    }

    container.innerHTML = alunosAtivos.map(aluno => {
        const presencasAluno = DB.presencas.filter(p => p.alunoId === aluno.id);
        const presencasPositivas = presencasAluno.filter(p => p.status === 'presente').length;
        const frequencia = presencasAluno.length > 0 ? Math.round((presencasPositivas / presencasAluno.length) * 100) : 0;
        
        // Média de notas de todas as aulas
        const notas = presencasAluno.filter(p => p.nota !== null).map(p => p.nota);
        const mediaNotas = notas.length > 0 ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1) : '-';
        
        const temDebito = DB.pagamentos.some(p => p.alunoId === aluno.id && (p.status === 'pendente' || p.status === 'atrasado'));
        const situacao = temDebito ? '⚠️ Com Débito' : '✓ Em Dia';
        
        return `
            <tr>
                <td><strong>${aluno.nome}</strong></td>
                <td>${aluno.curso || '-'}</td>
                <td>${frequencia}%</td>
                <td>${mediaNotas}</td>
                <td>${situacao}</td>
                <td><button class="btn-secondary" onclick="goToPage('presencas')">Ver Aulas</button></td>
            </tr>
        `;
    }).join('');
}

function renderSituacaoFinanceira() {
    const container = document.getElementById('relatorio-financeiro');
    const alunosAtivos = DB.alunos.filter(a => a.status === 'ativo');
    
    if (alunosAtivos.length === 0) {
        container.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhum aluno ativo cadastrado</td></tr>';
        return;
    }
    container.innerHTML = alunosAtivos.map(aluno => {
        const pagamentosAluno = DB.pagamentos.filter(p => p.alunoId === aluno.id);
        const mensalidade = aluno.valor || 0;
        const pendencias = pagamentosAluno.filter(p => p.status === 'pendente' || p.status === 'atrasado').reduce((sum, p) => sum + p.valor, 0);
        const statusClass = pendencias > 0 ? 'status-atrasado' : 'status-pago';
        const statusText = pendencias > 0 ? 'Com Débito' : 'Em Dia';
        return `<tr><td><strong>${aluno.nome}</strong></td><td>R$ ${mensalidade.toFixed(2)}</td><td>R$ ${pendencias.toFixed(2)}</td><td><span class="status-badge ${statusClass}">${statusText}</span></td></tr>`;
    }).join('');
}

function renderEstatisticasNivel() {
    const container = document.getElementById('relatorio-niveis');
    const niveis = { basico: 0, avancado: 0, particular: 0 };
    
    DB.alunos.filter(a => a.status === 'ativo').forEach(aluno => {
        if (aluno.curso === 'Inglês Básico') niveis.basico++;
        else if (aluno.curso === 'Inglês Avançado') niveis.avancado++;
        else if (aluno.curso === 'Particular') niveis.particular++;
    });
    
    container.innerHTML = `
        <div class="stat-item"><h4>📚 Básico</h4><p><strong>Ativos:</strong> ${niveis.basico}</p></div>
        <div class="stat-item"><h4>📚 Avançado</h4><p><strong>Ativos:</strong> ${niveis.avancado}</p></div>
        <div class="stat-item"><h4>👤 Particular</h4><p><strong>Ativos:</strong> ${niveis.particular}</p></div>
    `;
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    atualizarStatusPagamentos();
    loadDashboard();
});
