// ================= Configurações =================
const LARGURA_BASE = 1280;
const ALTURA_BASE = 720;
const PASTA_TELAS = "assets/telas/";
const PASTA_FIGURAS = "assets/figuras/";

const ARQUIVOS_FIGURAS = [
    "nao (2).png","nao (3).png","nao (4).png","nao (5).png","nao (6).png",
    "nao (7).png","nao (8).png","nao (10).png","nao (12).png","nao (13).png",
    "nao (14).png","nao (15).png","nao (16).png","nao (17).png","nao (18).png",
    "nao (19).png","nao.png",
    
    // --- Imagens SUSTENTÁVEIS (Antigas) ---
    "sustentavel (1).png","sustentavel (2).png","sustentavel (3).png",
    "sustentavel (4).png","sustentavel (7).png","sustentavel (9).png",
    "sustentavel (11).png","sustentavel (13).png","sustentavel (15).png",
    "sustentavel (19).png",
    
    // --- Imagens SUSTENTÁVEIS (Novas da sua imagem) ---
    "sustentavel (23).png",
    "sustentavel (25).png",
    "sustentavel (27).png",
    "sustentavel (29).png",
    "sustentavel (31).png",
    "sustentavel (33).png",
    "sustentavel.png"
];

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.largura = LARGURA_BASE;
        this.altura = ALTURA_BASE;

        this.fonte = "bold 40px Arial";
        this.fonteGrande = "bold 80px Arial";
        this.fontePlacar = "bold 22px Arial";

        this.yInicioFaixa = Math.floor(this.altura * 0.87);
        this.yCentroFila = this.yInicioFaixa + Math.floor((this.altura - this.yInicioFaixa) / 2);
        this.xMeio = Math.floor(this.largura / 2);

        this.fatorMao = 0.25;
        this.fatorFila = 0.15;
        this.margemMeio = 0.04;
        this.distMinimaArrasto = 10;
        this.limiteFila = 5;

        this.imagens = {};
        this.mousePos = { x: 0, y: 0 };

        this.telaAtual = "inicial";

        // Escalas e offsets para transformar tela real <-> 1280x720
        this.escalaX = 1;
        this.escalaY = 1;

        this._bindEventos();
    }

    carregarImagem(src) {
        if (this.imagens[src]) return Promise.resolve(this.imagens[src]);
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => { this.imagens[src] = img; resolve(img); };
            img.onerror = () => {
                console.warn("[AVISO] Imagem não encontrada:", src);
                resolve(null);
            };
            img.src = src;
        });
    }

    classificarResposta(nome) {
        const n = nome.toLowerCase();
        const nNorm = n.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[-_\s]/g, "");
        if (nNorm.includes("naosustentavel") || nNorm.includes("nao")) return "nao_sustentavel";
        if (nNorm.includes("sustentavel")) return "sustentavel";
        return null;
    }

    async carregarTudo() {
        this.imgInicial = await this.carregarImagem(
            PASTA_TELAS + "JOGO_CIDADE_SUSTENTÁVEL_E_NÃO_SUSTENTÁVEL_TELA_INICIAL.png"
        );
        if (!this.imgInicial) {
            this.imgInicial = await this.carregarImagem(
                PASTA_TELAS + "JOGO_CIDADE_SUSTENTAVEL_E_NAO_SUSTENTAVEL_TELA_INICIAL.png"
            );
        }

        this.imgJogo = await this.carregarImagem(
            PASTA_TELAS + "JOGO_CIDADE_SUSTENTÁVEL_E_NÃO_SUSTENTÁVEL_MAIN.png"
        );
        if (!this.imgJogo) {
            this.imgJogo = await this.carregarImagem(
                PASTA_TELAS + "JOGO_CIDADE_SUSTENTAVEL_E_NAO_SUSTENTAVEL_MAIN.png"
            );
        }

        this.imgFim = await this.carregarImagem(PASTA_TELAS + "FIM_DE_JOGO.png");
        this.imgTutorial = await this.carregarImagem(PASTA_TELAS + "COMO_JOGAR.png");

        this.cenas = [];
        for (const nome of ARQUIVOS_FIGURAS) {
            const resp = this.classificarResposta(nome);
            if (!resp) continue;
            const img = await this.carregarImagem(PASTA_FIGURAS + nome);
            if (!img) continue;
            this.cenas.push({ img, resp, nome });
        }
    }

    _escalaImagem(img, fator) {
        const escala = Math.min(
            (this.largura * fator) / img.width,
            (this.altura * fator) / img.height
        );
        return { w: img.width * escala, h: img.height * escala };
    }

    iniciarJogo() {
        this.fila = [];
        this.proximas = [];
        this.colocadas = [];

        this.imagemMao = null;
        this.respMao = null;
        this.posMao = { x: this.largura / 2, y: this.altura / 2 };

        this.arrastando = false;
        this.posClickInicial = { x: 0, y: 0 };
        this.offset = { x: 0, y: 0 };

        this.finalizado = false;

        this._prepararFila();
    }

    _prepararFila() {
        const todas = this.cenas.map((cena) => ({
            img: cena.img,
            resp: cena.resp,
            rectFila: { x: 0, y: 0, w: 0, h: 0 },
        }));

        for (let i = todas.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [todas[i], todas[j]] = [todas[j], todas[i]];
        }

        this.fila = todas.slice(0, this.limiteFila);
        this.proximas = todas.slice(this.limiteFila);
        this._layoutFila();
    }

    _reabastecerFila() {
        while (this.fila.length < this.limiteFila && this.proximas.length > 0) {
            this.fila.push(this.proximas.shift());
        }
        this._layoutFila();
    }

    _layoutFila() {
        if (this.fila.length === 0) return;
        const n = this.fila.length;
        const espacamento = this.largura / (n + 1);
        this.fila.forEach((item, i) => {
            const cx = espacamento * (i + 1);
            const { w, h } = this._escalaImagem(item.img, this.fatorFila);
            item.rectFila = { x: cx - w / 2, y: this.yCentroFila - h / 2, w, h };
        });
    }

    _pontoNoRect(px, py, r) {
        return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
    }

    _rectMao() {
        if (!this.imagemMao) return { x: 0, y: 0, w: 0, h: 0 };
        const { w, h } = this._escalaImagem(this.imagemMao, this.fatorMao);
        return { x: this.posMao.x - w / 2, y: this.posMao.y - h / 2, w, h };
    }

    _pegarDaFila(px, py) {
        for (let i = 0; i < this.fila.length; i++) {
            if (this._pontoNoRect(px, py, this.fila[i].rectFila)) {
                const item = this.fila[i];
                this.imagemMao = item.img;
                this.respMao = item.resp;
                this.posMao = { x: px, y: py };
                this.fila.splice(i, 1);
                this._reabastecerFila();
                return true;
            }
        }
        return false;
    }

    _pegarColocada(px, py) {
        for (let i = this.colocadas.length - 1; i >= 0; i--) {
            const item = this.colocadas[i];
            const { w, h } = this._escalaImagem(item.img, this.fatorMao);
            const r = { x: item.pos.x - w / 2, y: item.pos.y - h / 2, w, h };
            if (this._pontoNoRect(px, py, r)) {
                this.colocadas.splice(i, 1);
                this.imagemMao = item.img;
                this.respMao = item.resp;
                this.posMao = { x: item.pos.x, y: item.pos.y };
                return true;
            }
        }
        return false;
    }

    _estaNoMeio() {
        return Math.abs(this.posMao.x - this.xMeio) < this.largura * this.margemMeio;
    }

    _devolverParaFila() {
        if (!this.imagemMao) return;
        const item = {
            img: this.imagemMao,
            resp: this.respMao,
            rectFila: { x: 0, y: 0, w: 0, h: 0 },
        };
        this.fila.unshift(item);
        if (this.fila.length > this.limiteFila) this.proximas.unshift(this.fila.pop());
        this._layoutFila();
        this.imagemMao = null;
        this.respMao = null;
    }

    _soltarImagem(movimentoTotal) {
        if (!this.imagemMao) return;
        if (movimentoTotal < this.distMinimaArrasto ||
            this.posMao.y > this.yInicioFaixa ||
            this._estaNoMeio()) {
            this._devolverParaFila();
            return;
        }
        this.colocadas.push({
            img: this.imagemMao,
            pos: { x: this.posMao.x, y: this.posMao.y },
            resp: this.respMao,
        });
        this.imagemMao = null;
        this.respMao = null;
        if (this.fila.length === 0 && this.proximas.length === 0) {
            this.finalizado = true;
            this.telaAtual = "fim";
        }
    }

    _calcularPlacar() {
        let acertos = 0;
        for (const item of this.colocadas) {
            const direita = item.pos.x > this.xMeio;
            const correta =
                (direita && item.resp === "nao_sustentavel") ||
                (!direita && item.resp === "sustentavel");
            if (correta) acertos++;
        }
        return acertos;
    }

    _rectBotaoJogar() {
        const w = Math.floor(this.largura * 0.24);
        const h = Math.floor(this.altura * 0.08);
        return { x: this.largura * 0.5 - w / 2, y: this.altura * 0.76 - h / 2, w, h };
    }
    _rectBotaoTutorial() {
        const w = Math.floor(this.largura * 0.12);
        const h = Math.floor(this.altura * 0.08);
        return { x: this.largura * 0.51 - w / 2, y: this.altura * 0.76 - h / 2, w, h };
    }
    _rectBotaoIniciar() {
        const w = Math.floor(this.largura * 0.14);
        const h = Math.floor(this.altura * 0.09);
        return { x: this.largura * 0.48 - w / 2, y: this.altura * 0.48 - h / 2, w, h };
    }

    _getMousePos(evt) {
        const r = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        // Posição do clique no espaço real do canvas (pixels internos)
        const xReal = (evt.clientX - r.left) * dpr;
        const yReal = (evt.clientY - r.top) * dpr;

        // Converte para o espaço de jogo (1280x720) usando escala X e Y separadas
        return {
            x: xReal / this.escalaX,
            y: yReal / this.escalaY,
        };
    }

    _bindEventos() {
        const down = (pos) => this._onMouseDown(pos);
        const up   = (pos) => this._onMouseUp(pos);

        this.canvas.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return;
            down(this._getMousePos(e));
        });
        this.canvas.addEventListener("mouseup", (e) => {
            if (e.button !== 0) return;
            up(this._getMousePos(e));
        });
        this.canvas.addEventListener("mousemove", (e) => {
            this.mousePos = this._getMousePos(e);
            if (this.arrastando && this.imagemMao) {
                this.posMao = {
                    x: this.mousePos.x + this.offset.x,
                    y: this.mousePos.y + this.offset.y,
                };
            }
        });

        this.canvas.addEventListener("touchstart", (e) => {
            e.preventDefault();
            down(this._getMousePos(e.touches[0]));
        }, { passive: false });
        this.canvas.addEventListener("touchmove", (e) => {
            e.preventDefault();
            this.mousePos = this._getMousePos(e.touches[0]);
            if (this.arrastando && this.imagemMao) {
                this.posMao = {
                    x: this.mousePos.x + this.offset.x,
                    y: this.mousePos.y + this.offset.y,
                };
            }
        }, { passive: false });
        this.canvas.addEventListener("touchend", (e) => {
            e.preventDefault();
            if (this.arrastando) up(this.mousePos);
        }, { passive: false });
    }

    _onMouseDown(pos) {
        if (this.telaAtual === "inicial") {
            if (this._pontoNoRect(pos.x, pos.y, this._rectBotaoIniciar())) {
                this.telaAtual = "tutorial";
            }
            return;
        }

        if (this.telaAtual === "tutorial") {
            if (this._pontoNoRect(pos.x, pos.y, this._rectBotaoTutorial())) {
                this.telaAtual = "jogo";
            }
            return;
        }

        if (this.telaAtual === "fim") {
            if (this._pontoNoRect(pos.x, pos.y, this._rectBotaoJogar())) {
                this.iniciarJogo();
                this.telaAtual = "jogo";
            }
            return;
        }

        let pegou = false;
        if (this._pegarColocada(pos.x, pos.y)) pegou = true;
        else if (this._pegarDaFila(pos.x, pos.y)) pegou = true;
        else if (this._pontoNoRect(pos.x, pos.y, this._rectMao())) pegou = true;

        if (pegou) {
            this.arrastando = true;
            this.posClickInicial = pos;
            this.offset = { x: this.posMao.x - pos.x, y: this.posMao.y - pos.y };
            this.canvas.classList.add("dragging");
        }
    }

    _onMouseUp(pos) {
        if (!this.arrastando) return;
        this.arrastando = false;
        this.canvas.classList.remove("dragging");
        const dx = pos.x - this.posClickInicial.x;
        const dy = pos.y - this.posClickInicial.y;
        this._soltarImagem(Math.sqrt(dx * dx + dy * dy));
    }

    _desenharImgEscalada(img, cx, cy, fator) {
        const { w, h } = this._escalaImagem(img, fator);
        this.ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    }

    _desenharColocadas() {
        for (const item of this.colocadas) {
            this._desenharImgEscalada(item.img, item.pos.x, item.pos.y, this.fatorMao);
        }
    }

    _desenharFila() {
        for (const item of this.fila) {
            const { w, h } = this._escalaImagem(item.img, this.fatorFila);
            const cx = item.rectFila.x + w / 2;
            const cy = item.rectFila.y + h / 2;
            this.ctx.drawImage(item.img, cx - w / 2, cy - h / 2, w, h);
        }
    }

    _desenharMao() {
        if (!this.imagemMao) return;
        this._desenharImgEscalada(this.imagemMao, this.posMao.x, this.posMao.y, this.fatorMao);
    }

    _desenharFinal() {
        if (this.imgFim) {
            this.ctx.drawImage(this.imgFim, 0, 0, this.largura, this.altura);
            const acertos = this._calcularPlacar();
            const total = this.colocadas.length;
            this.ctx.font = this.fontePlacar;
            this.ctx.fillStyle = "rgb(40, 100, 40)";
            this.ctx.textAlign = "center";
            const rectBotao = this._rectBotaoJogar();
            this.ctx.fillText(
                `Você acertou ${acertos} de ${total}!`,
                this.largura / 2,
                rectBotao.y - 15
            );
        } else {
            this.ctx.fillStyle = "rgba(0, 0, 0, 0.67)";
            this.ctx.fillRect(0, 0, this.largura, this.altura);
            const acertos = this._calcularPlacar();
            this.ctx.textAlign = "center";
            this.ctx.font = this.fonteGrande;
            this.ctx.fillStyle = "white";
            this.ctx.fillText("FIM DE JOGO!", this.largura / 2, this.altura / 2 - 120);
            this.ctx.font = this.fonte;
            this.ctx.fillStyle = "rgb(200, 255, 200)";
            this.ctx.fillText(
                `Você acertou ${acertos} de ${this.colocadas.length}`,
                this.largura / 2,
                this.altura / 2
            );
        }
    }

    _desenharTutorial() {
        if (this.imgTutorial) {
            this.ctx.drawImage(this.imgTutorial, 0, 0, this.largura, this.altura);
        } else {
            this.ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
            this.ctx.fillRect(0, 0, this.largura, this.altura);
            this.ctx.textAlign = "center";
            this.ctx.font = this.fonteGrande;
            this.ctx.fillStyle = "white";
            this.ctx.fillText(
                "COMO JOGAR (Imagem não encontrada)",
                this.largura / 2,
                this.altura / 2
            );
        }
    }

    _desenharInicial() {
        if (this.imgInicial) {
            this.ctx.drawImage(this.imgInicial, 0, 0, this.largura, this.altura);
        } else {
            this.ctx.fillStyle = "#1a4a1a";
            this.ctx.fillRect(0, 0, this.largura, this.altura);
            this.ctx.textAlign = "center";
            this.ctx.font = this.fonteGrande;
            this.ctx.fillStyle = "white";
            this.ctx.fillText(
                "SUSTENTÁVEL E NÃO SUSTENTÁVEL",
                this.largura / 2,
                this.altura / 2 - 80
            );
            this.ctx.font = this.fonte;
            this.ctx.fillText(
                "(Imagem inicial não encontrada — clique para jogar)",
                this.largura / 2,
                this.altura / 2 + 20
            );
        }
    }

    desenhar() {
        if (this.telaAtual === "inicial") {
            this._desenharInicial();
            return;
        }

        if (this.imgJogo) {
            this.ctx.drawImage(this.imgJogo, 0, 0, this.largura, this.altura);
        } else {
            this.ctx.fillStyle = "#2a4a2a";
            this.ctx.fillRect(0, 0, this.largura, this.altura);
        }

        if (this.telaAtual === "jogo") {
            this._desenharColocadas();
            this._desenharFila();
            this._desenharMao();
        } else if (this.telaAtual === "tutorial") {
            this._desenharTutorial();
        } else if (this.telaAtual === "fim") {
            this._desenharFinal();
        }
    }

    async iniciar() {
        await this.carregarTudo();
        this.iniciarJogo();
        this.telaAtual = "inicial";

        const loop = () => {
            this.desenhar();
            requestAnimationFrame(loop);
        };
        loop();
    }
}

// ================= Bootstrap =================
window.addEventListener("load", async () => {
    const canvas = document.getElementById("game-canvas");
    const game = new Game(canvas);

    // Sobrescreve o desenhar para ESTICAR a imagem para a tela toda
    game.desenhar = () => {
        const dpr = window.devicePixelRatio || 1;
        const cssW = canvas.clientWidth;
        const cssH = canvas.clientHeight;

        // Redimensiona a resolução interna do canvas
        if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
            canvas.width = Math.round(cssW * dpr);
            canvas.height = Math.round(cssH * dpr);
        }

        const ctx = game.ctx;

        // Escalas X e Y separadas = ESTICAR (ignora proporção)
        game.escalaX = canvas.width / LARGURA_BASE;
        game.escalaY = canvas.height / ALTURA_BASE;

        // Limpa tela
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.scale(game.escalaX, game.escalaY);

        // Desenha o jogo (coordenadas 1280x720 esticadas para a tela toda)
        Game.prototype.desenhar.call(game);

        ctx.restore();
    };

    await game.iniciar();
});