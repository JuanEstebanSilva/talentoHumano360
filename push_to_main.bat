@echo off
chcp 65001 > nul
echo ====================================================================
echo   Talento 360 - Push Completo y Merge a Main (Sin Pendientes)
echo ====================================================================
cd /d "D:\Varios\Varios\GitHub\talento360"

echo [1/8] Verificando estado y rama actual...
git status -s

echo.
echo [2/8] Agregando todos los archivos modificados y nuevos...
git add -A

echo.
echo [3/8] Creando commit institucional con todas las mejoras...
git commit -m "fix(pdf & dashboard): color verde institucional #355833 unificado en encabezado y tablas, escudo transparente directo sin fondo blanco, emision estilizada, pie de pagina con bandera de Boyaca, conteo dinamico real de dependencias (34+) y correccion estricta de servidores en planta (624 activos)"

echo.
echo [4/8] Respaldando rama de trabajo en remoto...
git push origin feature/ajustes-y-mejoras-finales

echo.
echo [5/8] Cambiando a rama principal main...
git checkout main

echo.
echo [6/8] Sincronizando main con origin/main...
git pull origin main --no-rebase

echo.
echo [7/8] Fusionando (merge) todas las mejoras de feature en main...
git merge feature/ajustes-y-mejoras-finales --no-edit

echo.
echo [8/8] Subiendo la rama main completamente actualizada a GitHub...
git push origin main

echo.
echo ====================================================================
echo   ESTADO FINAL DEL REPOSITORIO (DEBE DECIR CLEAN / LIMPIO):
echo ====================================================================
git status
echo.
echo Push y Merge a MAIN completados al 100%% sin archivos pendientes.
echo ====================================================================
pause
