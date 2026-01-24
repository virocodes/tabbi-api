"""
Modal Sandbox for Agent API

Provides isolated execution environments running OpenCode server.
Each sandbox:
1. Clones a repository using a provided GitHub PAT (optional)
2. Starts OpenCode server on port 4096
3. Exposes a tunnel for external HTTP access
4. Supports pause/resume via filesystem snapshots
"""

from __future__ import annotations

import asyncio
import hmac
import json
import os
import modal

app = modal.App("agent-sandbox")

# Secret for authenticating API requests (optional)
# To enable: modal secret create agent-api-secret MODAL_API_SECRET=your-secret-here
# Then uncomment the secrets parameter in the endpoint decorators below

# Image for web endpoints (requires FastAPI and Pydantic)
endpoint_image = modal.Image.debian_slim(python_version="3.11").pip_install("fastapi[standard]", "pydantic")

# Base image with git, node, and opencode installed
sandbox_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "curl", "ca-certificates", "gnupg", "zip", "unzip")
    .run_commands(
        # Install Node.js 20 LTS
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs",
        # Install opencode-ai globally
        "npm install -g opencode-ai@latest",
    )
)


def verify_auth(request) -> None:
    """Verify the Authorization header matches the API secret."""
    from fastapi import HTTPException

    auth_header = request.headers.get("Authorization")
    expected_secret = os.environ.get("MODAL_API_SECRET")

    if not expected_secret:
        # If no secret configured, allow requests (development mode)
        return

    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid Authorization header format")

    token = auth_header[7:]  # Remove "Bearer " prefix
    if not hmac.compare_digest(token, expected_secret):
        raise HTTPException(status_code=403, detail="Invalid API secret")


@app.function()
async def create_sandbox(
    repo: str | None = None,
    pat: str | None = None,
    anthropic_api_key: str | None = None,
) -> dict:
    """
    Create a new sandbox with OpenCode server running.

    Args:
        repo: GitHub repository in format "owner/repo" (optional)
        pat: GitHub Personal Access Token for cloning (required if repo provided)
        anthropic_api_key: Anthropic API key for Claude models

    Returns:
        dict with sandbox_id and tunnel_url
    """
    print(f"[create] Starting sandbox creation" + (f" for repo: {repo}" if repo else ""))

    # Create sandbox with tunnel on port 4096
    print("[create] Creating Modal sandbox with encrypted port 4096...")
    sb = modal.Sandbox.create(
        image=sandbox_image,
        app=app,
        timeout=3600,        # 1 hour hard limit
        idle_timeout=600,    # Kill after 10 min of inactivity
        encrypted_ports=[4096],
        cpu=1.0,
        memory=2048,
    )
    print(f"[create] Sandbox ID: {sb.object_id}")

    # Configure git credentials if PAT provided
    if pat:
        print("[create] Configuring git credentials...")
        credential_url = f"https://x-access-token:{pat}@github.com"
        sb.exec("sh", "-c", f"umask 077 && echo '{credential_url}' > /root/.git-credentials").wait()
        sb.exec("git", "config", "--global", "credential.helper", "store --file=/root/.git-credentials").wait()

    # Clone repository if provided
    if repo:
        print(f"[create] Cloning repository {repo}...")
        clone_result = sb.exec("git", "clone", f"https://github.com/{repo}.git", "/workspace")
        clone_result.wait()

        if clone_result.returncode != 0:
            error = clone_result.stderr.read()
            print(f"[create] Clone failed: {error}")
            sb.terminate()
            raise Exception(f"Failed to clone repository: {error}")

        # Fetch GitHub user identity
        if pat:
            print("[create] Fetching GitHub user identity...")
            user_result = sb.exec(
                "curl", "-s", "-H", f"Authorization: Bearer {pat}",
                "-H", "Accept: application/vnd.github+json",
                "https://api.github.com/user"
            )
            user_result.wait()
            user_output = user_result.stdout.read()
            if isinstance(user_output, bytes):
                user_output = user_output.decode("utf-8")

            try:
                user_data = json.loads(user_output)
                github_username = user_data.get("login", "github-user")
                github_email = user_data.get("email") or f"{github_username}@users.noreply.github.com"
                github_name = user_data.get("name") or github_username

                sb.exec("git", "config", "--global", "user.email", github_email).wait()
                sb.exec("git", "config", "--global", "user.name", github_name).wait()
                print(f"[create] Git configured for: {github_name} <{github_email}>")
            except json.JSONDecodeError:
                print("[create] Warning: Could not parse GitHub user info")
    else:
        # Create empty workspace
        sb.exec("mkdir", "-p", "/workspace").wait()

    # Create OpenCode configuration
    print("[create] Creating opencode.json configuration...")
    opencode_config = '{"server": {"port": 4096, "hostname": "0.0.0.0"}}'
    sb.exec("sh", "-c", f"echo '{opencode_config}' > /workspace/opencode.json").wait()

    # Write environment variables to secure file
    print("[create] Setting up environment...")
    sb.exec("sh", "-c", "umask 077 && touch /root/.opencode-env").wait()

    if pat:
        sb.exec("sh", "-c", f"echo 'export GH_TOKEN=\"{pat}\"' >> /root/.opencode-env").wait()

    if anthropic_api_key:
        sb.exec("sh", "-c", f"echo 'export ANTHROPIC_API_KEY=\"{anthropic_api_key}\"' >> /root/.opencode-env").wait()

    # Start OpenCode server
    print("[create] Starting OpenCode server...")
    sb.exec(
        "sh", "-c",
        "cd /workspace && . /root/.opencode-env && nohup opencode serve --port 4096 --hostname 0.0.0.0 > /tmp/opencode.log 2>&1 &"
    ).wait()

    # Wait for server to start
    print("[create] Waiting for server to start...")
    await asyncio.sleep(5)

    # Verify OpenCode is running
    for i in range(30):
        health_result = sb.exec(
            "curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
            "http://localhost:4096/global/health"
        )
        health_result.wait()
        health_code = health_result.stdout.read()
        if isinstance(health_code, bytes):
            health_code = health_code.decode("utf-8").strip()

        if health_code == "200":
            print(f"[create] OpenCode server is ready (attempt {i + 1})")
            break

        print(f"[create] Health check returned {health_code}, retrying... ({i + 1}/30)")
        await asyncio.sleep(2)
    else:
        log_result = sb.exec("cat", "/tmp/opencode.log")
        log_result.wait()
        log_output = log_result.stdout.read()
        print(f"[create] OpenCode log: {log_output[:500] if log_output else 'empty'}")
        sb.terminate()
        raise Exception("OpenCode server failed to start")

    # Get tunnel URL
    tunnels = sb.tunnels()
    tunnel_url = tunnels[4096].url
    print(f"[create] Tunnel URL: {tunnel_url}")

    return {
        "sandbox_id": sb.object_id,
        "tunnel_url": tunnel_url,
    }


@app.function()
async def pause_sandbox(sandbox_id: str) -> dict:
    """Pause a sandbox by capturing a filesystem snapshot."""
    print(f"[pause] Pausing sandbox: {sandbox_id}")
    sb = modal.Sandbox.from_id(sandbox_id)

    try:
        snapshot = sb.snapshot_filesystem()
        snapshot_id = snapshot.object_id
        print(f"[pause] Snapshot created: {snapshot_id}")
    except Exception as e:
        print(f"[pause] Snapshot failed: {e}")
        return {"error": f"Snapshot failed: {str(e)}"}

    try:
        sb.terminate()
        print("[pause] Sandbox terminated")
    except Exception as e:
        print(f"[pause] Warning: Terminate failed: {e}")

    return {"snapshot_id": snapshot_id}


@app.function()
async def resume_sandbox(
    snapshot_id: str,
    anthropic_api_key: str | None = None,
) -> dict:
    """Resume a sandbox from a filesystem snapshot."""
    print(f"[resume] Resuming from snapshot: {snapshot_id}")

    image = modal.Image.from_id(snapshot_id)

    sb = modal.Sandbox.create(
        image=image,
        app=app,
        timeout=3600,
        idle_timeout=600,
        encrypted_ports=[4096],
        cpu=1.0,
        memory=2048,
    )
    print(f"[resume] Sandbox ID: {sb.object_id}")

    # Update API key if provided
    if anthropic_api_key:
        sb.exec("sh", "-c", f"echo 'export ANTHROPIC_API_KEY=\"{anthropic_api_key}\"' >> /root/.opencode-env").wait()

    # Start OpenCode server
    print("[resume] Starting OpenCode server...")
    sb.exec(
        "sh", "-c",
        "cd /workspace && . /root/.opencode-env 2>/dev/null; opencode serve --port 4096 --hostname 0.0.0.0 > /tmp/opencode.log 2>&1 &"
    ).wait()

    await asyncio.sleep(3)

    # Verify server is ready
    for i in range(30):
        health_result = sb.exec(
            "curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
            "http://localhost:4096/global/health"
        )
        health_result.wait()
        health_code = health_result.stdout.read()
        if isinstance(health_code, bytes):
            health_code = health_code.decode("utf-8").strip()

        if health_code == "200":
            print(f"[resume] OpenCode server is ready (attempt {i + 1})")
            break

        await asyncio.sleep(2)
    else:
        raise Exception("OpenCode server failed to start after resume")

    tunnels = sb.tunnels()
    tunnel_url = tunnels[4096].url
    print(f"[resume] Tunnel URL: {tunnel_url}")

    return {
        "sandbox_id": sb.object_id,
        "tunnel_url": tunnel_url,
    }


@app.function()
async def terminate_sandbox(sandbox_id: str) -> dict:
    """Terminate a sandbox without saving state."""
    print(f"[terminate] Terminating sandbox: {sandbox_id}")
    try:
        sb = modal.Sandbox.from_id(sandbox_id)
        sb.terminate()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.function()
async def list_files(sandbox_id: str, path: str = "/workspace") -> dict:
    """List files in a sandbox directory."""
    try:
        sb = modal.Sandbox.from_id(sandbox_id)
        result = sb.exec(
            "sh", "-c",
            f"find {path} -maxdepth 1 -printf '%y|%s|%p\\n' 2>/dev/null | tail -n +2"
        )
        result.wait()
        output = result.stdout.read()
        if isinstance(output, bytes):
            output = output.decode("utf-8")

        files = []
        for line in output.strip().split("\n"):
            if "|" in line:
                parts = line.split("|", 2)
                if len(parts) >= 3:
                    file_type, size, filepath = parts
                    name = os.path.basename(filepath)
                    if name:
                        files.append({
                            "name": name,
                            "path": filepath,
                            "is_directory": file_type == "d",
                            "size": int(size) if size and file_type != "d" else None
                        })

        return {"files": files}
    except Exception as e:
        return {"error": str(e)}


@app.function()
async def read_file(sandbox_id: str, path: str) -> dict:
    """Read file content from a sandbox."""
    try:
        sb = modal.Sandbox.from_id(sandbox_id)

        # Check if file exists
        check = sb.exec("test", "-f", path)
        check.wait()
        if check.returncode != 0:
            return {"error": "File not found"}

        result = sb.exec("cat", path)
        result.wait()
        content = result.stdout.read()
        if isinstance(content, bytes):
            content = content.decode("utf-8")

        return {"content": content}
    except Exception as e:
        return {"error": str(e)}


@app.function()
async def get_logs(sandbox_id: str, tail: int = 100) -> dict:
    """Get OpenCode and system logs from a sandbox."""
    try:
        sb = modal.Sandbox.from_id(sandbox_id)
        logs = {}

        # Get OpenCode server logs
        opencode_log = sb.exec("sh", "-c", f"tail -n {tail} /tmp/opencode.log 2>/dev/null || echo '[no logs]'")
        opencode_log.wait()
        content = opencode_log.stdout.read()
        if isinstance(content, bytes):
            content = content.decode("utf-8")
        logs["opencode"] = content

        # Check if OpenCode process is running
        ps_result = sb.exec("sh", "-c", "ps aux | grep -E 'opencode|node' | grep -v grep || echo '[no process]'")
        ps_result.wait()
        ps_content = ps_result.stdout.read()
        if isinstance(ps_content, bytes):
            ps_content = ps_content.decode("utf-8")
        logs["processes"] = ps_content

        # Check port 4096 status
        port_result = sb.exec("sh", "-c", "curl -s http://localhost:4096/global/health 2>/dev/null || echo 'NOT_RESPONDING'")
        port_result.wait()
        port_content = port_result.stdout.read()
        if isinstance(port_content, bytes):
            port_content = port_content.decode("utf-8")
        logs["health_check"] = port_content

        # Get environment (without secrets)
        env_result = sb.exec("sh", "-c", "env | grep -v API_KEY | grep -v TOKEN | grep -v SECRET | sort")
        env_result.wait()
        env_content = env_result.stdout.read()
        if isinstance(env_content, bytes):
            env_content = env_content.decode("utf-8")
        logs["environment"] = env_content

        return {"logs": logs}
    except Exception as e:
        return {"error": str(e)}


# HTTP Endpoints for Cloudflare Worker

@app.function(image=endpoint_image)
@modal.fastapi_endpoint(method="POST")
async def api_create_sandbox(body: dict) -> dict:
    """HTTP endpoint to create a sandbox."""
    return await create_sandbox.remote.aio(
        repo=body.get("repo"),
        pat=body.get("pat"),
        anthropic_api_key=body.get("anthropic_api_key"),
    )


@app.function(image=endpoint_image)
@modal.fastapi_endpoint(method="POST")
async def api_pause_sandbox(body: dict) -> dict:
    """HTTP endpoint to pause a sandbox."""
    sandbox_id = body.get("sandbox_id")
    if not sandbox_id:
        return {"error": "Missing sandbox_id"}
    return await pause_sandbox.remote.aio(sandbox_id=sandbox_id)


@app.function(image=endpoint_image)
@modal.fastapi_endpoint(method="POST")
async def api_resume_sandbox(body: dict) -> dict:
    """HTTP endpoint to resume a sandbox."""
    snapshot_id = body.get("snapshot_id")
    if not snapshot_id:
        return {"error": "Missing snapshot_id"}
    return await resume_sandbox.remote.aio(
        snapshot_id=snapshot_id,
        anthropic_api_key=body.get("anthropic_api_key"),
    )


@app.function(image=endpoint_image)
@modal.fastapi_endpoint(method="POST")
async def api_terminate_sandbox(body: dict) -> dict:
    """HTTP endpoint to terminate a sandbox."""
    sandbox_id = body.get("sandbox_id")
    if not sandbox_id:
        return {"error": "Missing sandbox_id"}
    return await terminate_sandbox.remote.aio(sandbox_id=sandbox_id)


@app.function(image=endpoint_image)
@modal.fastapi_endpoint(method="POST")
async def api_list_files(body: dict) -> dict:
    """HTTP endpoint to list files."""
    sandbox_id = body.get("sandbox_id")
    if not sandbox_id:
        return {"error": "Missing sandbox_id"}
    return await list_files.remote.aio(
        sandbox_id=sandbox_id,
        path=body.get("path", "/workspace"),
    )


@app.function(image=endpoint_image)
@modal.fastapi_endpoint(method="POST")
async def api_read_file(body: dict) -> dict:
    """HTTP endpoint to read a file."""
    sandbox_id = body.get("sandbox_id")
    path = body.get("path")
    if not sandbox_id or not path:
        return {"error": "Missing sandbox_id or path"}
    return await read_file.remote.aio(sandbox_id=sandbox_id, path=path)


@app.function(image=endpoint_image)
@modal.fastapi_endpoint(method="POST")
async def api_get_logs(body: dict) -> dict:
    """HTTP endpoint to get sandbox logs."""
    sandbox_id = body.get("sandbox_id")
    if not sandbox_id:
        return {"error": "Missing sandbox_id"}
    return await get_logs.remote.aio(
        sandbox_id=sandbox_id,
        tail=body.get("tail", 100),
    )


@app.function(image=endpoint_image)
@modal.fastapi_endpoint(method="GET")
async def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok"}
