document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Lógica da Seta de Rolagem
    const setaScroll = document.getElementById("seta-scroll");
    if (setaScroll) {
        setaScroll.addEventListener("click", () => {
            const secaoInfo = document.getElementById("secao-informacoes");
            if (secaoInfo) {
                secaoInfo.scrollIntoView({ behavior: "smooth" });
            }
        });
    }

    // 2. Lógica do botão "Entrar no Sistema"
    const btnEntrar = document.getElementById("btn-entrar");
    if (btnEntrar) {
        btnEntrar.addEventListener("click", () => {
            if (typeof irPara === 'function') {
                irPara('tela-login');
            } else {
                document.querySelectorAll('body > div').forEach(d => d.classList.add('hidden'));
                document.getElementById('tela-login').classList.remove('hidden');
            }
        });
    }

    // 3. Lógica do botão "Ver Planos"
    const btnPlanos = document.getElementById("btn-planos");
    if (btnPlanos) {
        btnPlanos.addEventListener("click", () => {
            if (typeof irPara === 'function') {
                irPara('tela-planos');
            } else {
                document.querySelectorAll('body > div').forEach(d => d.classList.add('hidden'));
                document.getElementById('tela-planos').classList.remove('hidden');
            }
        });
    }
// 4. Lógica do botão "Testar Grátis"
    const btnTestar = document.getElementById("btn-testar");
    if (btnTestar) {
        btnTestar.addEventListener("click", () => {
            if (typeof irPara === 'function') {
                irPara('tela-planos');
            } else {
                document.querySelectorAll('body > div').forEach(d => d.classList.add('hidden'));
                document.getElementById('tela-planos').classList.remove('hidden');
            }
        });
    }
});