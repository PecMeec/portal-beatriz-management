// ============================================================
// firebase-config.js — versão com redirect corrigido
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getAuth, GoogleAuthProvider,
    signInWithRedirect, getRedirectResult,
    onAuthStateChanged, signOut, setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Configuração do Firebase ──────────────────────────────────
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

// ── E-mail autorizado ─────────────────────────────────────────
const EMAIL_AUTORIZADO = "ph6467788@gmail.com";

window.db   = db;
window.auth = auth;

// ── DB inicial vazio ──────────────────────────────────────────
window.DB = {
    alunos: [], modulos: [], aulas: [],
    presencas: [], pagamentos: [], avaliacoes: [], remarcacoes: []
};

// ── Flag para evitar inicializar o sistema duas vezes ─────────
let sistemaIniciado = false;

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
                        text-align:center;max-width:360px;width:90%;
                        box-shadow:0 20px 60px rgba(0,0,0,0.3);">
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

    // Botão de login — só ativa depois que tela aparece
    const btnLogin = document.getElementById('btn-google-login');
    btnLogin.onclick = async () => {
        btnLogin.disabled = true;
        btnLogin.textContent = 'Redirecionando...';
        try {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            // Garante que a sessão persiste no navegador antes do redirect
            await setPersistence(auth, browserLocalPersistence);
            await signInWithRedirect(auth, provider);
        } catch (e) {
            console.error('Erro login:', e);
            btnLogin.disabled = false;
            btnLogin.innerHTML = `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" height="20" alt="Google"> Entrar com Google`;
            document.getElementById('login-msg').textContent = 'Erro ao iniciar login. Tente novamente.';
        }
    };
}

function mostrarCarregando() {
    document.getElementById('app').style.display = 'none';
    let loading = document.getElementById('tela-loading');
    if (!loading) {
        loading = document.createElement('div');
        loading.id = 'tela-loading';
        loading.style.cssText = `
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            min-height:100vh;background:linear-gradient(135deg,#592581 0%,#3a1854 100%);
            font-family:sans-serif;color:white;gap:16px;
        `;
        loading.innerHTML = `
            <div style="font-size:40px;">✨</div>
            <p style="font-size:16px;font-weight:500;">Carregando...</p>
            <div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.3);
                        border-top-color:white;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
            <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
        document.body.appendChild(loading);
    }
    loading.style.display = 'flex';
}

function esconderCarregando() {
    const el = document.getElementById('tela-loading');
    if (el) el.style.display = 'none';
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
            const d = snap.data();
            window.DB.alunos      = d.alunos      || [];
            window.DB.modulos     = d.modulos     || [];
            window.DB.aulas       = d.aulas       || [];
            window.DB.presencas   = d.presencas   || [];
            window.DB.pagamentos  = d.pagamentos  || [];
            window.DB.avaliacoes  = d.avaliacoes  || [];
            window.DB.remarcacoes = d.remarcacoes || [];
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
// INICIAR SISTEMA após login confirmado
// ============================================================
async function iniciarSistema(user) {
    if (sistemaIniciado) return;
    sistemaIniciado = true;

    mostrarCarregando();

    const ok = await carregarDadosFirestore(user.uid);
    esconderCarregando();

    if (ok) {
        esconderTelaLogin();
        adicionarBotaoLogout();
        if (typeof atualizarStatusPagamentos === 'function') atualizarStatusPagamentos();
        if (typeof loadDashboard === 'function') loadDashboard();
    } else {
        sistemaIniciado = false;
        mostrarTelaLogin('Erro ao carregar dados. Tente novamente.');
    }
}

// ============================================================
// FLUXO PRINCIPAL
// A lógica correta com redirect:
// 1. Mostrar "carregando" enquanto verifica redirect
// 2. Se veio do redirect do Google → processar login
// 3. Se já tinha sessão ativa → iniciar direto
// 4. Se não tem sessão → mostrar tela de login
// ============================================================
mostrarCarregando();

// Aguarda o resultado do redirect — isso resolve o loop
getRedirectResult(auth)
    .then(result => {
        // result !== null significa que acabou de voltar do Google
        if (result && result.user) {
            const user = result.user;
            if (user.email !== EMAIL_AUTORIZADO) {
                signOut(auth);
                esconderCarregando();
                mostrarTelaLogin('⛔ Acesso não autorizado para este e-mail.');
                return;
            }
            iniciarSistema(user);
        } else {
            // Não veio de redirect — verifica sessão existente via onAuthStateChanged
            esconderCarregando();
        }
    })
    .catch(e => {
        console.error('Redirect error:', e);
        esconderCarregando();
        mostrarTelaLogin('Erro no login. Tente novamente.');
    });

// Cuida de: sessão já existente (abriu o app sem precisar fazer login)
// e de: logout (volta para tela de login)
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // Só mostra login se o sistema não foi iniciado
        // (evita piscar login durante o redirect)
        if (!sistemaIniciado) {
            esconderCarregando();
            mostrarTelaLogin();
        }
        sistemaIniciado = false;
        return;
    }

    if (user.email !== EMAIL_AUTORIZADO) {
        await signOut(auth);
        mostrarTelaLogin('⛔ Acesso não autorizado para este e-mail.');
        return;
    }

    // Sessão ativa existente (reload da página, abrir novamente)
    iniciarSistema(user);
});
