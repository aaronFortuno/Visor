@echo off
node --experimental-strip-types "%~dp0cli\src\index.ts" %*
