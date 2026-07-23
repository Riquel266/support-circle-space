$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
cloudflared tunnel --url http://localhost:8080 2>&1 | Tee-Object -FilePath "$env:TEMP\cloudflared-output.log"
