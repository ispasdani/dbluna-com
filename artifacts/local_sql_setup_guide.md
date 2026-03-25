# Local MS SQL Server Setup Guide for MacBook Pro (i9, 2019)

Since you are running a 2019 MacBook Pro with an Intel Core i9 processor, you are on the `x86_64` architecture. This means you do not need to use workarounds like Azure SQL Edge (which Apple Silicon/M-series Mac users need). Instead, you can run the standard **Microsoft SQL Server 2022 Linux container** perfectly via Docker.

## Prerequisites

1. **Install Docker Desktop for Mac**
   - Download the **Mac with Intel chip** version from the [Docker website](https://docs.docker.com/desktop/install/mac-install/).
   - Open the downloaded `.dmg` file and drag Docker to your Applications folder.
   - Launch Docker Desktop and ensure it is running (you should see the whale icon in your menu bar).

2. **Install a Database Client**
   - **Azure Data Studio (Recommended for Mac):** A lightweight, cross-platform tool by Microsoft. [Download here](https://learn.microsoft.com/en-us/sql/azure-data-studio/download-azure-data-studio).
   - **DBeaver:** Another great cross-platform database management tool.
   - *(Note: SQL Server Management Studio (SSMS) is Windows-only, so Azure Data Studio is the direct macOS equivalent).*

## Step-by-Step SQL Server Setup

### 1. Pull the SQL Server Docker Image
Open your Terminal and run the following command to download the latest SQL Server 2022 image:

```bash
docker pull mcr.microsoft.com/mssql/server:2022-latest
```

### 2. Run the SQL Server Container
Run the following command to start a new container. Make sure to replace `<YourStrong!Passw0rd>` with a secure password of your choice.

```bash
docker run -e 'ACCEPT_EULA=Y' \
  -e 'MSSQL_SA_PASSWORD=<YourStrong!Passw0rd>' \
  -p 1433:1433 \
  --name local_sql_server \
  --restart unless-stopped \
  -d mcr.microsoft.com/mssql/server:2022-latest
```

**Parameters explained:**
- `-e 'ACCEPT_EULA=Y'`: Accepts the End-User License Agreement.
- `-e 'MSSQL_SA_PASSWORD=...'`: Sets the System Administrator (`sa`) password. (It must be at least 8 characters long and contain characters from three of the following four sets: Uppercase letters, Lowercase letters, Base 10 digits, and Symbols).
- `-p 1433:1433`: Maps port 1433 in the container to port 1433 on your Mac.
- `--name local_sql_server`: Assigns a readable name to your container.
- `--restart unless-stopped`: Ensures the database automatically starts if you restart Docker or your Mac.
- `-d`: Runs the container in detached mode (in the background).

### 3. Verify the Container is Running
Check the status of your Docker container to ensure it's up and healthy:

```bash
docker ps
```
You should see `local_sql_server` in the list with a status of `Up`.

## Connecting to Your Local SQL Server

1. Open **Azure Data Studio**.
2. Click on **New Connection**.
3. Fill in the connection details:
   - **Connection type:** Microsoft SQL Server
   - **Server:** `localhost`
   - **Authentication type:** SQL Login
   - **User name:** `sa`
   - **Password:** `<YourStrong!Passw0rd>` (the one you set in Step 2)
   - **Trust server certificate:** True (Check this box to avoid SSL errors on local development)
4. Click **Connect**.

You are now connected to your local SQL Server instance and can begin creating databases and tables!

## Useful Docker Commands for SQL Server

- **Stop the server:** `docker stop local_sql_server`
- **Start the server:** `docker start local_sql_server`
- **View logs (useful for debugging):** `docker logs local_sql_server`
- **Remove the server completely:**
  ```bash
  docker rm -f local_sql_server
  ```
