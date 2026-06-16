# Scanner Command Notes

This note is for backend scanner integration work. SpectraScope must only run these
commands for targets the user owns or is explicitly authorized to assess.

## Current Pipeline

The backend currently runs:

1. `subfinder` to discover subdomains from a normalized domain.
2. `httpx` to identify live HTTP services.
3. `nuclei` to collect findings from live URLs.
4. `nmap` optionally, only when `ENABLE_NMAP=true`, to collect service data.

Real scanner execution is disabled by default:

```env
ENABLE_REAL_SCANNERS=false
ENABLE_NMAP=false
```

For real scanner testing:

```env
ENABLE_REAL_SCANNERS=true
ENABLE_NMAP=false
SCANNER_TIMEOUT_SECONDS=120
SCANNER_MAX_RESULTS=200
NUCLEI_TEMPLATES_PATH=
ALLOWED_TARGET_DOMAINS=example.com
```

When `ENABLE_REAL_SCANNERS=true`, `ALLOWED_TARGET_DOMAINS` is mandatory. An empty allowlist must deny real scanner launches.

## Required Binaries

The worker container or local backend environment needs these binaries on `PATH`:

```bash
subfinder
httpx
nuclei
```

Use `nmap` only for explicitly enabled safe service detection. It is not part of the default real scanner MVP path.

The scanner-enabled Docker runtime is built with:

```bash
docker compose -f docker-compose.yml -f docker-compose.real-scanners.yml build
```

Check binaries inside the worker image/container with:

```bash
subfinder -version
httpx -version
nuclei -version
```

## Scan Profiles

Backend scan profiles:

```text
discovery
safe
lab
```

- `discovery`: runs `subfinder` and `httpx`, then creates a report from discovered assets.
- `safe`: runs `subfinder`, `httpx`, and `nuclei`.
- `lab`: requires `LAB_MODE=true` and never invokes external scanner binaries.

## Subdomain Discovery

Current command:

```bash
subfinder -d example.com -silent -json -timeout 30
```

Expected output: JSON lines.

Important fields to parse:

```json
{"host":"api.example.com"}
```

Backend normalized result:

```text
SubfinderResult(hostname="api.example.com")
```

Recommended backend notes:

- Keep `-silent` to reduce noisy stderr/stdout.
- Keep `-json` for structured parsing.
- Deduplicate hostnames after parsing.
- Keep a bounded result limit through `SCANNER_MAX_RESULTS`.
- Do not pass shell strings; keep argv as a list.

## HTTP Probing

Current command, one hostname at a time:

```bash
httpx -u api.example.com -json -silent -tech-detect -title -status-code
```

Expected output: JSON lines.

Important fields to parse:

```json
{
  "input": "api.example.com",
  "url": "https://api.example.com",
  "status_code": 200,
  "title": "API",
  "tech": ["nginx"],
  "host": "203.0.113.10"
}
```

Backend normalized result:

```text
HttpxResult(
  hostname="api.example.com",
  url="https://api.example.com",
  status_code=200,
  title="API",
  technologies=["nginx"],
  ip="203.0.113.10",
)
```

Recommended batch command for backend improvement:

```bash
httpx -json -silent -tech-detect -title -status-code -l hosts.txt
```

Backend task:

- Change `HttpxAdapter.probe()` to call `httpx` once per scan batch instead of once per hostname.
- Use a temporary hosts file safely.
- Keep timeout and binary detection.

## Nuclei Findings

Current default command, one batch per scan:

```bash
nuclei -l urls.txt -jsonl \
  -severity info,low,medium,high,critical \
  -exclude-tags intrusive,dos,fuzz \
  -duc -timeout 3 -retries 0 -c 3 -bs 3 -silent \
  -t /root/nuclei-templates/http/exposures/apis/swagger-api.yaml \
  -t /root/nuclei-templates/http/exposures/apis/openapi.yaml \
  -t /root/nuclei-templates/http/exposures/configs/git-config.yaml \
  -t /root/nuclei-templates/http/exposures/configs/git-credentials-disclosure.yaml \
  -t /root/nuclei-templates/http/exposures/configs/config-json.yaml \
  -t /root/nuclei-templates/http/exposures/configs/phpinfo-files.yaml \
  -t /root/nuclei-templates/http/exposures/files/javascript-env.yaml \
  -t /root/nuclei-templates/http/exposures/files/next-js-config-file.yaml
```

Expected output: JSON lines.

Important fields to parse:

```json
{
  "template-id": "http-missing-security-headers",
  "host": "https://api.example.com",
  "matched-at": "https://api.example.com",
  "info": {
    "name": "Missing Security Header",
    "severity": "medium",
    "description": "The response is missing a recommended security header.",
    "classification": {
      "cve-id": ["CVE-2024-0000"],
      "cvss-score": 5.3
    }
  }
}
```

Backend normalized result:

```text
NucleiFinding(
  host="https://api.example.com",
  name="Missing Security Header",
  severity="medium",
  template_id="http-missing-security-headers",
  description="...",
  cve="CVE-2024-0000",
  matched_at="https://api.example.com",
  cvss=5.3,
)
```

The default scanner image uses a small starter pack of safe exposure/config checks. This keeps MVP scans bounded and avoids running the full public nuclei template catalog on every target.

To override templates:

```bash
NUCLEI_TEMPLATES_PATH=/path/to/template.yaml,/path/to/templates-dir
```

Recommended lab command:

```bash
nuclei -l urls.txt -jsonl -severity info,low,medium,high,critical -t ./lab/nuclei-templates
```

Backend notes:

- `NUCLEI_TEMPLATES_PATH` is optional. If it is empty, the backend uses the scanner image starter pack.
- If it is set, the backend appends `-t <path>` for each comma-separated value.
- The backend runs one batch nuclei subprocess per scan instead of one subprocess per URL.

## Nmap Service Detection

Current command:

```bash
nmap -Pn -sV --top-ports 20 -oX - api.example.com
```

Expected output: XML on stdout.

Backend normalized result:

```text
NmapServiceResult(
  host="api.example.com",
  port=443,
  protocol="tcp",
  service_name="https",
  product="nginx",
  version="1.24",
)
```

Safety notes:

- Keep `ENABLE_NMAP=false` by default.
- Do not add aggressive flags such as `-A`, `-O`, vulnerability scripts, or broad port ranges in MVP mode.
- Keep `--top-ports 20` unless product requirements explicitly change.

## Local Lab Commands

Start the lab:

```bash
cd lab
docker compose up --build
```

Manual host checks:

```bash
curl -i http://localhost:8089
curl -i http://localhost:8090
curl -i http://localhost:8091
curl -i http://localhost:8092
```

If hosts entries are configured:

```bash
curl -i http://admin.lab.local:8088
curl -i http://legacy.lab.local:8088
curl -i http://files.lab.local:8088
curl -i http://juice.lab.local:8088
```

Manual nuclei lab scan:

```bash
printf "%s\n" \
  "http://admin.lab.local:8088" \
  "http://legacy.lab.local:8088" \
  "http://files.lab.local:8088" \
  > urls.txt

nuclei -l urls.txt -jsonl -t ./lab/nuclei-templates
```

## Current Gaps To Fix

- Expand the default safe nuclei starter pack after we measure scan time on a few real owned domains.
- `DOMAIN_RE` rejects `localhost`; local lab testing should use `*.lab.local` hosts entries or a dedicated local-target mode.
- Real scanner binaries are not installed by `backend/requirements.txt`; they must be installed in the Docker image or documented for local backend setup.

## LAB_MODE Notes

- `normalize_target()` now preserves `host:port` for valid targets such as `admin.lab.local:8088`.
- `LAB_MODE=true` uses `ALLOWED_LAB_TARGETS` instead of the public-domain allowlist.
- In `LAB_MODE`, the backend performs only safe HTTP `GET` requests against allowlisted demo targets and does not invoke `subfinder`, `httpx`, `nuclei`, or `nmap`.
- The demo findings currently expected by CI are:
  - `Exposed Admin Panel Demo`
  - `Legacy Service Demo`
  - `Directory Listing Demo`
