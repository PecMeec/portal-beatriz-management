// ============================================================
// firebase-config.js
// RESPONSABILIDADE: conectar ao Firebase e gerenciar o login
//
// ANTES: não existia — dados ficavam no localStorage do navegador
// DEPOIS: este arquivo inicializa a conexão com a nuvem do Google
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Suas chaves do Firebase (identificam o projeto) ──────────
const firebaseConfig = {
    apiKey:            "AIzaSyBCClMpF75CyQcwYnGoLC6Z2hXJ2tDuZxQ",
    authDomain:        "beatriz-menagement.firebaseapp.com",
    projectId:         "beatriz-menagement",
    storageBucket:     "beatriz-menagement.firebasestorage.app",
    messagingSenderId: "639254863075",
    appId:             "1:639254863075:web:1d45b41adddbd175a779d6"
};

// ── Inicializa o Firebase ─────────────────────────────────────
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// E-mail autorizado — SOMENTE este e-mail acessa os dados
const EMAIL_AUTORIZADO = "beatriz.bppereira.nascimento@gmail.com";
const EMAIL_AUTORIZADO = "ph6467788@gmail.com"

// ── Exporta para o script.js usar ────────────────────────────
window.db   = db;
window.auth = auth;

// ============================================================
// TELA DE LOGIN
// Aparece enquanto o usuário não está autenticado
// ============================================================
function mostrarTelaLogin(mensagem = '') {
    document.getElementById('app').style.display = 'none';

    let tela = document.getElementById('tela-login');
    if (!tela) {
        tela = document.createElement('div');
        tela.id = 'tela-login';
        tela.style.cssText = `
            display: flex; flex-direction: column; align-items: center;
            justify-content: center; min-height: 100vh;
            background: linear-gradient(135deg, #592581 0%, #3a1854 100%);
            font-family: sans-serif;
        `;
        tela.innerHTML = `
            <div style="background:white; border-radius:20px; padding:48px 40px;
                        text-align:center; max-width:360px; width:90%; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="font-size:48px; margin-bottom:12px;">✨</div>
                <h1 style="color:#592581; font-size:22px; margin:0 0 6px;">Beatriz Management</h1>
                <p style="color:#888; font-size:14px; margin:0 0 32px;">Portal de Gestão de Alunos</p>
                <p id="login-msg" style="color:#EF4444; font-size:13px; margin-bottom:16px; min-height:20px;"></p>
                <button id="btn-google-login" style="
                    display:flex; align-items:center; gap:12px; justify-content:center;
                    width:100%; padding:14px 20px; border-radius:12px;
                    border: 1.5px solid #e5e7eb; background:white; cursor:pointer;
                    font-size:15px; font-weight:500; color:#333;
                    transition: box-shadow 0.2s;">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                         width="20" height="20" alt="Google">
                    Entrar com Google
                </button>
                <p style="color:#ccc; font-size:11px; margin-top:24px;">
                    Acesso restrito · Apenas conta autorizada
                </p>
            </div>
        `;
        document.body.appendChild(tela);
    }

    tela.style.display = 'flex';
    if (mensagem) document.getElementById('login-msg').textContent = mensagem;

    document.getElementById('btn-google-login').onclick = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (e) {
            document.getElementById('login-msg').textContent = 'Erro ao fazer login. Tente novamente.';
        }
    };
}

function esconderTelaLogin() {
    const tela = document.getElementById('tela-login');
    if (tela) tela.style.display = 'none';
    document.getElementById('app').style.display = 'flex';
}

// ============================================================
// CARREGAR DADOS DO FIRESTORE
//
// ANTES (localStorage):
//   DB.alunos = JSON.parse(localStorage.getItem('alunos')) || []
//
// DEPOIS (Firestore):
//   Os dados ficam num documento único "dados/beatriz" na nuvem.
//   A estrutura interna (DB.alunos, DB.pagamentos etc.) é idêntica —
//   só muda de onde vem.
// ============================================================
async function carregarDadosFirestore(uid) {
    try {
        // "dados/beatriz" é o caminho no banco — como uma pasta/arquivo
        const ref  = doc(db, "dados", uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
            // Documento existe → preenche o DB com os dados da nuvem
            const dados = snap.data();
            window.DB.alunos      = dados.alunos      || [];
            window.DB.modulos     = dados.modulos     || [];
            window.DB.aulas       = dados.aulas       || [];
            window.DB.presencas   = dados.presencas   || [];
            window.DB.pagamentos  = dados.pagamentos  || [];
            window.DB.avaliacoes  = dados.avaliacoes  || [];
            window.DB.remarcacoes = dados.remarcacoes || [];
        } else {
            // Primeiro acesso — cria documento vazio na nuvem
            await setDoc(ref, {
                alunos: [], modulos: [], aulas: [],
                presencas: [], pagamentos: [], avaliacoes: [], remarcacoes: []
            });
        }
        return true;
    } catch (e) {
        console.error("Erro ao carregar dados:", e);
        return false;
    }
}

// ============================================================
// SALVAR DADOS NO FIRESTORE
//
// ANTES (localStorage):
//   localStorage.setItem('alunos', JSON.stringify(DB.alunos))
//   ... (uma linha por coleção)
//
// DEPOIS (Firestore):
//   Tudo num único documento. Uma só chamada salva tudo.
//   Esse documento fica na nuvem — celular e computador leem o mesmo.
// ============================================================
window.saveDB = async function () {
    const user = auth.currentUser;
    if (!user) return;

    const ref = doc(db, "dados", user.uid);
    await setDoc(ref, {
        alunos:      window.DB.alunos,
        modulos:     window.DB.modulos,
        aulas:       window.DB.aulas,
        presencas:   window.DB.presencas,
        pagamentos:  window.DB.pagamentos,
        avaliacoes:  window.DB.avaliacoes,
        remarcacoes: window.DB.remarcacoes,
    });
};

// ============================================================
// BOTÃO DE SAIR
// Adiciona botão de logout na sidebar
// ============================================================
function adicionarBotaoLogout(nomeUsuario) {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav || document.getElementById('btn-logout')) return;

    const btn = document.createElement('button');
    btn.id = 'btn-logout';
    btn.className = 'nav-btn';
    btn.style.cssText = 'margin-top:auto; color:#EF4444; border-top: 1px solid rgba(255,255,255,0.1); margin-top:20px;';
    btn.innerHTML = `🚪 Sair`;
    btn.onclick = () => {
        if (confirm('Deseja sair do sistema?')) signOut(auth);
    };
    nav.appendChild(btn);
}

// ============================================================
// CONTROLE DE AUTENTICAÇÃO
// Esta função roda toda vez que o estado de login muda —
// seja ao entrar, sair, ou recarregar a página.
// ============================================================
window.DB = {
    alunos: [], modulos: [], aulas: [],
    presencas: [], pagamentos: [], avaliacoes: [], remarcacoes: []
};

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // Sem usuário → mostra tela de login
        mostrarTelaLogin();
        return;
    }

    // Usuário logado → verifica se é a Beatriz
    if (user.email !== EMAIL_AUTORIZADO) {
        await signOut(auth);
        mostrarTelaLogin('⛔ Acesso não autorizado para este e-mail.');
        return;
    }

    // É a Beatriz! → carrega dados e abre o sistema
    esconderTelaLogin();
    const ok = await carregarDadosFirestore(user.uid);

    if (ok) {
        adicionarBotaoLogout(user.displayName);
        // Dispara o carregamento inicial do sistema
        if (typeof loadDashboard === 'function') {
            atualizarStatusPagamentos();
            loadDashboard();
        }
    }
});
