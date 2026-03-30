# Script de Instalação Automática da Extensão PV doTERRA
# Uso: irm https://raw.githubusercontent.com/jhonatanstarley/PVd-TERRA_Extractor/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

# === CONFIGURAÇÕES ===
# Link direto para o Download do seu arquivo .zip da extensão no GitHub
$RepoZipUrl = "https://raw.githubusercontent.com/jhonatanstarley/PVd-TERRA_Extractor/main/ext_pv_doterra.zip"

$DocsPath = [Environment]::GetFolderPath('MyDocuments')
$ExtFolder = Join-Path $DocsPath "PV_doTERRA_Extensao"
$ZipPath = Join-Path $DocsPath "ext_pv_temp.zip"

Clear-Host
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   Instalador PV dōTERRA Extractor 🚀    " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# 1. FUNÇÃO: DETECÇÃO DE NAVEGADORES
function Get-InstalledBrowsers {
    $browsers = @()
    
    # Google Chrome
    $chromePath = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
    $chromePath2 = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
    $chromePath3 = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    if ((Test-Path $chromePath) -or (Test-Path $chromePath2) -or (Test-Path $chromePath3)) {
        $exe = if(Test-Path $chromePath){$chromePath} elseif(Test-Path $chromePath2){$chromePath2} else{$chromePath3}
        $browsers += [PSCustomObject]@{Name="Google Chrome"; Exe=$exe; Url="chrome://extensions/"}
    }

    # Microsoft Edge
    $edgePath = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    if (Test-Path $edgePath) {
        $browsers += [PSCustomObject]@{Name="Microsoft Edge"; Exe=$edgePath; Url="edge://extensions/"}
    }

    # Brave Browser
    $bravePath = "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe"
    $bravePath2 = "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe"
    if ((Test-Path $bravePath) -or (Test-Path $bravePath2)) {
        $exe = if(Test-Path $bravePath){$bravePath} else{$bravePath2}
        $browsers += [PSCustomObject]@{Name="Brave Browser"; Exe=$exe; Url="brave://extensions/"}
    }
    
    # Opera
    $operaPath = "$env:LOCALAPPDATA\Programs\Opera\launcher.exe"
    $operaPath2 = "$env:LOCALAPPDATA\Programs\Opera GX\launcher.exe"
    if (Test-Path $operaPath) { $browsers += [PSCustomObject]@{Name="Opera"; Exe=$operaPath; Url="opera://extensions/"} }
    if (Test-Path $operaPath2) { $browsers += [PSCustomObject]@{Name="Opera GX"; Exe=$operaPath2; Url="opera://extensions/"} }

    return $browsers
}

$AvailableBrowsers = Get-InstalledBrowsers
if ($AvailableBrowsers.Count -eq 0) {
    Write-Host "[X] Nenhum navegador compativel detectado. Encerrando." -ForegroundColor Red
    exit
}

# 2. UI: SELEÇÃO DE NAVEGADOR
Write-Host "[*] Detectando navegadores..." -ForegroundColor Yellow
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Instalador PV dōTERRA'
$form.Size = New-Object System.Drawing.Size(320,180)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.TopMost = $true

$label = New-Object System.Windows.Forms.Label
$label.Location = New-Object System.Drawing.Point(15,20)
$label.Size = New-Object System.Drawing.Size(280,20)
$label.Text = 'Selecione o navegador para instalar a extensão:'
$label.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$form.Controls.Add($label)

$comboBox = New-Object System.Windows.Forms.ComboBox
$comboBox.Location = New-Object System.Drawing.Point(15,50)
$comboBox.Size = New-Object System.Drawing.Size(270,20)
$comboBox.DropDownStyle = 'DropDownList'
$comboBox.Font = New-Object System.Drawing.Font('Segoe UI', 9)
foreach($b in $AvailableBrowsers) { $comboBox.Items.Add($b.Name) | Out-Null }
$comboBox.SelectedIndex = 0
$form.Controls.Add($comboBox)

$okButton = New-Object System.Windows.Forms.Button
$okButton.Location = New-Object System.Drawing.Point(120,95)
$okButton.Size = New-Object System.Drawing.Size(80,25)
$okButton.Text = 'Avançar'
$okButton.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$okButton.DialogResult = [System.Windows.Forms.DialogResult]::OK
$form.AcceptButton = $okButton
$form.Controls.Add($okButton)

$cancelButton = New-Object System.Windows.Forms.Button
$cancelButton.Location = New-Object System.Drawing.Point(205,95)
$cancelButton.Size = New-Object System.Drawing.Size(80,25)
$cancelButton.Text = 'Cancelar'
$cancelButton.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$cancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$form.CancelButton = $cancelButton
$form.Controls.Add($cancelButton)

$result = $form.ShowDialog()

if ($result -ne [System.Windows.Forms.DialogResult]::OK) {
    Write-Host "[*] Instalacao cancelada pelo usuario." -ForegroundColor Yellow
    exit
}

$SelectedBrowser = $AvailableBrowsers | Where-Object { $_.Name -eq $comboBox.SelectedItem }
Write-Host "[*] Navegador Selecionado: $($SelectedBrowser.Name)" -ForegroundColor Green

# 3. DOWNLOAD E EXTRAÇÃO
if (Test-Path $ExtFolder) {
    Write-Host "[*] Removendo versão antiga..." -ForegroundColor Yellow
    Remove-Item -Path $ExtFolder -Recurse -Force | Out-Null
}

New-Item -ItemType Directory -Force -Path $ExtFolder | Out-Null

Write-Host "[*] Baixando a extensão (isso pode levar alguns segundos)..." -ForegroundColor Cyan
try {
    Invoke-WebRequest -Uri $RepoZipUrl -OutFile $ZipPath
} catch {
    Write-Host "[X] Erro ao baixar! Verifique o link do GitHub ou sua internet." -ForegroundColor Red
    exit
}

Write-Host "[*] Descompactando na sua pasta Documentos..." -ForegroundColor Cyan
Expand-Archive -Path $ZipPath -DestinationPath $ExtFolder -Force

Remove-Item -Path $ZipPath -Force

Write-Host "[✓] Arquivos preparados com sucesso!" -ForegroundColor Green

# 4. INSTRUÇÕES FINAIS E ABERTURA
Write-Host "[*] Abrindo o $($SelectedBrowser.Name) e o Explorador de Arquivos..." -ForegroundColor Yellow
Invoke-Item $ExtFolder

try {
    Start-Process -FilePath $SelectedBrowser.Exe -ArgumentList "about:blank"
} catch {
    Write-Host "[!] Não foi possível abrir o navegador automaticamente. Abra manualmente." -ForegroundColor Red
}

$guideForm = New-Object System.Windows.Forms.Form
$guideForm.Text = 'Passo a Passo (PV dōTERRA)'
$guideForm.Size = New-Object System.Drawing.Size(430,320)
$guideForm.StartPosition = 'CenterScreen'
$guideForm.TopMost = $true
$guideForm.FormBorderStyle = 'FixedDialog'
$guideForm.MaximizeBox = $false
$guideForm.MinimizeBox = $false

$titleLbl = New-Object System.Windows.Forms.Label
$titleLbl.Text = "FINALIZE NO $($SelectedBrowser.Name.ToUpper())"
$titleLbl.Font = New-Object System.Drawing.Font('Segoe UI', 13, [System.Drawing.FontStyle]::Bold)
$titleLbl.Location = New-Object System.Drawing.Point(15,15)
$titleLbl.Size = New-Object System.Drawing.Size(390,25)
$titleLbl.ForeColor = [System.Drawing.Color]::RoyalBlue
$guideForm.Controls.Add($titleLbl)

$steps = "1️⃣ Vá nas extensões do seu navegador:`r`n"
$steps += "      Clique nos 3 pontinhos '...' (Menu) no canto superior direito.`r`n"
$steps += "      Vá em 'Extensões' > 'Gerenciar Extensões'.`r`n`r`n"
$steps += "2️⃣ Ative a chave 'Modo do desenvolvedor'.`r`n`r`n"
$steps += "3️⃣ Clique no botão 'Carregar sem compactação' (topo esquerdo).`r`n`r`n"
$steps += "4️⃣ Selecione a pasta amarela 'PV_doTERRA_Extensao'.`r`n`r`n"
$steps += "🎉 Pronto! Fixe o ícone do PV dōTERRA no alfinete."

$instLbl = New-Object System.Windows.Forms.Label
$instLbl.Text = $steps
$instLbl.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$instLbl.Location = New-Object System.Drawing.Point(15,55)
$instLbl.Size = New-Object System.Drawing.Size(390,170)
$guideForm.Controls.Add($instLbl)

$closeBtn = New-Object System.Windows.Forms.Button
$closeBtn.Text = "Já instalei (Fechar janela)"
$closeBtn.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
$closeBtn.Location = New-Object System.Drawing.Point(105,230)
$closeBtn.Size = New-Object System.Drawing.Size(200,35)
$closeBtn.BackColor = [System.Drawing.Color]::LightGreen
$closeBtn.DialogResult = [System.Windows.Forms.DialogResult]::OK
$guideForm.Controls.Add($closeBtn)

$guideForm.ShowDialog() | Out-Null

Write-Host ""
Write-Host "Tudo pronto! Siga as instruções que apareceram na tela." -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan

