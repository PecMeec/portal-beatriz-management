// ============================================================
// firebase-config.js — VERSÃO CORRIGIDA
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey:            "AIzaSyBCClMpF75CyQcwYnGoLC6Z2hXJ2tDuZxQ",
    authDomain:        "beatriz-menagement.firebaseapp.com",
    projectId:         "beatriz-menagement",
    storageBucket:     "beatriz-menagement.firebasestorage.app",
    messagingSenderId: "639254863075",
    appId:             "1:639254863075:web:1d45b41adddbd175a779d6"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── APENAS UM e-mail autorizado ───────────────────────────────
// Troque pelo e-mail dela quando for passar pra ela
// Por enquanto pode ser o seu para testar
const EMAIL_AUTORIZADO = "ph6467788@gmail.com";

window.db   = db;
window.auth = auth;

// ── DB inicial vazio — será preenchido pelo Firestore ─────────
window.DB = {
    alunos: [], modulos: [], aulas: [],
    presencas: [], pagamentos: [], avaliacoes: [], remarcacoes: []
};

// ============================================================
// TELA DE LOGIN
// ============================================================
function mostrarTelaLogin(mensagem = '') {
    document.getElementById('app').style.display = 'none';

    let tela = document.getElementById('tela-login');
    if (!tela) {
        tela = document.createElement('div');
        tela.id = 'tela-login';
        tela.style.cssText = `
            display:flex; flex-direction:column; align-items:center;
            justify-content:center; min-height:100vh;
            background:linear-gradient(135deg,#592581 0%,#3a1854 100%);
            font-family:sans-serif;
        `;
        tela.innerHTML = `
            <div style="background:white;border-radius:20px;padding:48px 40px;
                        text-align:center;max-width:360px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="font-size:48px;margin-bottom:12px;">✨</div>
                <h1 style="color:#592581;font-size:22px;margin:0 0 6px;">Beatriz Management</h1>
                <p style="color:#888;font-size:14px;margin:0 0 32px;">Portal de Gestão de Alunos</p>
                <p id="login-msg" style="color:#EF4444;font-size:13px;margin-bottom:16px;min-height:20px;"></p>
                <button id="btn-google-login" style="
                    display:flex;align-items:center;gap:12px;justify-content:center;
                    width:100%;padding:14px 20px;border-radius:12px;
                    border:1.5px solid #e5e7eb;background:white;cursor:pointer;
                    font-size:15px;font-weight:500;color:#333;">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                         width="20" height="20" alt="Google">
                    Entrar com Google
                </button>
                <p style="color:#ccc;font-size:11px;margin-top:24px;">
                    Acesso restrito · Apenas conta autorizada
                </p>
            </div>`;
        document.body.appendChild(tela);
    }

    tela.style.display = 'flex';
    if (mensagem) document.getElementById('login-msg').textContent = mensagem;

    document.getElementById('btn-google-login').onclick = async () => {
        try {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            // Redirect: vai para o Google e volta — funciona em todos os browsers
            await signInWithRedirect(auth, provider);
        } catch (e) {
            console.error('Erro login:', e);
            document.getElementById('login-msg').textContent = 'Erro ao iniciar login. Tente novamente.';
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
// ============================================================
async function carregarDadosFirestore(uid) {
    try {
        const ref  = doc(db, "dados", uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
            const dados = snap.data();
            window.DB.alunos      = dados.alunos      || [];
            window.DB.modulos     = dados.modulos     || [];
            window.DB.aulas       = dados.aulas       || [];
            window.DB.presencas   = dados.presencas   || [];
            window.DB.pagamentos  = dados.pagamentos  || [];
            window.DB.avaliacoes  = dados.avaliacoes  || [];
            window.DB.remarcacoes = dados.remarcacoes || [];
        } else {
            await setDoc(ref, {
                alunos:[], modulos:[], aulas:[],
                presencas:[], pagamentos:[], avaliacoes:[], remarcacoes:[]
            });
        }
        return true;
    } catch (e) {
        console.error("Erro ao carregar dados:", e);
        return false;
    }
}

// ============================================================
// SALVAR NO FIRESTORE
// ============================================================
window.saveDB = async function () {
    const user = auth.currentUser;
    if (!user) return;
    try {
        await setDoc(doc(db, "dados", user.uid), {
            alunos:      window.DB.alunos,
            modulos:     window.DB.modulos,
            aulas:       window.DB.aulas,
            presencas:   window.DB.presencas,
            pagamentos:  window.DB.pagamentos,
            avaliacoes:  window.DB.avaliacoes,
            remarcacoes: window.DB.remarcacoes,
        });
    } catch (e) {
        console.error("Erro ao salvar:", e);
    }
};

// ============================================================
// BOTÃO DE SAIR
// ============================================================
function adicionarBotaoLogout() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav || document.getElementById('btn-logout')) return;
    const btn = document.createElement('button');
    btn.id        = 'btn-logout';
    btn.className = 'nav-btn';
    btn.style.cssText = 'color:#EF4444;border-top:1px solid rgba(255,255,255,0.1);margin-top:20px;';
    btn.innerHTML = '🚪 Sair';
    btn.onclick   = () => { if (confirm('Deseja sair?')) signOut(auth); };
    nav.appendChild(btn);
}

// ============================================================
// CONTROLE DE AUTENTICAÇÃO
// Roda toda vez que o estado muda: login, logout, reload da página
// O getRedirectResult captura o resultado quando o Google redireciona de volta
// ============================================================

// Primeiro: tenta pegar resultado de um redirect anterior
getRedirectResult(auth).catch(e => console.error('Redirect error:', e));

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        mostrarTelaLogin();
        return;
    }

    if (user.email !== EMAIL_AUTORIZADO) {
        await signOut(auth);
        mostrarTelaLogin('⛔ Acesso não autorizado para este e-mail.');
        return;
    }

    esconderTelaLogin();
    const ok = await carregarDadosFirestore(user.uid);

    if (ok) {
        adicionarBotaoLogout();
        // Inicia o sistema após dados carregados
        if (typeof atualizarStatusPagamentos === 'function') atualizarStatusPagamentos();
        if (typeof loadDashboard === 'function') loadDashboard();
    }
});
