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
ALLOWED_TARGET_DOMAINS=example.com
```

## Required Binaries

The worker container or local backend environment needs these binaries on `PATH`:

```bash
subfinder
httpx
nuclei
nmap
```

Use `nmap` only for explicitly enabled safe service detection.

## Subdomain Discovery

Current command:

```bash
subfinder -d example.com -silent -json
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

Current command, one URL at a time:

```bash
nuclei -u https://api.example.com -jsonl -severity info,low,medium,high,critical
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

Recommended batch command for backend improvement:

```bash
nuclei -l urls.txt -jsonl -severity info,low,medium,high,critical
```

Recommended lab command:

```bash
nuclei -l urls.txt -jsonl -severity info,low,medium,high,critical -t ./lab/nuclei-templates
```

Backend task:

- Add `nuclei_templates_path` to `Settings`, mapped from `NUCLEI_TEMPLATES_PATH`.
- If the value is set, append `-t <path>` to the nuclei command.
- Prefer one batch nuclei run per scan over one subprocess per URL.

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

- `NUCLEI_TEMPLATES_PATH` exists in `.env.example`, but `Settings` and `NucleiAdapter` do not use it yet.
- `normalize_target()` returns only a hostname and drops the port. That is fine for public domain scans, but it means API scans for `admin.lab.local:8088` will not preserve `:8088`.
- `DOMAIN_RE` rejects `localhost`; local lab testing should use `*.lab.local` hosts entries or a dedicated local-target mode.
- `httpx` and `nuclei` currently run one subprocess per input. Batch mode will be faster and easier to limit.
- Real scanner binaries are not installed by `backend/requirements.txt`; they must be installed in the Docker image or documented for local backend setup.
