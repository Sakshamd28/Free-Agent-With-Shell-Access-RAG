# AI Security Agent PowerShell Launcher
Write-Host "===================================================" -ForegroundColor Green
Write-Host "       Starting AI Security Agent & Web UI         " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Green

# Check if NVIDIA_API_KEY is set in environment or prompt
if (-not $env:NVIDIA_API_KEY) {
    Write-Host "[!] Note: NVIDIA_API_KEY is not set in environment. You can enter it in the Web UI Settings." -ForegroundColor Yellow
}

Write-Host "[1/2] Starting FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; python app.py"

Start-Sleep -Seconds 2

Write-Host "[2/2] Starting React Vite Frontend on http://localhost:5173..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "`nAI Security Agent running!" -ForegroundColor Green
Write-Host "Frontend:    http://localhost:5173" -ForegroundColor White
Write-Host "Backend API: http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "`nPress any key to exit this launcher..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
