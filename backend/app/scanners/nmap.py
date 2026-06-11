import xml.etree.ElementTree as ET

from app.core.config import Settings
from app.scanners.base import NmapServiceResult, run_command, should_use_mock


class NmapAdapter:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def scan_services(self, hostnames: list[str]) -> list[NmapServiceResult]:
        if not self.settings.enable_nmap:
            return []
        if should_use_mock(self.settings):
            return [
                NmapServiceResult(host=hostname, port=443, protocol="tcp", service_name="https")
                for hostname in hostnames
            ]

        results: list[NmapServiceResult] = []
        for hostname in hostnames:
            command = ["nmap", "-Pn", "-sV", "--top-ports", "20", "-oX", "-", hostname]
            completed = run_command(command, timeout=self.settings.scanner_timeout_seconds)
            results.extend(_parse_nmap_xml(hostname, completed.stdout))
        return results


def _parse_nmap_xml(hostname: str, xml_text: str) -> list[NmapServiceResult]:
    root = ET.fromstring(xml_text)
    results: list[NmapServiceResult] = []
    for port in root.findall(".//port"):
        state = port.find("state")
        if state is not None and state.attrib.get("state") != "open":
            continue
        service = port.find("service")
        results.append(
            NmapServiceResult(
                host=hostname,
                port=int(port.attrib["portid"]),
                protocol=port.attrib.get("protocol", "tcp"),
                service_name=service.attrib.get("name") if service is not None else None,
                product=service.attrib.get("product") if service is not None else None,
                version=service.attrib.get("version") if service is not None else None,
            )
        )
    return results
