const { setGlobalOptions } = require("firebase-functions");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

admin.initializeApp();

setGlobalOptions({ maxInstances: 10 });

// ===== HELPER: busca tokens FCM de coordenação/direção da escola =====
async function buscarTokensEscola(escolaId) {
  const snap = await admin.firestore()
    .collection("usuarios")
    .where("escolaId", "==", escolaId)
    .where("role", "in", ["coordenacao", "direcao"])
    .where("ativo", "==", true)
    .get();

  const tokens = [];
  snap.forEach((d) => { if (d.data().fcmToken) tokens.push({ ref: d.ref, token: d.data().fcmToken }); });
  return { snap, tokens };
}

// ===== HELPER: envia push e limpa tokens inválidos =====
async function enviarPush(tokens, snap, notification, data = {}) {
  if (tokens.length === 0) {
    logger.info("Nenhum token FCM encontrado");
    return;
  }

  const response = await admin.messaging().sendEachForMulticast({
    notification,
    data,
    tokens: tokens.map(t => t.token)
  });

  logger.info(`Push: ${response.successCount} enviados, ${response.failureCount} falhas`);

  // Remover tokens inválidos
  const remover = [];
  response.responses.forEach((r, idx) => {
    const code = r.error?.code;
    if (code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token") {
      remover.push(tokens[idx].ref.update({ fcmToken: admin.firestore.FieldValue.delete() }));
    }
  });
  if (remover.length > 0) await Promise.all(remover);
}

// ===== TRIGGER: Nova Ocorrência =====
exports.notificarNovaOcorrencia = onDocumentCreated("ocorrencias/{docId}", async (event) => {
  const ocorrencia = event.data.data();
  if (!ocorrencia.nomeAluno || !ocorrencia.escolaId) return null;

  const { escolaId, professorNome, nomeAluno, turma } = ocorrencia;
  const { tokens } = await buscarTokensEscola(escolaId);

  await enviarPush(tokens, null, {
    title: "Nova Ocorrência — escu",
    body: `${professorNome} registrou ocorrência de ${nomeAluno} (${turma})`
  }, { url: "/ocorrencias" });

  return null;
});

// ===== TRIGGER: Novo Controle (Atraso / Saída) =====
exports.notificarNovoControle = onDocumentCreated("controleEntradaSaida/{docId}", async (event) => {
  const controle = event.data.data();
  if (!controle.alunoNome || !controle.escolaId) return null;

  const { escolaId, alunoNome, turma, tipo, registradoPorNome } = controle;
  const tipoLabel = tipo === "atraso" ? "Atraso" : "Saída";
  const { tokens } = await buscarTokensEscola(escolaId);

  await enviarPush(tokens, null, {
    title: `${tipoLabel} registrado — escu`,
    body: `${registradoPorNome} registrou ${tipoLabel.toLowerCase()} de ${alunoNome} (${turma})`
  }, { url: "/secretaria/lista-controles" });

  return null;
});
