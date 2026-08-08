@echo off
setlocal

set SCRIPT_DIR=%~dp0

echo Building viewer (standalone + server-integrated)...
node "%SCRIPT_DIR%viewer\build.js"
if errorlevel 1 (
    echo Viewer build failed.
    exit /b 1
)

echo Copying outputs to root...
copy /Y "%SCRIPT_DIR%viewer\event-model-viewer.html" "%SCRIPT_DIR%event-model-viewer.html"
copy /Y "%SCRIPT_DIR%viewer\event-model-viewer-for-server.html" "%SCRIPT_DIR%event-model-viewer-for-server.html"

echo Done.
endlocal
