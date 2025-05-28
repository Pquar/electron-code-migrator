# Demonstração MCP - PowerShell
Write-Host "=== Demonstração MCP - Acesso a Arquivos Locais ===" -ForegroundColor Green
Write-Host ""

$folders = @("primaria", "intermediario", "destino final")
$basePath = Get-Location

foreach ($folder in $folders) {
    $folderPath = Join-Path $basePath $folder
    Write-Host "📁 Verificando pasta: $folder" -ForegroundColor Cyan
    Write-Host "   Caminho: $folderPath"
    
    if (Test-Path $folderPath) {
        $items = Get-ChildItem $folderPath
        Write-Host "   ✅ Pasta encontrada com $($items.Count) item(s)" -ForegroundColor Green
        
        foreach ($item in $items) {
            if ($item.PSIsContainer) {
                Write-Host "      📁 $($item.Name)/ (subpasta)" -ForegroundColor Yellow
            } else {
                $ext = $item.Extension
                $size = $item.Length
                Write-Host "      📄 $($item.Name) ($ext) - $size bytes" -ForegroundColor White
                
                # Se for um arquivo de código pequeno, mostrar prévia
                if ($ext -in @('.js', '.ts', '.py', '.java') -and $size -lt 1000) {
                    try {
                        $content = Get-Content $item.FullName -Raw
                        $preview = $content.Substring(0, [Math]::Min(100, $content.Length))
                        Write-Host "         📝 Prévia: $preview..." -ForegroundColor Gray
                    } catch {
                        Write-Host "         ❌ Erro ao ler arquivo: $($_.Exception.Message)" -ForegroundColor Red
                    }
                }
            }
        }
    } else {
        Write-Host "   ⚠️ Pasta não encontrada" -ForegroundColor Yellow
    }
    Write-Host ""
}

Write-Host "=== Como a IA usaria essas informações ===" -ForegroundColor Green
Write-Host "🤖 1. Analisar arquivos existentes para entender padrões de código"
Write-Host "🤖 2. Verificar dependências e imports para conversões mais precisas"
Write-Host "🤖 3. Manter consistência de estilo entre arquivos convertidos"
Write-Host "🤖 4. Sugerir melhorias baseadas no contexto do projeto"
Write-Host ""
Write-Host "=== Demonstração Concluída ===" -ForegroundColor Green
