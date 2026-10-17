import {
    ref,
    get,
    update,
    remove,
    onValue
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import { db, auth } from "./firebase.js";
import { CONFIG } from "./config.js";

import {
    descobrirCliente
} from "./cliente.js";


// =========================================================
// CAMINHO DO CLIENTE
// =========================================================

let CAMINHO_BARBEIRO = null;
let CONFIG_CLIENTE = null;


// =========================================================
// ELEMENTOS
// =========================================================

const dataPainel =
    document.getElementById("dataPainel");

const atualizar =
    document.getElementById("atualizar");

const totalAgendados =
    document.getElementById("totalAgendados");

const totalDisponiveis =
    document.getElementById("totalDisponiveis");

const totalOcupados =
    document.getElementById("totalOcupados");

const listaAgendamentos =
    document.getElementById("listaAgendamentos");

const listaHorarios =
    document.getElementById("listaHorarios");

const novoHorario =
    document.getElementById("novoHorario");

const adicionarHorario =
    document.getElementById("adicionarHorario");

const mensagem =
    document.getElementById("mensagem");

const sair =
    document.getElementById("sair");

const horaInicio =
    document.getElementById("horaInicio");

const horaFim =
    document.getElementById("horaFim");

const intervaloHorario =
    document.getElementById("intervaloHorario");

const pausaInicio =
    document.getElementById("pausaInicio");

const pausaFim =
    document.getElementById("pausaFim");

const gerarHorarios =
    document.getElementById("gerarHorarios");

const nomeBarbearia =
    document.getElementById("nomeBarbearia");


// =========================================================
// CONFIGURAÇÃO DA BARBEARIA
// =========================================================

function aplicarConfiguracaoCliente() {

    if (!CONFIG_CLIENTE) {
        return;
    }

    const nome =
        CONFIG_CLIENTE.nome ||
        CONFIG.nome ||
        "Painel";

    if (nomeBarbearia) {
        nomeBarbearia.textContent = nome;
    }

    document.title = `Painel — ${nome}`;
}


// =========================================================
// CARREGAR CONFIGURAÇÃO DO CLIENTE
// =========================================================

async function carregarConfiguracaoCliente() {

    if (!CAMINHO_BARBEIRO) {
        return;
    }

    try {

        const configuracoesRef = ref(
            db,
            `${CAMINHO_BARBEIRO}/configuracoes`
        );

        const snapshot = await get(configuracoesRef);

        if (!snapshot.exists()) {

            console.warn(
                "Nenhuma configuração encontrada para este cliente."
            );

            CONFIG_CLIENTE = {
                nome: CONFIG.nome
            };

            return;
        }

        CONFIG_CLIENTE = snapshot.val();

        console.log(
            "CONFIGURAÇÃO DO CLIENTE:",
            CONFIG_CLIENTE
        );

    } catch (erro) {

        console.error(
            "Erro ao carregar configuração do cliente:",
            erro
        );

        CONFIG_CLIENTE = {
            nome: CONFIG.nome
        };
    }
}


// =========================================================
// DATA DE HOJE
// =========================================================

function obterDataHoje() {

    const hoje = new Date();

    const ano = hoje.getFullYear();

    const mes = String(
        hoje.getMonth() + 1
    ).padStart(2, "0");

    const dia = String(
        hoje.getDate()
    ).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;
}


const dataHoje = obterDataHoje();

if (dataPainel) {
    dataPainel.min = dataHoje;
    dataPainel.value = dataHoje;
}


// =========================================================
// LIMPAR HORÁRIOS DE DIAS PASSADOS
// NÃO APAGA AGENDAMENTOS
// =========================================================

async function limparHorariosPassados() {

    if (!CAMINHO_BARBEIRO) {
        return;
    }

    const hoje = obterDataHoje();

    try {

        const horariosRef = ref(
            db,
            `${CAMINHO_BARBEIRO}/horarios`
        );

        const snapshot = await get(horariosRef);

        if (!snapshot.exists()) {
            return;
        }

        const horarios = snapshot.val();
        const exclusoes = {};

        Object.keys(horarios).forEach((data) => {

            if (data < hoje) {
                exclusoes[data] = null;
            }
        });

        if (Object.keys(exclusoes).length === 0) {
            return;
        }

        await update(horariosRef, exclusoes);

        console.log(
            "Horários de dias passados removidos."
        );

    } catch (erro) {

        console.error(
            "Erro ao limpar horários passados:",
            erro
        );
    }
}


// =========================================================
// NOTIFICAÇÕES
// =========================================================

let idsAgendamentosConhecidos = new Set();

let idsAgendamentosNotificados = new Set();

let primeiraLeituraAgendamentos = true;

let notificacoesAtivas = false;

let monitoramentoIniciado = false;

let pararMonitoramento = null;


// =========================================================
// PEDIR PERMISSÃO PARA NOTIFICAÇÕES
// =========================================================

async function prepararNotificacoes() {

    if (!("Notification" in window)) {

        console.log(
            "Este navegador não suporta notificações."
        );

        notificacoesAtivas = false;
        return;
    }

    if (Notification.permission === "default") {

        const permissao =
            await Notification.requestPermission();

        console.log(
            "Permissão para notificações:",
            permissao
        );
    }

    notificacoesAtivas =
        Notification.permission === "granted";

    console.log(
        "NOTIFICAÇÕES ATIVAS:",
        notificacoesAtivas
    );

    console.log(
        "PERMISSÃO:",
        Notification.permission
    );
}


// =========================================================
// AUTENTICAÇÃO
// =========================================================

onAuthStateChanged(
    auth,
    async (usuario) => {

        if (!usuario) {

            window.location.href = "login.html";
            return;
        }

        try {

            // Descobrir o cliente

            let clienteId;

            try {

                clienteId = await descobrirCliente();

            } catch (erro) {

                console.warn(
                    "Não foi possível descobrir o cliente vinculado:",
                    erro.message
                );

                clienteId = CONFIG.id;
            }

            console.log(
                "CLIENTE IDENTIFICADO:",
                clienteId
            );


            // Definir caminho

            CAMINHO_BARBEIRO =
                `barbeiros/${clienteId}`;

            console.log(
                "CAMINHO DO CLIENTE:",
                CAMINHO_BARBEIRO
            );


            // Carregar configuração

            await carregarConfiguracaoCliente();

            aplicarConfiguracaoCliente();


            // Preparar notificações

            await prepararNotificacoes();

            console.log(
                "AUTH OK — preparando painel e notificações"
            );

            console.log(
                "notificacoesAtivas:",
                notificacoesAtivas
            );


            // Carregar painel

            await limparHorariosPassados();

            await carregarAgendamentos();

            await carregarHorarios();

            monitorarNovosAgendamentos();

        } catch (erro) {

            console.error(
                "Erro ao identificar cliente:",
                erro
            );

            if (mensagem) {
                mensagem.textContent =
                    "Erro ao identificar o cliente.";
            }
        }
    }
);


// =========================================================
// MOSTRAR NOTIFICAÇÃO
// =========================================================

function mostrarNotificacaoAgendamento(
    agendamento,
    id
) {

    if (!notificacoesAtivas) {

        console.log(
            "NOTIFICAÇÕES DESATIVADAS"
        );

        return;
    }

    console.log(
        "MOSTRANDO NOTIFICAÇÃO:",
        id,
        agendamento
    );

    try {

        const nomeBarbeariaAtual =
            CONFIG_CLIENTE?.nome ||
            CONFIG.nome ||
            "Barbearia";

        const titulo =
            `✂️ Novo agendamento — ${nomeBarbeariaAtual}`;

        const corpo =
            `${agendamento.nome || "Cliente"} agendou ${agendamento.servico || "um serviço"} às ${agendamento.horario || "--:--"}.`;

        const notificacao = new Notification(
            titulo,
            {
                body: corpo,

                // Identificação estável, sem Date.now()
                tag: `novo-${id}`,

                // Não solicitar novo alerta para a mesma tag
                renotify: false
            }
        );

        console.log(
            "NOTIFICAÇÃO CRIADA:",
            notificacao
        );

        notificacao.onclick = () => {
            window.focus();
            notificacao.close();
        };

    } catch (erro) {

        console.error(
            "ERRO AO CRIAR NOTIFICAÇÃO:",
            erro
        );
    }
}


// =========================================================
// MONITORAR NOVOS AGENDAMENTOS
// =========================================================

function monitorarNovosAgendamentos() {

    if (!CAMINHO_BARBEIRO) {
        return;
    }

    // Evitar criar listeners duplicados

    if (monitoramentoIniciado) {

        console.log(
            "Monitoramento já iniciado."
        );

        return;
    }

    monitoramentoIniciado = true;

    const agendamentosRef = ref(
        db,
        `${CAMINHO_BARBEIRO}/agendamentos`
    );

    pararMonitoramento = onValue(
        agendamentosRef,

        (snapshot) => {

            // Se não houver agendamentos

            if (!snapshot.exists()) {

                idsAgendamentosConhecidos = new Set();

                primeiraLeituraAgendamentos = false;

                console.log(
                    "Nenhum agendamento encontrado."
                );

                return;
            }

            const dados = snapshot.val();

            const idsAtuais = new Set(
                Object.keys(dados)
            );


            // Primeira leitura: registrar os existentes
            // sem notificar reservas antigas

            if (primeiraLeituraAgendamentos) {

                idsAgendamentosConhecidos = idsAtuais;

                primeiraLeituraAgendamentos = false;

                console.log(
                    "Monitoramento de agendamentos iniciado."
                );

                return;
            }


            // Procurar novos agendamentos

            idsAtuais.forEach((id) => {

                if (idsAgendamentosConhecidos.has(id)) {
                    return;
                }

                const agendamento = dados[id];

                if (
                    !agendamento ||
                    agendamento.status !== "confirmado"
                ) {
                    return;
                }

                // Impedir notificação repetida do mesmo ID

                if (idsAgendamentosNotificados.has(id)) {

                    console.log(
                        "Agendamento já notificado:",
                        id
                    );

                    return;
                }

                // Registrar ANTES de mostrar a notificação

                idsAgendamentosNotificados.add(id);

                console.log(
                    "NOVO AGENDAMENTO:",
                    id,
                    agendamento
                );

                mostrarNotificacaoAgendamento(
                    agendamento,
                    id
                );

                carregarAgendamentos();

                carregarHorarios();
            });


            // Atualizar IDs conhecidos

            idsAgendamentosConhecidos = idsAtuais;
        },

        (erro) => {

            console.error(
                "Erro ao monitorar agendamentos:",
                erro
            );
        }
    );
}


// =========================================================
// SAIR
// =========================================================

if (sair) {

    sair.addEventListener(
        "click",
        async () => {

            try {

                await signOut(auth);

                window.location.href = "index.html";

            } catch (erro) {

                console.error(
                    "Erro ao sair:",
                    erro
                );

                if (mensagem) {
                    mensagem.textContent =
                        "Erro ao sair da conta.";
                }
            }
        }
    );
}


// =========================================================
// CARREGAR AGENDAMENTOS
// =========================================================

async function carregarAgendamentos() {

    if (!CAMINHO_BARBEIRO) {
        return;
    }

    const data = String(
        dataPainel?.value || obterDataHoje()
    );

    if (listaAgendamentos) {
        listaAgendamentos.innerHTML =
            "<p class='vazio'>Carregando...</p>";
    }

    try {

        const snapshot = await get(
            ref(
                db,
                `${CAMINHO_BARBEIRO}/agendamentos`
            )
        );

        console.log(
            "=== DEBUG AGENDAMENTOS ==="
        );

        console.log(
            "CAMINHO:",
            `${CAMINHO_BARBEIRO}/agendamentos`
        );

        console.log(
            "DATA SELECIONADA:",
            data
        );

        console.log(
            "SNAPSHOT EXISTE:",
            snapshot.exists()
        );

        console.log(
            "DADOS RECEBIDOS:",
            snapshot.val()
        );


        // Nenhum agendamento

        if (!snapshot.exists()) {

            if (listaAgendamentos) {
                listaAgendamentos.innerHTML =
                    "<p class='vazio'>Nenhum agendamento para esta data.</p>";
            }

            if (totalAgendados) {
                totalAgendados.textContent = "0";
            }

            return;
        }

        const dados = snapshot.val();

        const todosAgendamentos =
            Object.entries(dados);


        // Filtrar pela data e excluir cancelados

        const agendamentos =
            todosAgendamentos.filter(
                ([id, agendamento]) => {

                    if (!agendamento) {
                        return false;
                    }

                    const dataAgendamento =
                        String(agendamento.data || "");

                    const status =
                        String(
                            agendamento.status || ""
                        ).toLowerCase();

                    return (
                        dataAgendamento === data &&
                        status !== "cancelado"
                    );
                }
            );


        // Ordenar por horário

        agendamentos.sort(
            ([, agendamentoA], [, agendamentoB]) => {

                const horarioA =
                    String(
                        agendamentoA?.horario || "99:99"
                    );

                const horarioB =
                    String(
                        agendamentoB?.horario || "99:99"
                    );

                return horarioA.localeCompare(horarioB);
            }
        );


        // Total agendados

        if (totalAgendados) {

            totalAgendados.textContent =
                String(agendamentos.length);

            totalAgendados.style.display = "block";
            totalAgendados.style.visibility = "visible";
            totalAgendados.style.opacity = "1";
        }


        // Nenhum agendamento nesta data

        if (agendamentos.length === 0) {

            if (listaAgendamentos) {
                listaAgendamentos.innerHTML =
                    "<p class='vazio'>Nenhum agendamento para esta data.</p>";
            }

            return;
        }


        // Limpar lista

        if (listaAgendamentos) {
            listaAgendamentos.innerHTML = "";
        }


        // Criar cards

        agendamentos.forEach(([id, agendamento]) => {

            if (!listaAgendamentos) {
                return;
            }

            const card = document.createElement("div");

            card.className = "agendamento";

            const horario =
                String(agendamento.horario || "--:--");

            const nome =
                String(agendamento.nome || "Cliente");

            const servico =
                String(agendamento.servico || "Não informado");

            const telefoneOriginal =
                String(agendamento.telefone || "");

            const telefone =
                telefoneOriginal.replace(/\D/g, "");

            let whatsapp = telefone;

            if (
                whatsapp &&
                !whatsapp.startsWith("55")
            ) {
                whatsapp = "55" + whatsapp;
            }

            let linkWhatsApp = "#";

            if (whatsapp) {
                linkWhatsApp =
                    `https://wa.me/${whatsapp}`;
            }

            card.innerHTML = `

                <div class="horario">
                    ${horario}
                </div>

                <div class="cliente">
                    ${nome}
                </div>

                <div class="detalhes-agendamento">

                    <div>
                        <span>Serviço</span>
                        <strong>${servico}</strong>
                    </div>

                    <div>
                        <span>WhatsApp</span>
                        <strong>${telefoneOriginal || "Não informado"}</strong>
                    </div>

                </div>

                <div class="botoes">

                    ${
                        whatsapp
                            ? `
                                <a
                                    class="whatsapp"
                                    href="${linkWhatsApp}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    WhatsApp ↗
                                </a>
                            `
                            : `
                                <span class="whatsapp" style="opacity:0.5;">
                                    Sem WhatsApp
                                </span>
                            `
                    }

                    <button
                        class="cancelar"
                        type="button"
                    >
                        Cancelar
                    </button>

                </div>
            `;


            // Botão cancelar

            const botaoCancelar =
                card.querySelector(".cancelar");

            if (botaoCancelar) {

                botaoCancelar.addEventListener(
                    "click",
                    () => {

                        cancelarAgendamento(
                            id,
                            agendamento.data,
                            agendamento.horario
                        );
                    }
                );
            }

            listaAgendamentos.appendChild(card);
        });


        console.log(
            "CARDS CRIADOS:",
            listaAgendamentos
                ? listaAgendamentos.children.length
                : 0
        );

        console.log(
            "TOTAL AGENDADOS:",
            agendamentos.length
        );

    } catch (erro) {

        console.error(
            "Erro ao carregar agendamentos:",
            erro
        );

        if (listaAgendamentos) {
            listaAgendamentos.innerHTML =
                "<p class='vazio'>Erro ao carregar agendamentos.</p>";
        }
    }
}


// =========================================================
// CARREGAR HORÁRIOS
// =========================================================

async function carregarHorarios() {

    if (!CAMINHO_BARBEIRO) {
        return;
    }

    const data = String(
        dataPainel?.value || obterDataHoje()
    );

    if (listaHorarios) {
        listaHorarios.innerHTML =
            "<p class='vazio'>Carregando...</p>";
    }

    try {

        const horariosSnapshot = await get(
            ref(
                db,
                `${CAMINHO_BARBEIRO}/horarios/${data}`
            )
        );

        const agendamentosSnapshot = await get(
            ref(
                db,
                `${CAMINHO_BARBEIRO}/agendamentos`
            )
        );

        const horarios =
            horariosSnapshot.exists()
                ? Object.entries(horariosSnapshot.val())
                : [];

        const agendamentos =
            agendamentosSnapshot.exists()
                ? Object.values(agendamentosSnapshot.val())
                : [];


        // Horários ocupados

        const horariosOcupados =
            agendamentos
                .filter((agendamento) => {

                    return (
                        String(agendamento?.data || "") === data &&
                        String(
                            agendamento?.status || ""
                        ).toLowerCase() === "confirmado"
                    );
                })
                .map((agendamento) => {
                    return String(agendamento.horario || "");
                });


        // Ordenar horários

        horarios.sort(([horarioA], [horarioB]) => {

            const [horaA, minutoA] =
                String(horarioA).split(":").map(Number);

            const [horaB, minutoB] =
                String(horarioB).split(":").map(Number);

            return (
                horaA * 60 + minutoA -
                (horaB * 60 + minutoB)
            );
        });


        console.log(
            "HORÁRIOS ENCONTRADOS:",
            horarios
        );

        console.log(
            "HORÁRIOS OCUPADOS:",
            horariosOcupados
        );


        // Contadores

        let quantidadeDisponiveis = 0;
        let quantidadeOcupados = 0;

        horarios.forEach(([horario, dados]) => {

            const ocupado =
                horariosOcupados.includes(String(horario));

            if (ocupado) {
                quantidadeOcupados++;
                return;
            }

            if (dados && dados.disponivel === true) {
                quantidadeDisponiveis++;
            } else {
                quantidadeOcupados++;
            }
        });


        // Atualizar agendados

        const elementoAgendados =
            document.getElementById("totalAgendados");

        const elementoDisponiveis =
            document.getElementById("totalDisponiveis");

        const elementoOcupados =
            document.getElementById("totalOcupados");


        if (elementoAgendados) {

            const quantidadeAgendados =
                agendamentos.filter((agendamento) => {

                    return (
                        String(agendamento?.data || "") === data &&
                        String(
                            agendamento?.status || ""
                        ).toLowerCase() !== "cancelado"
                    );
                }).length;

            elementoAgendados.textContent =
                String(quantidadeAgendados);

            elementoAgendados.style.display = "block";
            elementoAgendados.style.visibility = "visible";
            elementoAgendados.style.opacity = "1";
        }


        // Atualizar disponíveis

        if (elementoDisponiveis) {

            elementoDisponiveis.textContent =
                String(quantidadeDisponiveis);

            elementoDisponiveis.style.display = "block";
            elementoDisponiveis.style.visibility = "visible";
            elementoDisponiveis.style.opacity = "1";
        }


        // Atualizar ocupados

        if (elementoOcupados) {

            elementoOcupados.textContent =
                String(quantidadeOcupados);

            elementoOcupados.style.display = "block";
            elementoOcupados.style.visibility = "visible";
            elementoOcupados.style.opacity = "1";
        }


        // Limpar lista

        if (listaHorarios) {
            listaHorarios.innerHTML = "";
        }


        // Nenhum horário

        if (horarios.length === 0) {

            if (listaHorarios) {
                listaHorarios.innerHTML =
                    "<p class='vazio'>Nenhum horário cadastrado para esta data.</p>";
            }

            return;
        }


        // Mostrar horários

        horarios.forEach(([horario, dados]) => {

            const ocupado =
                horariosOcupados.includes(String(horario));

            const disponivel =
                !ocupado &&
                dados &&
                dados.disponivel === true;

            const card = document.createElement("div");

            card.className = "horario-card";

            card.innerHTML = `

                <strong>${horario}</strong>

                <span class="${
                    disponivel
                        ? "disponivel"
                        : "ocupado"
                }">
                    ${
                        disponivel
                            ? "Disponível"
                            : "Ocupado"
                    }
                </span>

                ${
                    disponivel
                        ? `
                            <button
                                class="remover-horario"
                                type="button"
                            >
                                Remover
                            </button>
                        `
                        : ""
                }
            `;

            if (listaHorarios) {
                listaHorarios.appendChild(card);
            }

            const botaoRemover =
                card.querySelector(".remover-horario");

            if (botaoRemover) {

                botaoRemover.addEventListener(
                    "click",
                    () => {
                        removerHorario(data, horario);
                    }
                );
            }
        });

    } catch (erro) {

        console.error(
            "Erro ao carregar horários:",
            erro
        );

        if (listaHorarios) {
            listaHorarios.innerHTML =
                "<p class='vazio'>Erro ao carregar horários.</p>";
        }
    }
}


// =========================================================
// CANCELAR AGENDAMENTO
// =========================================================

async function cancelarAgendamento(
    id,
    data,
    horario
) {

    const confirmar = confirm(
        "Cancelar este agendamento?"
    );

    if (!confirmar) {
        return;
    }

    try {

        await update(
            ref(
                db,
                `${CAMINHO_BARBEIRO}/agendamentos/${id}`
            ),
            {
                status: "cancelado"
            }
        );


        // Liberar horário

        await update(
            ref(
                db,
                `${CAMINHO_BARBEIRO}/horarios/${data}/${horario}`
            ),
            {
                disponivel: true
            }
        );


        if (mensagem) {
            mensagem.textContent =
                "✓ Agendamento cancelado.";
        }

        await carregarAgendamentos();

        await carregarHorarios();

    } catch (erro) {

        console.error(
            "Erro ao cancelar:",
            erro
        );

        if (mensagem) {
            mensagem.textContent =
                "Erro ao cancelar o agendamento.";
        }
    }
}


// =========================================================
// ADICIONAR HORÁRIO MANUALMENTE
// =========================================================

if (adicionarHorario) {

    adicionarHorario.addEventListener(
        "click",
        async () => {

            if (!CAMINHO_BARBEIRO) {
                return;
            }

            const data = dataPainel.value;

            const horario = novoHorario.value;

            if (!data || !horario) {

                if (mensagem) {
                    mensagem.textContent =
                        "Escolha um horário.";
                }

                return;
            }

            try {

                const horarioRef = ref(
                    db,
                    `${CAMINHO_BARBEIRO}/horarios/${data}/${horario}`
                );

                const snapshot = await get(horarioRef);

                if (snapshot.exists()) {

                    if (mensagem) {
                        mensagem.textContent =
                            "Esse horário já existe.";
                    }

                    return;
                }

                await update(
                    horarioRef,
                    {
                        disponivel: true
                    }
                );

                novoHorario.value = "";

                if (mensagem) {
                    mensagem.textContent =
                        "✓ Horário adicionado.";
                }

                await carregarHorarios();

            } catch (erro) {

                console.error(
                    "Erro ao adicionar horário:",
                    erro
                );

                if (mensagem) {
                    mensagem.textContent =
                        "Erro ao adicionar horário.";
                }
            }
        }
    );
}


// =========================================================
// GERAR HORÁRIOS AUTOMATICAMENTE
// =========================================================

if (gerarHorarios) {

    gerarHorarios.addEventListener(
        "click",
        async () => {

            if (!CAMINHO_BARBEIRO) {
                return;
            }

            const inicio = horaInicio.value;

            const fim = horaFim.value;

            const intervalo =
                Number(intervaloHorario.value);

            const pausaInicioValor =
                pausaInicio.value;

            const pausaFimValor =
                pausaFim.value;


            // Validações

            if (!inicio || !fim) {

                if (mensagem) {
                    mensagem.textContent =
                        "Preencha o início e o fim.";
                }

                return;
            }

            if (!intervalo || intervalo <= 0) {

                if (mensagem) {
                    mensagem.textContent =
                        "Escolha um intervalo válido.";
                }

                return;
            }

            const inicioPartes =
                inicio.split(":").map(Number);

            const fimPartes =
                fim.split(":").map(Number);

            const inicioMinutos =
                inicioPartes[0] * 60 + inicioPartes[1];

            const fimMinutos =
                fimPartes[0] * 60 + fimPartes[1];

            if (inicioMinutos >= fimMinutos) {

                if (mensagem) {
                    mensagem.textContent =
                        "O horário final deve ser maior que o inicial.";
                }

                return;
            }


            // Pausa

            let pausaInicioMinutos = null;

            let pausaFimMinutos = null;

            if (
                pausaInicioValor &&
                pausaFimValor
            ) {

                const pausaInicioPartes =
                    pausaInicioValor.split(":").map(Number);

                const pausaFimPartes =
                    pausaFimValor.split(":").map(Number);

                pausaInicioMinutos =
                    pausaInicioPartes[0] * 60 +
                    pausaInicioPartes[1];

                pausaFimMinutos =
                    pausaFimPartes[0] * 60 +
                    pausaFimPartes[1];

                if (
                    pausaInicioMinutos >= pausaFimMinutos
                ) {

                    if (mensagem) {
                        mensagem.textContent =
                            "O fim da pausa deve ser maior que o início.";
                    }

                    return;
                }
            }


            // Gerar horários

            try {

                gerarHorarios.disabled = true;

                if (mensagem) {
                    mensagem.textContent =
                        "Gerando horários para 7 dias...";
                }

                const atualizacoes = {};

                let totalHorarios = 0;

                const hoje = new Date();

                hoje.setHours(0, 0, 0, 0);


                // Gerar os próximos 7 dias

                for (let dia = 0; dia < 7; dia++) {

                    const data = new Date(hoje);

                    data.setDate(hoje.getDate() + dia);

                    const ano = data.getFullYear();

                    const mes = String(
                        data.getMonth() + 1
                    ).padStart(2, "0");

                    const numeroDia = String(
                        data.getDate()
                    ).padStart(2, "0");

                    const dataFirebase =
                        `${ano}-${mes}-${numeroDia}`;


                    // Horários do dia

                    for (
                        let minutos = inicioMinutos;
                        minutos < fimMinutos;
                        minutos += intervalo
                    ) {

                        // Pular pausa

                        if (
                            pausaInicioMinutos !== null &&
                            pausaFimMinutos !== null &&
                            minutos >= pausaInicioMinutos &&
                            minutos < pausaFimMinutos
                        ) {
                            continue;
                        }

                        const hora =
                            Math.floor(minutos / 60);

                        const minuto =
                            minutos % 60;

                        const horario =
                            `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;

                        const caminho =
                            `${CAMINHO_BARBEIRO}/horarios/${dataFirebase}/${horario}/disponivel`;

                        atualizacoes[caminho] = true;

                        totalHorarios++;
                    }
                }


                // Salvar no Firebase

                await update(
                    ref(db),
                    atualizacoes
                );

                if (mensagem) {
                    mensagem.textContent =
                        `✓ 7 dias gerados com sucesso. ${totalHorarios} horários criados.`;
                }

                await carregarAgendamentos();

                await carregarHorarios();

            } catch (erro) {

                console.error(
                    "ERRO AO GERAR:",
                    erro
                );

                if (mensagem) {
                    mensagem.textContent =
                        "Erro ao gerar os horários. Veja o console.";
                }

            } finally {

                gerarHorarios.disabled = false;
            }
        }
    );
}


// =========================================================
// BOTÃO ATUALIZAR
// =========================================================

if (atualizar) {

    atualizar.addEventListener(
        "click",
        async () => {

            await carregarAgendamentos();

            await carregarHorarios();
        }
    );
}


// =========================================================
// TROCAR DATA
// =========================================================

if (dataPainel) {

    dataPainel.addEventListener(
        "change",
        async () => {

            await carregarAgendamentos();

            await carregarHorarios();
        }
    );
}


// =========================================================
// REMOVER HORÁRIO
// =========================================================

async function removerHorario(
    data,
    horario
) {

    const confirmar = confirm(
        `Remover o horário ${horario}?`
    );

    if (!confirmar) {
        return;
    }

    try {

        const horarioRef = ref(
            db,
            `${CAMINHO_BARBEIRO}/horarios/${data}/${horario}`
        );

        await remove(horarioRef);


        // Verificar remoção

        const verificar = await get(horarioRef);

        if (verificar.exists()) {

            if (mensagem) {
                mensagem.textContent =
                    "Não foi possível remover o horário.";
            }

            return;
        }

        if (mensagem) {
            mensagem.textContent =
                "✓ Horário removido.";
        }

        await carregarHorarios();

    } catch (erro) {

        console.error(
            "Erro ao remover horário:",
            erro
        );

        if (mensagem) {
            mensagem.textContent =
                "Erro ao remover horário.";
        }
    }
}