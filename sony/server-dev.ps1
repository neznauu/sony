$serverPath = Join-Path $PSScriptRoot "server.ps1"
& $serverPath
exit $LASTEXITCODE
