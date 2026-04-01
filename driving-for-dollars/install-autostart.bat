@echo off
:: Creates a shortcut in Windows Startup folder so D4D runs on boot
:: Run this ONCE after setup is complete

echo Creating startup shortcut...

set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SCRIPT=%USERPROFILE%\HEMAN\driving-for-dollars\start-d4d.bat

:: Create a VBS script to make a shortcut (Windows doesn't have a simple command for this)
echo Set oWS = WScript.CreateObject("WScript.Shell") > "%TEMP%\create-shortcut.vbs"
echo sLinkFile = "%STARTUP%\DrivingForDollars.lnk" >> "%TEMP%\create-shortcut.vbs"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%TEMP%\create-shortcut.vbs"
echo oLink.TargetPath = "%SCRIPT%" >> "%TEMP%\create-shortcut.vbs"
echo oLink.WorkingDirectory = "%USERPROFILE%\HEMAN\driving-for-dollars" >> "%TEMP%\create-shortcut.vbs"
echo oLink.WindowStyle = 7 >> "%TEMP%\create-shortcut.vbs"
echo oLink.Save >> "%TEMP%\create-shortcut.vbs"

cscript //nologo "%TEMP%\create-shortcut.vbs"
del "%TEMP%\create-shortcut.vbs"

echo.
echo Done! Driving for Dollars will now start automatically when Windows boots.
echo Shortcut created at: %STARTUP%\DrivingForDollars.lnk
echo.
pause
