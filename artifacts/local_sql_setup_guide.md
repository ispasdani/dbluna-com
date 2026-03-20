# Local SQL Server Setup Guide

This guide details exactly how to configure your local development environment to successfully process and test `.bacpac` database imports into the dbluna-com Electron application.

To test the application locally without relying on Cloud DBs, you need two things:
1. **A running instance of SQL Server locally** (usually via Docker Desktop).
2. **Microsoft's `sqlpackage` command-line tool** installed natively on the host machine.

---

## 💻 macOS (Intel Processors / i9 from 2019)

Your current machine uses an x86_64 architecture (Intel Processor). Because of this, you can run the official, full-featured Microsoft SQL Server Linux container natively.

### 1. Start SQL Server (Docker required)
Run this command in the terminal to start the standard SQL Server 2022 image.
```bash
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=yourStrong(!)Password" -p 1433:1433 --name sql_server_dev -d mcr.microsoft.com/mssql/server:2022-latest
```

### 2. Install `sqlpackage`
Homebrew is the easiest way to install Microsoft's native SQL command-line tools. Homebrew will seamlessly download the macOS `x64` binaries for your Intel chip.
```bash
brew tap microsoft/sqlserver-osx
brew install sqlpackage
```

---

## 🍏 macOS (Apple Silicon / M1, M2, M3 etc)

M-series Macs use ARM64 architecture. The standard MS-SQL image does not run natively and the emulation layer (Rosetta) often crashes during database queries. Instead, you **must use Azure SQL Edge**, which is uniquely compiled for ARM chips.

### 1. Start SQL Server (Azure SQL Edge via Docker)
Run this command to start an ARM-compatible lightweight SQL Server. Note the `SYS_PTRACE` capability flag is required for the OS container boot.
```bash
docker run --cap-add SYS_PTRACE -e "ACCEPT_EULA=1" -e "MSSQL_SA_PASSWORD=yourStrong(!)Password" -p 1433:1433 --name sql_edge_dev -d mcr.microsoft.com/azure-sql-edge
```

### 2. Install `sqlpackage`
Homebrew natively detects your architecture and installs the correct `arm64` binary.
```bash
brew tap microsoft/sqlserver-osx
brew install sqlpackage
```

---

## 🪟 Windows PC

Windows users have access to native installers and don't necessarily need Docker, though it keeps the system clean and isolated.

### Option A: Native Setup (Recommended for pure speed)
1. **Install SQL Server:** Download and install [SQL Server 2022 Developer Edition](https://www.microsoft.com/en-us/sql-server/sql-server-downloads) directly onto the PC. 
   - **Crucial step**: Ensure the server is configured with **SQL Server Authentication** checked and set the `sa` password to `yourStrong(!)Password`. It must match the dev config.
2. **Install `sqlpackage`:** The CLI tool will automatically be installed into your system PATH if you install [Azure Data Studio](https://learn.microsoft.com/en-us/sql/azure-data-studio/download-azure-data-studio) or [SQL Server Management Studio (SSMS)](https://learn.microsoft.com/en-us/sql/ssms/download-sql-server-management-studio-ssms).
   - *Alternative setup via `.NET Core`:* `dotnet tool install -g microsoft.sqlpackage`

### Option B: Docker Setup (Recommended for clean isolation)
Alternatively, start the SQL server container natively through Docker Desktop on Windows.
```powershell
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=yourStrong(!)Password" -p 1433:1433 --name sql_server_dev -d mcr.microsoft.com/mssql/server:2022-latest
```
*Note: You will still need to download `sqlpackage` natively as described in Option A so Electron's main node process can invoke it directly.*
