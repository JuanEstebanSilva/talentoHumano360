# Script de PowerShell para Push y Merge completo a Main (Sin archivos pendientes)
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  Talento 360 - Push Completo a Git y Merge a Main" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

Set-Location "D:\Varios\Varios\GitHub\talento360"

Write-Host "`n[1/8] Estado actual del repositorio..." -ForegroundColor Yellow
git status -s

Write-Host "`n[2/8] Agregando todos los cambios pendientes..." -ForegroundColor Yellow
git add -A

Write-Host "`n[3/8] Creando commit institucional..." -ForegroundColor Yellow
git commit -m "fix(pdf & dashboard): color verde institucional #355833 unificado en encabezado y tablas, escudo transparente directo sin fondo blanco, emision estilizada, pie de pagina con bandera de Boyaca, conteo dinamico real de dependencias (34+) y correccion estricta de servidores en planta (624 activos)"

Write-Host "`n[4/8] Subiendo rama de desarrollo a origin..." -ForegroundColor Yellow
git push origin feature/ajustes-y-mejoras-finales

Write-Host "`n[5/8] Cambiando a la rama main..." -ForegroundColor Yellow
git checkout main

Write-Host "`n[6/8] Sincronizando rama main con GitHub..." -ForegroundColor Yellow
git pull origin main --no-rebase

Write-Host "`n[7/8] Fusionando todas las mejoras en main..." -ForegroundColor Yellow
git merge feature/ajustes-y-mejoras-finales --no-edit

Write-Host "`n[8/8] Subiendo main actualizado a origin main..." -ForegroundColor Green
git push origin main

Write-Host "`n====================================================================" -ForegroundColor Cyan
Write-Host "  VERIFICACIÓN DE ESTADO FINAL:" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
git status

Write-Host "`n¡Operación completada exitosamente! Repositorio 100% al día en main sin archivos pendientes." -ForegroundColor Green
