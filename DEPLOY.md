# 🚀 Deploy — Contas do Mês

Guia rápido pra subir o app em produção: **Railway** (backend + DB) + **Vercel** (frontend) + **domínio próprio**.

---

## 📋 Pré-requisitos

- ✅ Conta Railway ([railway.app](https://railway.app))
- ✅ Conta Vercel ([vercel.com](https://vercel.com))
- ✅ Projeto no GitHub
- ✅ Domínios `contasdomes.com` e `contasdomes.com.br` registrados

---

## 1️⃣ Backend + Postgres no Railway

### 1.1 Criar projeto + banco

1. Em [railway.app](https://railway.app/new) → **New Project** → **Deploy from GitHub repo** → escolhe `contas_do_mes_full`
2. Railway detecta o projeto. Antes de fazer deploy:
   - Clica no service criado → **Settings**
   - **Root Directory:** `backend`
   - **Build Command:** (deixa vazio, usa Dockerfile)
3. Adiciona o Postgres:
   - **+ New** → **Database** → **Add PostgreSQL**

### 1.2 Variáveis de ambiente (Settings → Variables)

Cola todas:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET_KEY=<rode no terminal: python -c "import secrets; print(secrets.token_hex(32))">
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080
ANTHROPIC_API_KEY=sk-ant-...
CLOUDINARY_CLOUD_NAME=CONTAS_DO_MES
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
STRIPE_SECRET_KEY=sk_live_... (use a chave LIVE em produção!)
STRIPE_WEBHOOK_SECRET=whsec_... (gerado no passo 4)
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...
RESEND_API_KEY= (deixa vazio por enquanto)
RESEND_FROM_EMAIL=Tuco <tuco@contasdomes.com.br>
GOOGLE_CLIENT_ID=598838471118-uv0ji96m5tphul5prpoaji8a8f6dahgq.apps.googleusercontent.com
APP_NAME=Contas do Mês
FRONTEND_URL=https://contasdomes.com.br
ALLOWED_ORIGINS=https://contasdomes.com.br,https://www.contasdomes.com.br
DEBUG=false
```

⚠️ **Atenção:** o `${{Postgres.DATABASE_URL}}` é referência mágica do Railway — copia exatamente assim.

### 1.3 Domínio customizado

1. Em **Settings** do backend → **Networking** → **Custom Domain**
2. Adiciona: `api.contasdomes.com.br`
3. Railway te dá um CNAME tipo `xxx.up.railway.app`
4. No DNS do `contasdomes.com.br` (Registro.br ou onde tiver):
   - Tipo: **CNAME**
   - Nome: **api**
   - Valor: `xxx.up.railway.app`
5. Espera 5-15min pra propagar

### 1.4 Deploy

O Railway faz auto-deploy a cada push no GitHub. Acompanha em **Deployments**.

Pra testar: `curl https://api.contasdomes.com.br/api/health` → deve responder `{"status":"ok"}`

---

## 2️⃣ Frontend no Vercel

### 2.1 Importar projeto

1. Em [vercel.com/new](https://vercel.com/new) → escolhe o repo `contas_do_mes_full`
2. **Root Directory:** `frontend`
3. Framework Preset: **Vite** (auto-detecta)
4. **NÃO clica em Deploy ainda** — primeiro:

### 2.2 Variáveis de ambiente

Em **Environment Variables**, cola:

```
VITE_API_URL=https://api.contasdomes.com.br
VITE_WHATSAPP_NUMBER=+1 415 523 8886
VITE_WHATSAPP_JOIN_CODE=join curve-history
```

Aplica em **Production**, **Preview**, **Development**.

### 2.3 Deploy

Clica em **Deploy**. Espera 1-2min.

### 2.4 Domínio customizado

1. **Settings** → **Domains**
2. Adiciona `contasdomes.com.br` e `www.contasdomes.com.br`
3. Vercel te dá registros DNS pra colocar:
   - **Tipo A** para `contasdomes.com.br` → `76.76.21.21`
   - **CNAME** para `www` → `cname.vercel-dns.com`
4. Configura no DNS do domínio
5. Vercel emite SSL automaticamente em 1-2min

---

## 3️⃣ Atualizar serviços externos

### 3.1 Google OAuth

No [Google Cloud Console](https://console.cloud.google.com/apis/credentials), no Cliente OAuth:
- Adiciona em **Origens JavaScript Autorizadas**:
  - `https://contasdomes.com.br`
  - `https://www.contasdomes.com.br`

### 3.2 Stripe Webhook

1. [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks) → **Add endpoint**
2. URL: `https://api.contasdomes.com.br/api/billing/webhook`
3. Eventos:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
4. Cria → copia o **Signing secret** (`whsec_...`)
5. Vai no Railway → cola em `STRIPE_WEBHOOK_SECRET` → redeploy

### 3.3 Twilio (WhatsApp Webhook)

1. Twilio Console → **WhatsApp Sandbox** (ou Business depois)
2. **When a message comes in:** `https://api.contasdomes.com.br/api/webhook/twilio`
3. Method: **POST**

---

## 4️⃣ Pós-deploy — smoke test

Vai em `https://contasdomes.com.br` e testa:

- [ ] Tela de login carrega
- [ ] Botão "Continuar com Google" funciona
- [ ] Criar conta (com senha forte)
- [ ] Tour de onboarding aparece
- [ ] Cadastrar uma conta fixa
- [ ] Registrar um gasto avulso (com máscara R$)
- [ ] Configurar o Tuco e voltar pro Dashboard
- [ ] Manda mensagem pro Twilio WhatsApp e verifica resposta
- [ ] Tenta assinar Pro (use cartão de teste Stripe se estiver em test mode)

---

## 5️⃣ Resend (email) — quando quiser ativar

1. Cria conta em [resend.com](https://resend.com)
2. **Domains** → **Add Domain** → `contasdomes.com.br`
3. Adiciona os registros DNS (SPF + DKIM) no domínio
4. Espera verificação
5. Cria API Key
6. Cola no Railway: `RESEND_API_KEY=re_...`
7. Redeploy

---

## ⚠️ Custos esperados

- Railway: **$5/mês** (backend + Postgres)
- Vercel: **grátis** (até 100GB bandwidth)
- Domínio: **R$ 40/ano** (Registro.br)
- Resend: **grátis** (até 3000 emails/mês)
- Stripe: **0% fixo** (só taxa por venda)
- Twilio: depende do uso

**Total: ~R$ 30/mês**
