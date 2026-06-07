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
    // Lógica do Accordion FAQ
document.querySelectorAll('.faq-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const content = btn.nextElementSibling;
        const icon = btn.querySelector('i');
        
        // Alterna a altura para exibir ou ocultar
        if (content.style.maxHeight) {
            content.style.maxHeight = null;
            icon.style.transform = 'rotate(0deg)';
        } else {
            content.style.maxHeight = content.scrollHeight + "px";
            icon.style.transform = 'rotate(180deg)';
        }
    });
});
});

function iniciarRotacaoImagens() {
    const imgElement = document.getElementById('img-sistema-exibicao');
    
    // Verificação de erro: se não achar a imagem, avisa no console
    if (!imgElement) {
        console.error("ERRO: Elemento 'img-sistema-exibicao' não encontrado no HTML!");
        return;
    }

    const imagens = [
        'assets/visao_de_negocio.png',
        'assets/recursos_humanos.png',
        'assets/estoque.png'
    ];

    let indice = 0;
    console.log("Iniciando rotação de imagens...");

    setInterval(() => {
        // Adiciona classe para sumir
        imgElement.classList.add('fade-out');

        setTimeout(() => {
            indice = (indice + 1) % imagens.length;
            imgElement.src = imagens[indice];
            console.log("Imagem atualizada para:", imagens[indice]);
            
            // Remove a classe para aparecer
            imgElement.classList.remove('fade-out');
        }, 500); // Deve ser igual ao tempo do CSS (0.5s)
    }, 3000);
}

// Garante que o script rode após carregar tudo
document.addEventListener('DOMContentLoaded', iniciarRotacaoImagens);