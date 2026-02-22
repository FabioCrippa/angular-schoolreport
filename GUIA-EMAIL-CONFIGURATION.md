# 📧 Guia de Configuração - Email Automático para Ocorrências

## 🎯 Objetivo
Enviar email automático para Coordenação e Direção sempre que uma nova ocorrência for registrada.

---

## 📋 Passo 1: Instalar a Extensão no Firebase

1. Acesse o **Firebase Console**: https://console.firebase.google.com
2. Selecione seu projeto
3. No menu lateral, clique em **⚡ Extensions** (Extensões)
4. Clique em **Explore extensions** (Explorar extensões)
5. Procure por: **"Trigger Email"** ou **"Trigger Email from Firestore"**
6. Clique em **Install** (Instalar)
7. Clique em **Next** até chegar na configuração

---

## ⚙️ Passo 2: Configurar a Extensão

Durante a instalação, você precisará configurar:

### **A) Configurações de Email (SMTP)**

Você tem 3 opções de provedor de email:

#### **Opção 1: Gmail (Mais Fácil)** ⭐ RECOMENDADO
```
SMTP Host: smtp.gmail.com
SMTP Port: 587
SMTP Username: seu-email@gmail.com
SMTP Password: [Senha de App - veja abaixo como gerar]
```

**Como gerar Senha de App no Gmail:**
1. Acesse: https://myaccount.google.com/security
2. Ative **Verificação em duas etapas** (se ainda não tiver)
3. Vá em **Senhas de app**
4. Selecione app: **Email** / Dispositivo: **Outro (personalizado)**
5. Digite: "Sistema Ocorrências"
6. Copie a senha gerada (16 caracteres sem espaços)
7. Use essa senha no campo SMTP Password

#### **Opção 2: SendGrid (Profissional)**
- Cadastre-se: https://sendgrid.com/ (100 emails/dia grátis)
- Crie uma API Key
- Use: smtp.sendgrid.net, porta 587, usuário: apikey, senha: sua_api_key

#### **Opção 3: Outlook/Hotmail**
```
SMTP Host: smtp-mail.outlook.com
SMTP Port: 587
SMTP Username: seu-email@outlook.com
SMTP Password: sua-senha
```

### **B) Configurações da Extensão**

**Collection Path (Caminho da Coleção):**
```
ocorrencias
```

**Email From Address (Email Remetente):**
```
seu-email@gmail.com
ou
noreply@sua-escola.com (se tiver domínio próprio)
```

**Email From Name (Nome do Remetente):**
```
Sistema de Ocorrências Escolares
```

---

## 🔧 Passo 3: Modificar Estrutura do Documento

A extensão precisa que o documento no Firestore tenha campos específicos. Vou atualizar o código para incluir esses campos automaticamente.

**Campos necessários:**
- `to`: array de emails para enviar
- `message.subject`: assunto do email
- `message.text`: conteúdo do email (texto)
- `message.html`: conteúdo do email (HTML) - opcional

---

## ✅ Passo 4: Testar

Após configurar:
1. Registre uma nova ocorrência no sistema
2. Verifique no **Firestore Console** se o documento foi criado com os campos de email
3. A extensão processa automaticamente (olhe em **Extensions → Trigger Email → Logs**)
4. Coordenação/Direção devem receber o email em alguns segundos

---

## 🐛 Troubleshooting

### Email não está sendo enviado:
1. Verifique os **Logs** da extensão no Firebase Console
2. Confirme que a senha de app do Gmail está correta
3. Verifique se a verificação em duas etapas está ativa
4. Teste com um email seu primeiro

### Email vai para SPAM:
- Normal na primeira vez
- Peça para marcar como "Não é spam"
- Se possível, use domínio próprio (@sua-escola.com)

### Erro de autenticação:
- Regere a senha de app do Gmail
- Tente com outro provedor (SendGrid)

---

## 💰 Custos

**Firebase Extensions:**
- Gratuito até 5.000 emails/mês (plano Spark)
- Depois: ~$0.15 por 1.000 emails

**Gmail:**
- Grátis: 500 emails/dia
- Limite: 2.000 emails/dia no total

**SendGrid:**
- Grátis: 100 emails/dia
- Pago: a partir de $15/mês (40.000 emails)

---

## 📝 Próximos Passos

Depois de instalar a extensão, volte aqui e me avise. Vou atualizar o código para:
1. ✅ Adicionar campos de email ao documento de ocorrência
2. ✅ Buscar emails de coordenação/direção da escola
3. ✅ Formatar o conteúdo do email
4. ✅ Criar template HTML bonito

**Está pronto para começar? Vá ao Firebase Console e instale a extensão "Trigger Email"!** 🚀
