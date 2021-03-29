function Test-7z {
    $7zdir = (Get-Location).Path + "\7z"
    if (-not (Test-Path ($7zdir + "\7za.exe")))
    {
        $download_file = (Get-Location).Path + "\7z.zip"
        Write-Host "Downloading 7z" -ForegroundColor Green
        Invoke-WebRequest -Uri "https://download.sourceforge.net/sevenzip/7za920.zip" -UserAgent [Microsoft.PowerShell.Commands.PSUserAgent]::FireFox -OutFile $download_file
        Write-Host "Extracting 7z" -ForegroundColor Green
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::ExtractToDirectory($download_file, $7zdir)
        Remove-Item -Force $download_file
    }
    else
    {
        Write-Host "7z already exist. Skipped download" -ForegroundColor Green
    }
}

function Test-PowershellVersion {
    $version = $PSVersionTable.PSVersion.Major
    Write-Host "Checking Windows PowerShell version -- $version" -ForegroundColor Green
    if ($version -le 4)
    {
        Write-Host "Using Windows PowerShell $version is unsupported. Upgrade your Windows PowerShell." -ForegroundColor Red
        throw
    }
}

function Get-RootList ($archive_dir) {
    $download_file = ($archive_dir + "\list.txt")
    $link = "<ask bot to generate index and copy url here>"
    Write-Host "Downloading Root List" -ForegroundColor Green
    Invoke-WebRequest -Uri $link -UserAgent [Microsoft.PowerShell.Commands.PSUserAgent]::FireFox -OutFile $download_file
}

function Test-RootList ($archive_dir) {
    $list = ($archive_dir + "\list.txt")
    $is_exist = Test-Path $list

    return $is_exist
}

function Test-ChecksumSHA256 ($file) {
    Split-Path -Path $file | Push-Location

    $content = Get-Content $file
    $good = 0
    $bad = 0

    foreach ($line in $content) {
        $part = $line.Split(' ')
        $hashIndex = $part[0]
        $filename = $part[2]
        
        $hash = (Get-FileHash -Algorithm 'SHA256' $filename).hash.ToLower()
        $status = $hash -eq $hashIndex

        if ($status) {
            $good++
        } else {
            $bad++
        }

        Write-Host "$filename`: $(If ($status) {'OK'} Else {'FAILED'})" -ForegroundColor $(if ($status) { 'Green' } else { 'Red' })
    }

    if ($good -eq 0) {
        Write-Host "All files failed integrity test" -ForegroundColor Red
    } else {
        Write-Host "$good files passed integrity test" -ForegroundColor Green
    }

    if ($bad -eq 0) {
        Write-Host "0 files failed integrity test" -ForegroundColor Green
    } else {
        Write-Host "$bad file(s) failed integrity test" -ForegroundColor Red
    }

    Pop-Location
}

function Get-ArchivePart ($download_file, $link, $currentPart, $totalParts) {
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $link -UserAgent [Microsoft.PowerShell.Commands.PSUserAgent]::FireFox -OutFile $download_file
    $ProgressPreference = 'Continue'
}

# need to parrelize it somehow
function Get-Archive ($archive_dir, $urls) {
    $seq = 0
    $urls | ForEach-Object {
        $link = $_
        $seq++
        $filename = $link.Split("/")[-1]
        $download_file = ($archive_dir + "\" + $filename)
        Write-Progress -Activity "Download progress" -Status "[ $seq / $($urls.Count) ] $filename" -PercentComplete (($seq / $urls.Count) * 100)
        Get-ArchivePart $download_file $link $seq $urls.Count
    }

    # PowerShell 7 only
    # $urls | ForEach-Object -Begin { $seq = 0 } -Process -Parallel -ThrottleLimit 5 {
    #     $seq++
    #     $link = $_
    #     $filename = $link.Split("/")[-1]
    #     $download_file = ($archive_dir + "\" + $filename)
    #     Get-ArchivePart $download_file $link $seq $urls.length
    # }
}

function Test-Archive ($archive_dir) {
    if (-not (Test-Path $archive_dir) ) {
        New-Item -Path $archive_dir -ItemType directory | Out-Null
    }

    if (-not (Test-RootList($archive_dir)) ) {
        Get-RootList $archive_dir
    } else {
        Write-Host "Root List already exists. Skipped download" -ForegroundColor Green
    }
    
    $content = Get-Content ($archive_dir + "\list.txt")
    $urls = New-Object -TypeName "System.Collections.ArrayList"
    
    foreach ($line in $content) {
        $filename = $line.Split('/')[-1]
        $exist = Test-Path ($archive_dir + "\" + $filename)
        
        if (-not ($exist)) {
            $urls.Add($line) | Out-Null
        }
    }

    if ($urls.Count -gt 0) {
        $result = Read-KeyOrTimeout "Proceed with downloading $($urls.Count) file(s)? [Y/n] (default=y)" "Y"
        Write-Host ""

        if ($result -eq "Y") {
            Get-Archive $archive_dir $urls
        }
    } else {
        Write-Host "Archive files already exists. Skipped download" -ForegroundColor Green
    }

    if (Test-Path ($archive_dir + "\SHA256SUMS") ) {
        $result = Read-KeyOrTimeout "Proceed with archive integrity test? [Y/n] (default=n)" "N"
        Write-Host ""

        if ($result -eq "Y") {
            Write-Host "Checking archive integrity" -ForegroundColor Green
            Test-ChecksumSHA256 ($archive_dir + "\SHA256SUMS")
        }
    }
}

function Resolve-Archive ($file, $output, $password) {
    if (-not (Test-Path $output) ) {
        New-Item -Path $output -ItemType directory | Out-Null
    }

    Write-Host "Unpacking archive, this may take a while" -ForegroundColor Green

    $7za = ((Get-Location).Path + "\7z\7za.exe")
    & $7za x -p"$($password)" -y -o"$($output)" "$($file)" > unpack.log
}

function Test-Admin {
    $user = [Security.Principal.WindowsIdentity]::GetCurrent();
    (New-Object Security.Principal.WindowsPrincipal $user).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
}

function Read-KeyOrTimeout ($prompt, $key){
    $seconds = 9
    $startTime = Get-Date
    $timeOut = New-TimeSpan -Seconds $seconds

    Write-Host "$prompt " -ForegroundColor Green

    # Basic progress bar
    [Console]::CursorLeft = 0
    [Console]::Write("[")
    [Console]::CursorLeft = $seconds + 2
    [Console]::Write("]")
    [Console]::CursorLeft = 1

    while (-not [System.Console]::KeyAvailable) {
        $currentTime = Get-Date
        Start-Sleep -s 1
        Write-Host "#" -ForegroundColor Green -NoNewline
        if ($currentTime -gt $startTime + $timeOut) {
            Break
        }
    }
    if ([System.Console]::KeyAvailable) {
        $response = [System.Console]::ReadKey($true).Key
    }
    else {
        $response = $key
    }
    return $response.ToString()
}

#
# Main script entry point
#
if (Test-Admin) {
    Write-Host "Running script with administrator privileges" -ForegroundColor Yellow
}
else {
    Write-Host "Running script without administrator privileges" -ForegroundColor Red
}

try {
    $installPath = ((Get-Location).Path + "\out")
    $archivePath = ((Get-Location).Path + "\archive")
    $archiveFile = ($archivePath + "\data.7z.001")
    $password = "my archive password goes here"

    Test-PowershellVersion
    # Sourceforge only support TLS 1.2
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    Test-7z
    Test-Archive $archivePath
    Resolve-Archive $archiveFile $installPath $password

    Write-Host "Operation completed" -ForegroundColor Magenta
}
catch [System.Exception] {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
