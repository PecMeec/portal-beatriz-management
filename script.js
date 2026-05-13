// ============================================================
// script.js — versão Firebase
//
// DIFERENÇA PRINCIPAL em relação à versão anterior:
//
// ANTES:
//   const DB = { alunos: JSON.parse(localStorage.getItem('alunos')) || [] ... }
//   function saveDB() { localStorage.setItem(...) }
//
// DEPOIS:
//   DB é um atalho para window.DB (preenchido pelo firebase-config.js)
//   saveDB() está no firebase-config.js e salva na nuvem
//
// Todo o resto da lógica é idêntico.
// ============================================================

// Atalho — aponta para o mesmo objeto do firebase-config.js
// Qualquer mudança em DB aqui reflete em window.DB automaticamente
const DB = window.DB;

let alunoEmEdicao            = null;
let aulaAtualSelecionada     = null;
let alunoPresencaSelecionado = null;
let pagamentoEmEdicao        = null;

// ===== PAGAMENTOS: atualizar status automaticamente =====
function atualizarStatusPagamentos() {
    const hoje = new Date();
    let alterado = false;
    DB.pagamentos.forEach(pag => {
        if (pag.status === 'pendente') {
            const diffDays = Math.ceil((hoje - new Date(pag.dataVencimento)) / (1000*60*60*24));
            if (diffDays > 5) { pag.status = 'atrasado'; alterado = true; }
        }
    });
    if (alterado) saveDB();
}

// ===== NAVEGAÇÃO =====
function goToPage(pageName) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById(pageName);
    if (el) el.classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick')?.includes(pageName)) btn.classList.add('active');
    });

    if      (pageName === 'dashboard')    loadDashboard();
    else if (pageName === 'alunos')       loadAlunos();
    else if (pageName === 'modulos')      loadModulos();
    else if (pageName === 'presencas')    loadPresencasPage();
    else if (pageName === 'financeiro')   loadFinanceiro();
    else if (pageName === 'relatorios')   loadRelatorios();
    else if (pageName === 'minhas-aulas') loadMinhasAulas();
}

// ===== DASHBOARD =====
function loadDashboard() {
    atualizarStatusPagamentos();
    document.getElementById('total-alunos').textContent =
        DB.alunos.filter(a => a.status === 'ativo').length;
    document.getElementById('total-modulos').textContent = DB.modulos.length;
    document.getElementById('pagamentos-atrasados').textContent =
        DB.pagamentos.filter(p => p.status === 'atrasado').length;
    document.getElementById('alunos-devedores').textContent =
        new Set(DB.pagamentos.filter(p => p.status==='pendente'||p.status==='atrasado').map(p=>p.alunoId)).size;
}

// ===== ALUNOS =====
function loadAlunos() { renderAlunos(DB.alunos); }

function renderAlunos(alunos) {
    const container = document.getElementById('alunos-list');
    if (alunos.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhum aluno encontrado.</div>';
        return;
    }
    const diasNomes = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    container.innerHTML = alunos.map(aluno => {
        const temDebito = DB.pagamentos.some(p => p.alunoId===aluno.id && (p.status==='pendente'||p.status==='atrasado'));
        const diasTexto = (aluno.diasSemana||[]).map(d => diasNomes[parseInt(d)]).join(', ');
        return `
            <div class="aluno-card">
                <div class="aluno-name">${aluno.nome}</div>
                <div class="aluno-info">
                    ${aluno.email    ? `<span>📧 ${aluno.email}</span>`    : ''}
                    ${aluno.telefone ? `<span>📱 ${aluno.telefone}</span>` : ''}
                </div>
                <div class="aluno-info"><span>📚 ${aluno.curso||'Sem curso'}</span></div>
                <div class="aluno-info">
                    <span>💰 R$ ${aluno.valor ? aluno.valor.toFixed(2) : '0.00'}</span>
                    <span>📅 Início: ${new Date(aluno.dataInicio).toLocaleDateString('pt-BR')}</span>
                </div>
                ${diasTexto ? `<div class="aluno-info"><span>🗓️ ${diasTexto} às ${fmtHora(aluno.horario)}</span></div>` : ''}
                ${temDebito ? '<span style="color:#EF4444;font-weight:bold;font-size:12px;display:block;margin-top:5px;">💳 COM DÉBITO</span>' : ''}
                <div class="aluno-status status-${aluno.status}">
                    ${aluno.status==='ativo' ? '✓ Ativo' : aluno.status==='pausado' ? '⏸ Pausado' : '✕ Inativo'}
                </div>
                <div style="margin-top:15px;display:flex;flex-wrap:wrap;gap:10px;">
                    <button class="btn-secondary" onclick="editarAluno(${aluno.id})">Editar</button>
                    <button class="btn-secondary" onclick="deletarAluno(${aluno.id})" style="color:#EF4444;border-color:#EF4444;">Deletar</button>
                </div>
            </div>`;
    }).join('');
}

function filterAlunos() {
    const search = document.getElementById('search-alunos').value.toLowerCase();
    const status = document.getElementById('filter-status').value;
    const curso  = document.getElementById('filter-curso').value;
    renderAlunos(DB.alunos.filter(a =>
        a.nome.toLowerCase().includes(search) &&
        (!status || a.status===status) &&
        (!curso  || a.curso===curso)
    ));
}

function openAlunoModal() {
    alunoEmEdicao = null;
    document.getElementById('modal-aluno-titulo').textContent = 'Cadastrar Novo Aluno';
    document.getElementById('form-aluno').reset();
    document.querySelectorAll('input[name="diasSemana"]').forEach(cb => cb.checked=false);
    document.getElementById('modal-aluno').classList.add('active');
}

function closeAlunoModal() {
    document.getElementById('modal-aluno').classList.remove('active');
    document.getElementById('form-aluno').reset();
    document.querySelectorAll('input[name="diasSemana"]').forEach(cb => cb.checked=false);
    alunoEmEdicao = null;
}

function salvarAluno(event) {
    event.preventDefault();
    const diasSemana = Array.from(document.querySelectorAll('input[name="diasSemana"]:checked')).map(cb=>cb.value);
    const aluno = {
        id:            alunoEmEdicao ? alunoEmEdicao.id : Date.now(),
        nome:          document.getElementById('aluno-nome').value,
        email:         document.getElementById('aluno-email').value,
        telefone:      document.getElementById('aluno-telefone').value,
        curso:         document.getElementById('aluno-curso').value,
        valor:         parseFloat(document.getElementById('aluno-valor').value),
        diaVencimento: parseInt(document.getElementById('aluno-dia-vencimento').value),
        dataInicio:    document.getElementById('aluno-data').value,
        status:        document.getElementById('aluno-status').value,
        diasSemana,
        horario:       document.getElementById('aluno-horario').value,
    };
    if (alunoEmEdicao) {
        DB.alunos[DB.alunos.findIndex(a=>a.id===alunoEmEdicao.id)] = aluno;
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
    alunoEmEdicao = DB.alunos.find(a=>a.id===id);
    if (!alunoEmEdicao) return;
    document.getElementById('modal-aluno-titulo').textContent    = 'Editar Aluno';
    document.getElementById('aluno-nome').value           = alunoEmEdicao.nome;
    document.getElementById('aluno-email').value          = alunoEmEdicao.email||'';
    document.getElementById('aluno-telefone').value       = alunoEmEdicao.telefone||'';
    document.getElementById('aluno-curso').value          = alunoEmEdicao.curso;
    document.getElementById('aluno-valor').value          = alunoEmEdicao.valor;
    document.getElementById('aluno-dia-vencimento').value = alunoEmEdicao.diaVencimento;
    document.getElementById('aluno-data').value           = alunoEmEdicao.dataInicio;
    document.getElementById('aluno-status').value         = alunoEmEdicao.status;
    document.querySelectorAll('input[name="diasSemana"]').forEach(cb => {
        cb.checked = (alunoEmEdicao.diasSemana||[]).map(String).includes(cb.value);
    });
    const h = document.getElementById('aluno-horario');
    if (h) h.value = alunoEmEdicao.horario||'';
    document.getElementById('modal-aluno').classList.add('active');
}

function deletarAluno(id) {
    if (confirm('Tem certeza que deseja excluir este aluno?')) {
        DB.alunos = DB.alunos.filter(a=>a.id!==id);
        saveDB(); loadAlunos(); loadDashboard();
    }
}

function criarPagamentoMensalidade(aluno) {
    const hoje = new Date();
    let dataVenc = new Date(hoje.getFullYear(), hoje.getMonth(), aluno.diaVencimento);
    if (dataVenc < hoje) dataVenc = new Date(hoje.getFullYear(), hoje.getMonth()+1, aluno.diaVencimento);
    DB.pagamentos.push({
        id: Date.now(), alunoId: aluno.id,
        descricao: 'Mensalidade - '+(dataVenc.getMonth()+1)+'/'+dataVenc.getFullYear(),
        valor: aluno.valor, dataVencimento: dataVenc.toISOString().split('T')[0],
        dataPagamento: null, status: 'pendente', tipo: 'mensalidade',
    });
}

// ===== MÓDULOS =====
function loadModulos() {
    const container = document.getElementById('modulos-list');
    if (DB.modulos.length===0) { container.innerHTML='<p class="empty-state">Nenhum módulo criado.</p>'; return; }
    container.innerHTML = DB.modulos.map(m =>
        `<button class="modulo-btn ${window.moduloSelecionado===m.id?'active':''}" onclick="selecionarModulo(${m.id})">${m.nome} (${m.nivel})</button>`
    ).join('');
}

function selecionarModulo(id) {
    window.moduloSelecionado = id;
    loadModulos();
    const aulas = DB.aulas.filter(a=>a.moduloId===id);
    document.getElementById('btn-nova-aula').style.display='block';
    const container = document.getElementById('aulas-list');
    if (aulas.length===0) { container.innerHTML='<p class="empty-state">Nenhuma aula cadastrada.</p>'; return; }
    container.innerHTML = aulas.map(a => `
        <div class="aula-card">
            <h4>${a.titulo}</h4>
            <p class="aula-info">📅 ${new Date(a.dataAula).toLocaleDateString('pt-BR')} | ⏱ ${a.duracao} min</p>
            <p style="font-size:13px;margin-top:5px;">${a.descricao||'Sem descrição'}</p>
        </div>`).join('');
}

function openModuloModal()  { document.getElementById('modal-modulo').classList.add('active'); }
function closeModuloModal() { document.getElementById('modal-modulo').classList.remove('active'); document.getElementById('form-modulo').reset(); }

function salvarModulo(event) {
    event.preventDefault();
    DB.modulos.push({ id:Date.now(), nome:document.getElementById('modulo-nome').value,
        descricao:document.getElementById('modulo-descricao').value,
        nivel:document.getElementById('modulo-nivel').value,
        dataInicio:document.getElementById('modulo-data').value, ativo:true });
    saveDB(); closeModuloModal(); loadModulos(); loadDashboard();
}

function openAulaModal()  { document.getElementById('modal-aula').classList.add('active'); }
function closeAulaModal() { document.getElementById('modal-aula').classList.remove('active'); document.getElementById('form-aula').reset(); }

function salvarAula(event) {
    event.preventDefault();
    DB.aulas.push({ id:Date.now(), moduloId:window.moduloSelecionado,
        titulo:document.getElementById('aula-titulo').value,
        descricao:document.getElementById('aula-descricao').value,
        dataAula:document.getElementById('aula-data').value,
        duracao:parseInt(document.getElementById('aula-duracao').value)||60 });
    saveDB(); closeAulaModal(); selecionarModulo(window.moduloSelecionado);
}

// ===== PRESENÇA =====
function loadPresencasPage() {
    document.getElementById('select-modulo-presenca').innerHTML =
        '<option value="">-- Selecione um módulo --</option>' +
        DB.modulos.map(m=>`<option value="${m.id}">${m.nome} (${m.nivel})</option>`).join('');
    document.getElementById('select-aula').innerHTML = '<option value="">-- Selecione primeiro o módulo --</option>';
    document.getElementById('presencas-table').innerHTML = '';
}

function carregarAulasDoModulo() {
    const moduloId = parseInt(document.getElementById('select-modulo-presenca').value);
    const sel = document.getElementById('select-aula');
    if (!moduloId) { sel.innerHTML='<option value="">-- Selecione primeiro o módulo --</option>'; return; }
    const aulas = DB.aulas.filter(a=>a.moduloId===moduloId&&!a._calGerada);
    sel.innerHTML = aulas.length===0
        ? '<option value="">Nenhuma aula encontrada</option>'
        : '<option value="">-- Selecione uma aula --</option>' +
          aulas.map(a=>`<option value="${a.id}">${a.titulo} (${new Date(a.dataAula).toLocaleDateString('pt-BR')})</option>`).join('');
    document.getElementById('presencas-table').innerHTML='';
}

function carregarPresencas() {
    const aulaId   = parseInt(document.getElementById('select-aula').value);
    const moduloId = parseInt(document.getElementById('select-modulo-presenca').value);
    if (!aulaId||!moduloId) { document.getElementById('presencas-table').innerHTML=''; return; }
    aulaAtualSelecionada = aulaId;
    const aula   = DB.aulas.find(a=>a.id===aulaId);
    const modulo = DB.modulos.find(m=>m.id===moduloId);
    const presencasAula = DB.presencas.filter(p=>p.aulaId===aulaId);
    const alunosDoModulo = DB.alunos.filter(a => {
        if (modulo.nivel==='particular') return a.curso==='Particular';
        if (modulo.nivel==='basico')     return a.curso==='Inglês Básico';
        if (modulo.nivel==='avancado')   return a.curso==='Inglês Avançado';
        return true;
    });
    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
        <h3>Presença: ${aula.titulo}</h3>
        <span class="card-desc">${alunosDoModulo.length} alunos vinculados</span></div>
        <table class="presenca-table"><thead><tr><th>Aluno</th><th>Status</th><th>Nota/Obs</th><th>Ações</th></tr></thead><tbody>`;
    if (alunosDoModulo.length===0) {
        html+=`<tr><td colspan="4" class="empty-state">Nenhum aluno vinculado.</td></tr>`;
    } else {
        alunosDoModulo.forEach(aluno => {
            const p = presencasAula.find(p=>p.alunoId===aluno.id);
            const st = p ? p.status : 'não registrado';
            html+=`<tr><td><strong>${aluno.nome}</strong></td>
                <td><span class="status-badge status-${st}">
                    ${st==='presente'?'✓ Presente':st==='falta'?'✕ Falta':st==='reposta'?'⏸ Reposta':'Não registrado'}
                </span></td>
                <td><small>${p?.nota||'-'} / ${p?.observacao||'-'}</small></td>
                <td><button class="btn-secondary" onclick="abrirModalPresenca(${aulaId},${aluno.id},'${aluno.nome}')">Registrar</button></td></tr>`;
        });
    }
    html+=`</tbody></table>`;
    document.getElementById('presencas-table').innerHTML=html;
}

function abrirModalPresenca(aulaId, alunoId, alunoNome) {
    alunoPresencaSelecionado = {aulaId,alunoId,alunoNome};
    document.getElementById('presenca-aluno-nome').value = alunoNome;
    const p = DB.presencas.find(p=>p.aulaId===aulaId&&p.alunoId===alunoId);
    document.getElementById('presenca-status').value        = p?.status||'';
    document.getElementById('presenca-justificativa').value = p?.justificativa||'nenhuma';
    document.getElementById('presenca-nota').value          = p?.nota||'';
    document.getElementById('presenca-observacao').value    = p?.observacao||'';
    atualizarCamposPresenca();
    document.getElementById('modal-presenca').classList.add('active');
}

function closePresencaModal() { document.getElementById('modal-presenca').classList.remove('active'); alunoPresencaSelecionado=null; }

function atualizarCamposPresenca() {
    const status = document.getElementById('presenca-status').value;
    document.getElementById('justificativa-group').style.display = status==='falta'?'block':'none';
    document.getElementById('reposicao-group').style.display =
        (status==='falta' && document.getElementById('presenca-justificativa').value==='nenhuma') ? 'block' : 'none';
    atualizarAvisoReposicao();
}

function atualizarAvisoReposicao() {
    document.getElementById('aviso-reposicao').style.display =
        document.getElementById('presenca-repor').checked ? 'block' : 'none';
}

function salvarPresencaComJustificativa(event) {
    event.preventDefault();
    if (!alunoPresencaSelecionado) return;
    const status      = document.getElementById('presenca-status').value;
    const justificativa = document.getElementById('presenca-justificativa').value||'-';
    const nota        = document.getElementById('presenca-nota').value;
    const observacao  = document.getElementById('presenca-observacao').value;
    const querRepor   = document.getElementById('presenca-repor').checked;
    DB.presencas = DB.presencas.filter(p=>!(p.aulaId===alunoPresencaSelecionado.aulaId&&p.alunoId===alunoPresencaSelecionado.alunoId));
    DB.presencas.push({ id:Date.now(), aulaId:alunoPresencaSelecionado.aulaId,
        alunoId:alunoPresencaSelecionado.alunoId, status, justificativa,
        nota:nota?parseFloat(nota):null, observacao, querRepor,
        dataRegistro:new Date().toISOString() });
    if (status==='falta'&&justificativa==='nenhuma'&&querRepor) criarDebitoPorFalta(alunoPresencaSelecionado.alunoId);
    saveDB(); closePresencaModal(); carregarPresencas(); renderPresencaRapida(); loadDashboard();
}

function criarDebitoPorFalta(alunoId) {
    DB.pagamentos.push({ id:Date.now(), alunoId, descricao:'Aula Reposta - Falta sem Justificativa',
        valor:35.00, dataVencimento:new Date().toISOString().split('T')[0],
        dataPagamento:null, status:'pendente', tipo:'reposta' });
}

// ===== FINANCEIRO =====
function loadFinanceiro() {
    atualizarStatusPagamentos();
    const filterMes = document.getElementById('filter-financeiro-mes');
    if (filterMes.options.length<=1) {
        [...new Set(DB.pagamentos.map(p=>p.dataVencimento.substring(0,7)))].sort().reverse().forEach(m=>{
            const o=document.createElement('option'); o.value=m; o.textContent=m.split('-').reverse().join('/');
            filterMes.appendChild(o);
        });
    }
    const filterMod = document.getElementById('filter-financeiro-modulo');
    if (filterMod.options.length<=1) {
        DB.modulos.forEach(m=>{ const o=document.createElement('option'); o.value=m.nivel; o.textContent=m.nome; filterMod.appendChild(o); });
    }
    let filtrados = DB.pagamentos;
    const sf=document.getElementById('filter-financeiro-status').value;
    const mf=document.getElementById('filter-financeiro-mes').value;
    const mof=document.getElementById('filter-financeiro-modulo').value;
    if (sf) filtrados=filtrados.filter(p=>p.status===sf);
    if (mf) filtrados=filtrados.filter(p=>p.dataVencimento.startsWith(mf));
    if (mof) filtrados=filtrados.filter(p=>{
        const a=DB.alunos.find(a=>a.id===p.alunoId); if(!a) return false;
        if(mof==='basico') return a.curso==='Inglês Básico';
        if(mof==='avancado') return a.curso==='Inglês Avançado';
        if(mof==='particular') return a.curso==='Particular'; return true;
    });
    renderFinanceiro(filtrados);
}

function renderFinanceiro(pagamentos) {
    const container = document.getElementById('financeiro-table-body');
    if (pagamentos.length===0) { container.innerHTML='<tr><td colspan="6" style="text-align:center;padding:40px;">Nenhum pagamento encontrado.</td></tr>'; return; }
    container.innerHTML = pagamentos.map(pag=>{
        const a=DB.alunos.find(a=>a.id===pag.alunoId);
        const sc=pag.status==='pago'?'status-pago':pag.status==='pendente'?'status-pendente':'status-atrasado';
        const st=pag.status==='pago'?'✓ Pago':pag.status==='pendente'?'⏳ Pendente':'⚠️ Atrasado';
        return `<tr><td>${a?.nome||'<span style="color:red">Aluno Excluído</span>'}</td>
            <td>${pag.descricao}</td><td>R$ ${pag.valor.toFixed(2)}</td>
            <td>${new Date(pag.dataVencimento).toLocaleDateString('pt-BR')}</td>
            <td><span class="status-badge ${sc}">${st}</span></td>
            <td><button class="btn-secondary" onclick="abrirModalPagamento(${pag.id})">Atualizar</button></td></tr>`;
    }).join('');
}

function limparRegistrosAntigos() {
    if (confirm('Remover pagamentos de alunos já excluídos?')) {
        const ids=new Set(DB.alunos.map(a=>a.id));
        DB.pagamentos=DB.pagamentos.filter(p=>ids.has(p.alunoId));
        saveDB(); loadFinanceiro(); alert('Registros limpos!');
    }
}

function abrirModalPagamento(id) {
    pagamentoEmEdicao=DB.pagamentos.find(p=>p.id===id); if(!pagamentoEmEdicao) return;
    const a=DB.alunos.find(a=>a.id===pagamentoEmEdicao.alunoId);
    document.getElementById('pagamento-aluno-nome').value  = a?.nome||'Desconhecido';
    document.getElementById('pagamento-descricao').value   = pagamentoEmEdicao.descricao;
    document.getElementById('pagamento-valor').value       = `R$ ${pagamentoEmEdicao.valor.toFixed(2)}`;
    document.getElementById('pagamento-data').value        = pagamentoEmEdicao.dataPagamento||new Date().toISOString().split('T')[0];
    document.getElementById('pagamento-novo-status').value = pagamentoEmEdicao.status;
    document.getElementById('modal-pagamento').classList.add('active');
}

function closeModalPagamento() { document.getElementById('modal-pagamento').classList.remove('active'); }

function salvarPagamento(event) {
    event.preventDefault(); if(!pagamentoEmEdicao) return;
    pagamentoEmEdicao.status        = document.getElementById('pagamento-novo-status').value;
    pagamentoEmEdicao.dataPagamento = document.getElementById('pagamento-data').value;
    saveDB(); closeModalPagamento(); loadFinanceiro(); loadDashboard();
}

// ===== RELATÓRIOS =====
let charts = {};

function toggleSection(id) {
    const c=document.getElementById(id); c.classList.toggle('active'); c.previousElementSibling.classList.toggle('collapsed');
}

function loadRelatorios() {
    const sel=document.getElementById('export-month-select');
    if (sel.options.length<=1) {
        [...new Set(DB.pagamentos.map(p=>p.dataVencimento.substring(0,7)))].sort().reverse().forEach(m=>{
            const o=document.createElement('option'); o.value=m; o.textContent=m.split('-').reverse().join('/'); sel.appendChild(o);
        });
    }
    renderResumoMensal(); renderDesempenhoAlunos(); renderSituacaoFinanceira(); renderEstatisticasNivel(); renderGraficos();
}

function exportarRelatorioPDF() {
    const el=document.querySelector('.relatorios-container');
    const mes=document.getElementById('export-month-select').value||new Date().toISOString().substring(0,7);
    document.querySelectorAll('.collapsible-content').forEach(c=>c.classList.add('active'));
    document.querySelectorAll('.section-header').forEach(h=>h.classList.remove('collapsed'));
    const hdr=document.createElement('div');
    hdr.innerHTML=`<h1 style="color:#592581;text-align:center;margin-bottom:20px;">Relatório - Beatriz Management</h1><p style="text-align:center;margin-bottom:30px;">Referência: ${mes.split('-').reverse().join('/')}</p>`;
    el.prepend(hdr);
    html2pdf().set({margin:10,filename:`Relatorio_Beatriz_${mes}.pdf`,image:{type:'jpeg',quality:0.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}}).from(el).save().then(()=>hdr.remove());
}

function renderGraficos() {
    if (charts.financeiro) charts.financeiro.destroy();
    if (charts.niveis)     charts.niveis.destroy();
    const rP=DB.pagamentos.filter(p=>p.status==='pago').reduce((s,p)=>s+p.valor,0);
    const rPe=DB.pagamentos.filter(p=>p.status==='pendente').reduce((s,p)=>s+p.valor,0);
    const rA=DB.pagamentos.filter(p=>p.status==='atrasado').reduce((s,p)=>s+p.valor,0);
    charts.financeiro=new Chart(document.getElementById('chart-financeiro').getContext('2d'),{
        type:'pie',data:{labels:['Pago','Pendente','Atrasado'],datasets:[{data:[rP,rPe,rA],backgroundColor:['#10B981','#F59E0B','#EF4444'],borderWidth:2,borderColor:'#fff'}]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'},title:{display:true,text:'Distribuição Financeira (R$)',color:'#592581',font:{size:16,weight:'bold'}}}}
    });
    const nv={basico:0,avancado:0,particular:0};
    DB.alunos.filter(a=>a.status==='ativo').forEach(a=>{ if(a.curso.includes('Básico')) nv.basico++; else if(a.curso.includes('Avançado')) nv.avancado++; else nv.particular++; });
    charts.niveis=new Chart(document.getElementById('chart-alunos-nivel').getContext('2d'),{
        type:'bar',data:{labels:['Básico','Avançado','Particular'],datasets:[{label:'Alunos Ativos',data:[nv.basico,nv.avancado,nv.particular],backgroundColor:['#A78BFA','#8B5CF6','#592581'],borderRadius:8}]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},title:{display:true,text:'Alunos Ativos por Nível',color:'#592581',font:{size:16,weight:'bold'}}},scales:{y:{beginAtZero:true,ticks:{stepSize:1}}}}
    });
}

function renderResumoMensal() {
    const ativos=DB.alunos.filter(a=>a.status==='ativo'), ids=new Set(ativos.map(a=>a.id));
    const pres=DB.presencas.filter(p=>ids.has(p.alunoId));
    const freq=pres.length>0?Math.round((pres.filter(p=>p.status==='presente').length/pres.length)*100):0;
    document.getElementById('rel-total-alunos').textContent    = ativos.length;
    document.getElementById('rel-frequencia-media').textContent = freq+'%';
    document.getElementById('rel-receita-total').textContent   = 'R$ '+DB.pagamentos.filter(p=>p.status==='pago').reduce((s,p)=>s+p.valor,0).toFixed(2).replace('.',',');
    document.getElementById('rel-pendencias').textContent      = 'R$ '+DB.pagamentos.filter(p=>p.status==='pendente'||p.status==='atrasado').reduce((s,p)=>s+p.valor,0).toFixed(2).replace('.',',');
}

function renderDesempenhoAlunos() {
    const c=document.getElementById('relatorio-alunos'), ativos=DB.alunos.filter(a=>a.status==='ativo');
    if (!ativos.length) { c.innerHTML='<tr><td colspan="6" style="text-align:center;padding:20px;">Nenhum aluno ativo</td></tr>'; return; }
    c.innerHTML=ativos.map(a=>{
        const pres=DB.presencas.filter(p=>p.alunoId===a.id);
        const freq=pres.length>0?Math.round((pres.filter(p=>p.status==='presente').length/pres.length)*100):0;
        const notas=pres.filter(p=>p.nota!==null).map(p=>p.nota);
        const media=notas.length>0?(notas.reduce((a,b)=>a+b,0)/notas.length).toFixed(1):'-';
        const deb=DB.pagamentos.some(p=>p.alunoId===a.id&&(p.status==='pendente'||p.status==='atrasado'));
        return `<tr><td><strong>${a.nome}</strong></td><td>${a.curso||'-'}</td><td>${freq}%</td><td>${media}</td>
            <td>${deb?'⚠️ Com Débito':'✓ Em Dia'}</td>
            <td><button class="btn-secondary" onclick="goToPage('presencas')">Ver Aulas</button></td></tr>`;
    }).join('');
}

function renderSituacaoFinanceira() {
    const c=document.getElementById('relatorio-financeiro'), ativos=DB.alunos.filter(a=>a.status==='ativo');
    if (!ativos.length) { c.innerHTML='<tr><td colspan="4" style="text-align:center;padding:20px;">Nenhum aluno ativo</td></tr>'; return; }
    c.innerHTML=ativos.map(a=>{
        const pend=DB.pagamentos.filter(p=>p.alunoId===a.id&&(p.status==='pendente'||p.status==='atrasado')).reduce((s,p)=>s+p.valor,0);
        return `<tr><td><strong>${a.nome}</strong></td><td>R$ ${(a.valor||0).toFixed(2)}</td><td>R$ ${pend.toFixed(2)}</td>
            <td><span class="status-badge ${pend>0?'status-atrasado':'status-pago'}">${pend>0?'Com Débito':'Em Dia'}</span></td></tr>`;
    }).join('');
}

function renderEstatisticasNivel() {
    const nv={basico:0,avancado:0,particular:0};
    DB.alunos.filter(a=>a.status==='ativo').forEach(a=>{ if(a.curso.includes('Básico')) nv.basico++; else if(a.curso.includes('Avançado')) nv.avancado++; else nv.particular++; });
    document.getElementById('relatorio-niveis').innerHTML=`
        <div class="stat-item"><h4>📚 Básico</h4><p><strong>Ativos:</strong> ${nv.basico}</p></div>
        <div class="stat-item"><h4>📚 Avançado</h4><p><strong>Ativos:</strong> ${nv.avancado}</p></div>
        <div class="stat-item"><h4>👤 Particular</h4><p><strong>Ativos:</strong> ${nv.particular}</p></div>`;
}

// ============================================================
// ===== MINHAS AULAS — CALENDÁRIO =====
// ============================================================

let calViewAtual       = 'semana';
let calDataRef         = new Date();
let calDiaSelecionado  = new Date().toISOString().split('T')[0];
let remarcacaoEmEdicao = null;

function toDateStr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function fromDateStr(s) { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
function inicioSemana(date) { const d=new Date(date),dow=d.getDay(); d.setDate(d.getDate()+(dow===0?-6:1-dow)); d.setHours(0,0,0,0); return d; }
function fmtHora(t) { if(!t) return ''; const [h,m]=t.split(':'); return m==='00'?`${parseInt(h)}h`:`${parseInt(h)}h${m}`; }
function fmtHoraFim(t) { if(!t) return ''; const [h,m]=t.split(':'); return `${parseInt(h)+1}h${m==='00'?'':m}`; }

const NOMES_DIA_CURTO=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const NOMES_DIA_LONGO=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const NOMES_MES_CAL  =['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function nivelClass(curso) {
    if (!curso) return 'avancado';
    if (curso.includes('Básico'))   return 'basico';
    if (curso.includes('Avançado')) return 'avancado';
    return 'particular';
}

function getEventosDoDia(date) {
    const dateStr=toDateStr(date), dow=date.getDay(), eventos=[];
    DB.alunos.filter(a=>a.status==='ativo').forEach(aluno=>{
        const dias=(aluno.diasSemana||[]).map(String);
        const remS=DB.remarcacoes.find(r=>r.alunoId===aluno.id&&r.dataOriginal===dateStr);
        const remC=DB.remarcacoes.find(r=>r.alunoId===aluno.id&&r.dataNova===dateStr);
        if (dias.includes(String(dow))&&!remS)
            eventos.push({alunoId:aluno.id,alunoNome:aluno.nome,curso:aluno.curso,horario:aluno.horario||'07:00',tipo:'fixo'});
        if (remC)
            eventos.push({alunoId:aluno.id,alunoNome:aluno.nome,curso:aluno.curso,horario:remC.novoHorario||aluno.horario||'07:00',tipo:'remarcada',remarcacaoId:remC.id,dataOriginal:remC.dataOriginal});
    });
    return eventos.sort((a,b)=>a.horario.localeCompare(b.horario));
}

function setCalView(v) { calViewAtual=v; document.getElementById('btn-view-semana').classList.toggle('active',v==='semana'); document.getElementById('btn-view-mes').classList.toggle('active',v==='mes'); renderCalendario(); }
function calNavegar(d) { if(calViewAtual==='semana') calDataRef.setDate(calDataRef.getDate()+d*7); else calDataRef.setMonth(calDataRef.getMonth()+d); renderCalendario(); }
function calHoje() { calDataRef=new Date(); calDiaSelecionado=toDateStr(new Date()); renderCalendario(); renderPresencaRapida(); }
function selecionarDiaCal(s) { calDiaSelecionado=s; renderCalendario(); renderPresencaRapida(); }
function loadMinhasAulas() { renderCalendario(); renderPresencaRapida(); }
function renderCalendario() { if(calViewAtual==='semana') renderSemana(); else renderMes(); }

function renderSemana() {
    const inicio=inicioSemana(calDataRef), hoje=toDateStr(new Date());
    const fim=new Date(inicio); fim.setDate(fim.getDate()+5);
    document.getElementById('cal-periodo-label').textContent=`${inicio.getDate()} ${NOMES_MES_CAL[inicio.getMonth()].substring(0,3)} – ${fim.getDate()} ${NOMES_MES_CAL[fim.getMonth()].substring(0,3)} ${fim.getFullYear()}`;
    let html='<div class="cal-semana-grid">';
    for(let i=0;i<6;i++){
        const dia=new Date(inicio); dia.setDate(dia.getDate()+i);
        const ds=toDateStr(dia), isH=ds===hoje, isS=ds===calDiaSelecionado&&!isH;
        const ev=getEventosDoDia(dia);
        html+=`<div class="cal-dia-col"><div class="cal-dia-header${isH?' hoje':''}${isS?' selecionado':''}" onclick="selecionarDiaCal('${ds}')" style="cursor:pointer;"><div class="dia-nome">${NOMES_DIA_CURTO[dia.getDay()]}</div><div class="dia-num">${dia.getDate()}</div></div>`;
        if(!ev.length){html+=`<div class="cal-dia-vazio">—</div>`;}
        else ev.forEach(e=>{
            const nv=nivelClass(e.curso),isR=e.tipo==='remarcada',aid=obterOuCriarAulaId(e,ds);
            html+=`<div class="cal-aula-card nivel-${nv}${isR?' remarcada-para-aqui':''}"><div class="cal-aula-nome">${e.alunoNome}</div><div class="cal-aula-hora">${fmtHora(e.horario)}–${fmtHoraFim(e.horario)}</div><span class="cal-aula-badge badge-${isR?'remarcada':nv}">${isR?'⬡ Remarcada':e.curso||'Aula'}</span><div class="cal-aula-actions"><button class="cal-btn-mini" onclick="abrirModalPresenca(${aid},${e.alunoId},'${e.alunoNome.replace(/'/g,"\\'")}')">✓ Presença</button>${!isR?`<button class="cal-btn-mini danger" onclick="abrirRemarcarModal(${e.alunoId},'${ds}','${e.alunoNome.replace(/'/g,"\\'")}','${e.horario}')">↷ Remarcar</button>`:''}</div></div>`;
        });
        html+=`</div>`;
    }
    html+='</div>';
    document.getElementById('cal-container').innerHTML=html;
}

function renderMes() {
    const ano=calDataRef.getFullYear(),mes=calDataRef.getMonth(),hoje=toDateStr(new Date());
    document.getElementById('cal-periodo-label').textContent=`${NOMES_MES_CAL[mes]} ${ano}`;
    const ig=inicioSemana(new Date(ano,mes,1));
    let fg=new Date(ano,mes+1,0); while(fg.getDay()!==0) fg.setDate(fg.getDate()+1);
    let html='<div class="cal-mes-grid">';
    ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].forEach(d=>html+=`<div class="cal-mes-header-dia">${d}</div>`);
    let c=new Date(ig);
    while(c<=fg){
        const ds=toDateStr(c),isH=ds===hoje,isS=ds===calDiaSelecionado,om=c.getMonth()!==mes,ev=getEventosDoDia(c);
        html+=`<div class="cal-mes-celula${om?' outro-mes':''}${isH?' hoje-mes':''}${isS?' selecionado-mes':''}" onclick="selecionarDiaCal('${ds}')" style="cursor:pointer;"><div class="cal-mes-num">${c.getDate()}</div>`;
        ev.forEach(e=>{ const nv=nivelClass(e.curso),isR=e.tipo==='remarcada'; html+=`<div class="cal-mes-aula-pill pill-${isR?'remarcada':nv}" title="${e.alunoNome} ${fmtHora(e.horario)}">${fmtHora(e.horario)} ${e.alunoNome.split(' ')[0]}</div>`; });
        html+=`</div>`; c.setDate(c.getDate()+1);
    }
    html+='</div>';
    document.getElementById('cal-container').innerHTML=html;
}

function renderPresencaRapida() {
    const ds=calDiaSelecionado||toDateStr(new Date()),dobj=fromDateStr(ds),ev=getEventosDoDia(dobj);
    document.getElementById('presenca-rapida-titulo').textContent=`${NOMES_DIA_LONGO[dobj.getDay()]}, ${dobj.getDate()} de ${NOMES_MES_CAL[dobj.getMonth()]} de ${dobj.getFullYear()}`;
    const lista=document.getElementById('presenca-rapida-lista');
    if(!ev.length){lista.innerHTML='<p style="color:var(--text-light,#888);font-size:14px;padding:12px 0;">Nenhuma aula neste dia.</p>';return;}
    lista.innerHTML=ev.map(e=>{
        const aid=obterOuCriarAulaId(e,ds);
        const p=DB.presencas.find(p=>p.aulaId===aid&&p.alunoId===e.alunoId);
        const sh=p?`<span class="presenca-status-badge badge-status-${p.status}">${p.status==='presente'?'✓ Presente':p.status==='falta'?'✕ Falta':'↷ Remarcada'}</span>`:'';
        return `<div class="presenca-rapida-card"><div class="presenca-rapida-info"><span class="presenca-rapida-nome">${e.alunoNome}</span><span class="presenca-rapida-detalhe">${e.curso||'Aula'} · ${fmtHora(e.horario)}–${fmtHoraFim(e.horario)}${e.tipo==='remarcada'?' · <strong style="color:#92400E">Aula remarcada</strong>':''}</span>${sh}</div><div class="presenca-rapida-acoes"><button class="btn-rapido presente" onclick="registrarPresencaRapida(${aid},${e.alunoId},'presente')">✓ Presente</button><button class="btn-rapido falta" onclick="abrirModalPresenca(${aid},${e.alunoId},'${e.alunoNome.replace(/'/g,"\\'")}')">✕ Falta / Avaliar</button><button class="btn-rapido remarcar" onclick="abrirRemarcarModal(${e.alunoId},'${ds}','${e.alunoNome.replace(/'/g,"\\'")}','${e.horario}')">↷ Remarcar</button></div></div>`;
    }).join('');
}

function obterOuCriarAulaId(ev,dateStr) {
    const titulo=`CAL-${ev.alunoId}-${dateStr}`;
    let aula=DB.aulas.find(a=>a.titulo===titulo);
    if(!aula){aula={id:Date.now()+Math.floor(Math.random()*9999),moduloId:null,titulo,descricao:`Aula — ${ev.alunoNome} em ${dateStr}`,dataAula:dateStr,duracao:60,_calGerada:true};DB.aulas.push(aula);saveDB();}
    return aula.id;
}

function registrarPresencaRapida(aulaId,alunoId,status){
    DB.presencas=DB.presencas.filter(p=>!(p.aulaId===aulaId&&p.alunoId===alunoId));
    DB.presencas.push({id:Date.now(),aulaId,alunoId,status,justificativa:null,nota:null,observacao:null,querRepor:false,dataRegistro:new Date().toISOString()});
    saveDB();renderPresencaRapida();loadDashboard();
}

function abrirRemarcarModal(alunoId,dataOriginal,alunoNome,horarioAtual){
    remarcacaoEmEdicao={alunoId,dataOriginal};
    const d=fromDateStr(dataOriginal);
    document.getElementById('remarcar-info').textContent=`Aula de ${alunoNome} — ${NOMES_DIA_LONGO[d.getDay()]}, ${dataOriginal.split('-').reverse().join('/')} às ${fmtHora(horarioAtual)}`;
    document.getElementById('remarcar-nova-data').value='';
    document.getElementById('remarcar-novo-horario').value=horarioAtual||'';
    document.getElementById('modal-remarcar').classList.add('active');
}
function closeRemarcarModal(){document.getElementById('modal-remarcar').classList.remove('active');remarcacaoEmEdicao=null;}

function salvarRemarcacao(event){
    event.preventDefault();if(!remarcacaoEmEdicao) return;
    const{alunoId,dataOriginal}=remarcacaoEmEdicao;
    DB.remarcacoes=DB.remarcacoes.filter(r=>!(r.alunoId===alunoId&&r.dataOriginal===dataOriginal));
    DB.remarcacoes.push({id:Date.now(),alunoId,dataOriginal,dataNova:document.getElementById('remarcar-nova-data').value,novoHorario:document.getElementById('remarcar-novo-horario').value,motivo:document.getElementById('remarcar-motivo').value,criadaEm:new Date().toISOString()});
    saveDB();closeRemarcarModal();renderCalendario();renderPresencaRapida();
}

(function(){
    const s=document.createElement('style');
    s.textContent=`.cal-dia-header.selecionado{background:#EDE9FE;border:2px solid var(--primary,#592581)}.cal-dia-header.selecionado .dia-nome,.cal-dia-header.selecionado .dia-num{color:var(--primary,#592581)}.cal-mes-celula.selecionado-mes{background:#EDE9FE;outline:2px solid var(--primary,#592581)}`;
    document.head.appendChild(s);
})();

// ============================================================
// EXPOR FUNÇÕES GLOBALMENTE
// Como script.js usa type="module", as funções ficam isoladas
// e o HTML não consegue chamar onclick="goToPage(...)" etc.
// A solução é atribuir cada função ao window explicitamente.
// ============================================================
window.goToPage                    = goToPage;
window.loadDashboard               = loadDashboard;
window.atualizarStatusPagamentos   = atualizarStatusPagamentos;

// Alunos
window.openAlunoModal              = openAlunoModal;
window.closeAlunoModal             = closeAlunoModal;
window.salvarAluno                 = salvarAluno;
window.editarAluno                 = editarAluno;
window.deletarAluno                = deletarAluno;
window.filterAlunos                = filterAlunos;

// Módulos
window.openModuloModal             = openModuloModal;
window.closeModuloModal            = closeModuloModal;
window.salvarModulo                = salvarModulo;
window.selecionarModulo            = selecionarModulo;
window.openAulaModal               = openAulaModal;
window.closeAulaModal              = closeAulaModal;
window.salvarAula                  = salvarAula;

// Presença
window.carregarAulasDoModulo       = carregarAulasDoModulo;
window.carregarPresencas           = carregarPresencas;
window.abrirModalPresenca          = abrirModalPresenca;
window.closePresencaModal          = closePresencaModal;
window.atualizarCamposPresenca     = atualizarCamposPresenca;
window.atualizarAvisoReposicao     = atualizarAvisoReposicao;
window.salvarPresencaComJustificativa = salvarPresencaComJustificativa;

// Financeiro
window.loadFinanceiro              = loadFinanceiro;
window.limparRegistrosAntigos      = limparRegistrosAntigos;
window.abrirModalPagamento         = abrirModalPagamento;
window.closeModalPagamento         = closeModalPagamento;
window.salvarPagamento             = salvarPagamento;

// Relatórios
window.toggleSection               = toggleSection;
window.exportarRelatorioPDF        = exportarRelatorioPDF;

// Calendário
window.setCalView                  = setCalView;
window.calNavegar                  = calNavegar;
window.calHoje                     = calHoje;
window.selecionarDiaCal            = selecionarDiaCal;
window.registrarPresencaRapida     = registrarPresencaRapida;
window.abrirRemarcarModal          = abrirRemarcarModal;
window.closeRemarcarModal          = closeRemarcarModal;
window.salvarRemarcacao            = salvarRemarcacao;
