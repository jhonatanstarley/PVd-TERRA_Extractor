# Script de Instalação Automática da Extensão PV doTERRA
# Uso: irm https://raw.githubusercontent.com/jhonatanstarley/PVd-TERRA_Extractor/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

# === CONFIGURAÇÕES ===
# Link direto para o Download do seu arquivo .zip da extensão no GitHub
# Você precisa atualizar este link para o RAW do seu arquivo ZIP no repositório
$RepoZipUrl = "https://raw.githubusercontent.com/jhonatanstarley/PVd-TERRA_Extractor/main/ext_pv_doterra.zip"

$DocsPath = [Environment]::GetFolderPath('MyDocuments')
$ExtFolder = Join-Path $DocsPath "PV_doTERRA_Extensao"
$ZipPath = Join-Path $DocsPath "ext_pv_temp.zip"

Clear-Host
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   Instalador PV dōTERRA Extractor 🚀    " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verifica e limpa versão antiga
if (Test-Path $ExtFolder) {
    Write-Host "[*] Removendo versão antiga..." -ForegroundColor Yellow
    Remove-Item -Path $ExtFolder -Recurse -Force | Out-Null
}

New-Item -ItemType Directory -Force -Path $ExtFolder | Out-Null

# 2. Faz o Download
Write-Host "[*] Baixando a extensão (isso pode levar alguns segundos)..." -ForegroundColor Cyan
try {
    Invoke-WebRequest -Uri $RepoZipUrl -OutFile $ZipPath
} catch {
    Write-Host "[X] Erro ao baixar! Verifique o link do GitHub ou sua internet." -ForegroundColor Red
    exit
}

# 3. Extrai os arquivos
Write-Host "[*] Descompactando na sua pasta Documentos..." -ForegroundColor Cyan
Expand-Archive -Path $ZipPath -DestinationPath $ExtFolder -Force

# 4. Limpeza
Remove-Item -Path $ZipPath -Force

Write-Host "[✓] Arquivos preparados com sucesso!" -ForegroundColor Green

# 5. Instruções finais via Pop-up
Add-Type -AssemblyName PresentationFramework

$msg = "✅ Extensão baixada com sucesso!`n`n"
$msg += "Os arquivos foram salvos na sua pasta Documentos:`n$ExtFolder`n`n"
$msg += "👉 PARA INSTALAR NO CHROME:`n"
$msg += "1. Marque a caixinha 'Modo do desenvolvedor' (canto superior direito).`n"
$msg += "2. Clique no botão 'Carregar sem compactação'.`n"
$msg += "3. Selecione a pasta 'PV_doTERRA_Extensao' que acabou de ser aberta.`n`n"
$msg += "O Chrome e a Pasta serão abertos assim que você clicar em OK."

[System.Windows.MessageBox]::Show($msg, "Instalação PV dōTERRA", "OK", "Information") | Out-Null

# 6. Abre as janelas pro usuário
Write-Host "[*] Abrindo Google Chrome e Explorador de Arquivos..." -ForegroundColor Yellow
Invoke-Item $ExtFolder

# Tenta abrir o Chrome direto na página de Extensões
try {
    Start-Process "chrome.exe" "chrome://extensions/"
} catch {
    Write-Host "[!] Chrome não encontrado no path padrão. Abra chrome://extensions/ manualmente." -ForegroundColor Red
}

Write-Host ""
Write-Host "Tudo pronto! Siga as instruções no navegador." -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
