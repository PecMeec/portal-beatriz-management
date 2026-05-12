// ============================================================
// firebase-config.js — versão popup (compatível com Chrome)
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getAuth, GoogleAuthProvider,
    signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
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

const EMAIL_AUTORIZADO = "ph6467788@gmail.com";

window.db   = db;
window.auth = auth;

window.DB = {
    alunos: [], modulos: [], aulas: [],
    presencas: [], pagamentos: [], avaliacoes: [], remarcacoes: []
};

let sistemaIniciado = false;

// ============================================================
// TELAS
// ============================================================
function mostrarCarregando(visivel) {
    let el = document.getElementById('tela-loading');
    if (!el) {
        el = document.createElement('div');
        el.id = 'tela-loading';
        el.style.cssText = `
            position:fixed;inset:0;z-index:9999;
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            background:linear-gradient(135deg,#592581 0%,#3a1854 100%);
            font-family:sans-serif;color:white;gap:16px;`;
        el.innerHTML = `
            <div style="font-size:40px;">✨</div>
            <p style="font-size:16px;font-weight:500;margin:0;">Carregando...</p>
            <div style="width:36px;height:36px;border:3px solid rgba(255,255,255,0.3);
                        border-top-color:white;border-radius:50%;
                        animation:spin 0.8s linear infinite;"></div>
            <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
        document.body.appendChild(el);
    }
    el.style.display = visivel ? 'flex' : 'none';
}

function mostrarTelaLogin(mensagem = '') {
    mostrarCarregando(false);
    document.getElementById('app').style.display = 'none';

    let tela = document.getElementById('tela-login');
    if (!tela) {
        tela = document.createElement('div');
        tela.id = 'tela-login';
        tela.style.cssText = `
            position:fixed;inset:0;z-index:9998;
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            background:linear-gradient(135deg,#592581 0%,#3a1854 100%);
            font-family:sans-serif;`;
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
    document.getElementById('login-msg').textContent = mensagem;

    // ── IMPORTANTE: signInWithPopup chamado DIRETAMENTE no onclick ──
    // Sem await, sem async antes — o Chrome exige que o popup
    // seja aberto na mesma "call stack" do clique do usuário
    document.getElementById('btn-google-login').onclick = () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        signInWithPopup(auth, provider)
            .then(result => {
                // Login feito — onAuthStateChanged vai cuidar do resto
                console.log('Login OK:', result.user.email);
            })
            .catch(e => {
                console.error('Erro popup:', e.code, e.message);
                let msg = 'Erro ao fazer login. Tente novamente.';
                if (e.code === 'auth/popup-blocked')
                    msg = '⚠️ Popup bloqueado! Clique no ícone 🔒 na barra de endereço e permita popups para este site.';
                else if (e.code === 'auth/popup-closed-by-user')
                    msg = 'Login cancelado. Tente novamente.';
                else if (e.code === 'auth/unauthorized-domain')
                    msg = '⚠️ Domínio não autorizado no Firebase.';
                document.getElementById('login-msg').textContent = msg;
            });
    };
}

function esconderTelaLogin() {
    const tela = document.getElementById('tela-login');
    if (tela) tela.style.display = 'none';
    mostrarCarregando(false);
    document.getElementById('app').style.display = 'flex';
}

// ============================================================
// DADOS
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
        console.error("Erro Firestore:", e);
        return false;
    }
}

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

async function iniciarSistema(user) {
    if (sistemaIniciado) return;
    sistemaIniciado = true;
    mostrarCarregando(true);
    const ok = await carregarDadosFirestore(user.uid);
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
// CONTROLE DE AUTENTICAÇÃO
// ============================================================

// Mostra carregando enquanto verifica se já tem sessão
mostrarCarregando(true);

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        sistemaIniciado = false;
        mostrarTelaLogin();
        return;
    }

    if (user.email !== EMAIL_AUTORIZADO) {
        await signOut(auth);
        mostrarTelaLogin('⛔ Acesso não autorizado para este e-mail.');
        return;
    }

    await iniciarSistema(user);
});
