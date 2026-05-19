@echo off
echo ============================================
echo   Contas do Mes - Iniciando modo DEV
echo ============================================

:: Copia .env se nao existir
if not exist backend\.env (
    copy backend\.env.example backend\.env
    echo [AVISO] Crie o arquivo backend\.env com suas credenciais!
)

:: Instala dependencias do backend se necessario
if not exist backend\venv (
    echo Criando ambiente virtual Python...
    cd backend
    python -m venv venv
    call venv\Scripts\activate
    pip install -r requirements.txt
    cd ..
)

:: Instala dependencias do frontend se necessario
if not exist frontend\node_modules (
    echo Instalando dependencias do frontend...
    cd frontend
    npm install
    cd ..
)

:: Inicia backend em background
echo Iniciando backend (porta 8000)...
start "Backend" cmd /k "cd backend && venv\Scripts\activate && uvicorn app.main:app --reload --port 8000"

:: Inicia frontend
echo Iniciando frontend (porta 5173)...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ============================================
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
echo   Docs API: http://localhost:8000/api/docs
echo ============================================
