@echo off
setlocal

set SCRIPT_DIR=%~dp0
set PROJECT=%SCRIPT_DIR%server\EventModelServer\EventModelServer.csproj
set PUBLISH_DIR=%SCRIPT_DIR%server\EventModelServer\bin\publish

echo Building EventModelServer...
dotnet publish "%PROJECT%" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o "%PUBLISH_DIR%"

if errorlevel 1 (
    echo Build failed.
    exit /b 1
)

echo Copying EventModelServer.exe to root...
copy /Y "%PUBLISH_DIR%\EventModelServer.exe" "%SCRIPT_DIR%event-model-viewer.exe"

echo Done. EventModelServer.exe is ready in the root folder.
endlocal
