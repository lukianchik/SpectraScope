# SpectraScope Local Vulnerable Lab

This lab is a local-only Docker Compose environment for testing the SpectraScope MVP pipeline. It provides predictable demo services for asset discovery, live host checks, findings collection, top risks, and summary generation.

## Safety Warning

This lab contains intentionally vulnerable or deliberately suspicious demo services. Do not publish it to the internet, do not bind it to a public interface, and do not use it against third-party systems. It is intended only for local SpectraScope testing on machines you control.

The compose file exposes only the reverse proxy on localhost ports. Individual services are reachable only through the Docker network.
Inside Docker-based CI, the reverse proxy is also reachable by network aliases such as `admin.lab.local`, `legacy.lab.local`, `files.lab.local`, and `juice.lab.local`.

## Services

- `juice.lab.local` routes to OWASP Juice Shop on port `3000` inside Docker.
- `admin.lab.local` routes to a Flask mock admin panel.
- `legacy.lab.local` routes to a Flask mock legacy service.
- `files.lab.local` routes to an nginx directory listing demo.
- `dvwa.lab.local` is documented in `docker-compose.yml` as an optional service.
- `webgoat.lab.local` is documented in `docker-compose.yml` as an optional service.

DVWA and WebGoat are disabled by default because their images and startup behavior can vary by environment. To use them later, uncomment the relevant service and `depends_on` entries in `docker-compose.yml`, then keep the reverse proxy routes in `nginx/nginx.conf`.

## Start

```bash
cd lab
docker compose up --build
```

The host-based reverse proxy listens on:

```text
http://127.0.0.1:8088
```

You can also use direct localhost ports without editing your hosts file:

```text
http://localhost:8089  admin panel
http://localhost:8090  legacy service
http://localhost:8091  directory listing
http://localhost:8092  Juice Shop
```

## Hosts Entries

This step is optional if you use the direct localhost ports above. Add the entries from `hosts.example` only when you want to test host-based routing through `:8088`.

Windows:

```text
C:\Windows\System32\drivers\etc\hosts
```

Linux/macOS:

```text
/etc/hosts
```

Entries:

```text
127.0.0.1 juice.lab.local
127.0.0.1 dvwa.lab.local
127.0.0.1 webgoat.lab.local
127.0.0.1 admin.lab.local
127.0.0.1 legacy.lab.local
127.0.0.1 files.lab.local
```

## Manual Checks

Open these URLs from the host:

```text
http://localhost:8089
http://localhost:8090
http://localhost:8091
http://localhost:8092
```

Or, if you added hosts entries:

```text
http://admin.lab.local:8088
http://legacy.lab.local:8088
http://files.lab.local:8088
http://juice.lab.local:8088
```

Expected stable demo markers:

- `admin.lab.local`: page title `Admin Panel`, body text `Internal Administration Portal`, header `X-Spectra-Finding: exposed-admin-panel`.
- `legacy.lab.local`: page title `Legacy Service`, headers `Server: Apache/2.4.49` and `X-Spectra-Finding: legacy-service`.
- `files.lab.local`: body contains `backup.zip` and `config.old`.

## Using With SpectraScope

For a first test, scan one concrete host such as:

```text
admin.lab.local:8088
```

Then check that SpectraScope stores the discovered asset and any findings returned by the scanner pipeline. After that, test the other local hosts:

```text
legacy.lab.local:8088
files.lab.local:8088
juice.lab.local:8088
```

If you run real `nuclei` locally, point it at the safe local templates:

```env
NUCLEI_TEMPLATES_PATH=./lab/nuclei-templates
```

The templates only use HTTP GET requests and matchers. They do not exploit vulnerabilities, send dangerous payloads, or change service state.

Stable findings expected from this lab:

- Exposed Admin Panel Demo
- Legacy Service Demo
- Directory Listing Demo
- missing security headers, if your scanner configuration checks for them

## CI Demo Loop

The repository includes a GitHub Actions workflow at [`.github/workflows/lab-mode.yml`](../.github/workflows/lab-mode.yml) for the baseline demo loop. It:

- starts the main backend stack and the lab stack;
- connects backend and worker containers to the lab network;
- waits for `http://127.0.0.1:8000/health/ready`;
- launches scans for `admin.lab.local:8088`, `legacy.lab.local:8088`, and `files.lab.local:8088`;
- verifies the expected finding and report for each target;
- writes a GitHub Actions Summary and uploads `artifacts/lab-mode-results.json`.
