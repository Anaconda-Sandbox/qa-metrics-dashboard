from functools import lru_cache

from pydantic_settings import BaseSettings

SQUAD_CONFIG = {
    "PBP": {
        "name": "Package Build Platform",
        "jira_projects": ["SIR", "PKG"],
        "repos": ["sirius-qa-suite", "package-build-platform"],
        "members": ["abdul-050", "AnumRasheedAnaconda"],
    },
    "AI-Services": {
        "name": "AI Services",
        "jira_projects": ["AIC"],
        "repos": ["ai-platform-ui", "ai-core", "anaconda-ai", "ai-catalyst"],
        "members": ["inhaz1", "RidaZubair"],
    },
    "PythonAnywhere": {
        "name": "Python Anywhere",
        "jira_projects": ["PA"],
        "repos": ["PythonAnywhere"],
        "members": ["nishita-beeraka", "AnumRasheedAnaconda"],
    },
    "Installers": {
        "name": "Installers & PDA",
        "jira_projects": ["INST", "PDA"],
        "repos": ["installers", "src-tooling"],
        "members": ["heksein", "nishita-beeraka"],
    },
    "Security": {
        "name": "Security & Governance",
        "jira_projects": ["AIP", "CBR", "BIG"],
        "repos": ["te-repo-testing", "bigbend-platform", "audit-logs"],
        "members": ["areeshaarif1", "waqasanjum6", "nishita-beeraka", "keshavneupane", "abolla22"],
    },
    "Desktop": {
        "name": "Desktop",
        "jira_projects": ["DESK", "TBP"],
        "repos": ["notebooks-testing", "ai-navigator", "anaconda-desktop", "anaconda-connector", "anaconda-mcp"],
        "members": ["j-iliukhina-anaconda", "keshavneupane", "Pabrick"],
    },
    "Auth": {
        "name": "Auth & Payments",
        "jira_projects": ["CASH"],
        "repos": ["auth-ui", "auth-mfe"],
        "members": ["abolla22"],
    },
    "WebExp": {
        "name": "Web Experience",
        "jira_projects": ["AQUA", "CLOUD", "SHP"],
        "repos": ["ui", "ai-platform-ui"],
        "members": ["Pabrick", "abolla22", "keshavneupane"],
    },
    "Telemetry": {
        "name": "Central Services / Telemetry",
        "jira_projects": ["HUB"],
        "repos": [
            "distribution-installer-attribution",
            "installer-attribution-bootstrap",
            "anaconda-otel-ts-testing",
            "anaconda-otel-python-testing",
        ],
        "members": ["Maryiam-ai", "j-iliukhina-anaconda"],
    },
    "CLI": {
        "name": "Anaconda CLI",
        "jira_projects": ["CLI"],
        "repos": ["anaconda-cli", "anaconda-cli-testing"],
        "members": ["Umanan23", "Tuba-Waqar"],
    },
    "HubBackend": {
        "name": "Hub Backend",
        "jira_projects": ["HUB", "BIG"],
        "repos": ["bigbend-platform"],
        "members": ["Umanan23", "Tuba-Waqar"],
    },
}

ALL_QA_MEMBERS = [
    "keshavneupane", "Pabrick", "heksein", "waqasanjum6", "RidaZubair",
    "Umanan23", "abolla22", "nishita-beeraka", "vcannam", "areeshaarif1",
    "inhaz1", "AnumRasheedAnaconda", "ashafiq09", "abdul-050",
    "vvemulapalli11", "Maryiam-ai", "Tuba-Waqar", "j-iliukhina-anaconda",
    "rsarro-anaconda",
]

GITHUB_TO_JIRA_NAME: dict[str, str] = {
    "abdul-050": "Abdul Rehman Alvi",
    "AnumRasheedAnaconda": "Anum Umair",
    "vvemulapalli11": "Vidya Vemulapalli",
    "inhaz1": "Inha Zaheen",
    "RidaZubair": "Rida Zubair",
    "keshavneupane": "Keshav Neupane",
    "Pabrick": "Pablo Jimenez",
    "heksein": "Mykola Vasylenko",
    "waqasanjum6": "Waqas Anjum",
    "Umanan23": "Usama Manan",
    "abolla22": "Aparna Bolla",
    "nishita-beeraka": "Nishita Beeraka",
    "vcannam": "Vasu Annam",
    "areeshaarif1": "Areesha Arif",
    "ashafiq09": "Ayesha Shafiq",
    "Maryiam-ai": "Maryiam Tahir",
    "Tuba-Waqar": "Tuba Waqar",
    "j-iliukhina-anaconda": "Julia Iliukhina",
    "rsarro-anaconda": "Rob Sarro",
}

ALL_REPOS = list(set(
    repo for squad in SQUAD_CONFIG.values() for repo in squad["repos"]
))

ALL_JIRA_PROJECTS = list(set(
    proj for squad in SQUAD_CONFIG.values() for proj in squad["jira_projects"]
))

# Project-level config: maps each Jira project to its repos
# Members are NOT tied to projects - we use ALL_QA_MEMBERS globally
# This ensures any QA member's work appears under whichever project repos they contribute to
PROJECT_CONFIG = {
    "SIR": {
        "name": "Sirius",
        "repos": ["sirius-qa-suite"],
        "rp_projects": ["sirius-qa-suite"],
    },
    "PKG": {
        "name": "Package Build - Core",
        "repos": ["package-build-platform"],
        # PKG tests run inside sirius-qa-suite — same RP project as SIR.
        "rp_projects": ["sirius-qa-suite"],
    },
    "AIC": {
        "name": "AI Core",
        "repos": ["ai-platform-ui", "ai-core", "anaconda-ai", "ai-catalyst"],
        "rp_projects": ["ai-platform-ui", "ai-platform-api", "ai-catalog", "anaconda-cloud-ui", "anaconda-cloud-api"],
    },
    "PA": {
        "name": "Python Anywhere",
        "repos": ["PythonAnywhere"],
        "rp_projects": [],  # No PA RP project today
    },
    "INST": {
        "name": "Installers",
        "repos": ["installers"],
        "rp_projects": [],
    },
    "PDA": {
        "name": "PDA",
        "repos": ["src-tooling"],
        "rp_projects": [],
    },
    "AIP": {
        "name": "AI Platform",
        "repos": ["te-repo-testing", "audit-logs"],
        "rp_projects": ["ai-platform-ui", "ai-platform-api"],
    },
    "CBR": {
        "name": "CBR",
        "repos": ["te-repo-testing"],
        "rp_projects": [],
    },
    "BIG": {
        "name": "BigBend",
        "repos": ["bigbend-platform"],
        "rp_projects": ["bigbend-platform-api-integration-tests"],
    },
    "DESK": {
        "name": "Desktop",
        "repos": ["notebooks-testing", "ai-navigator", "anaconda-desktop", "anaconda-connector"],
        "rp_projects": ["anaconda-desktop", "anaconda-notebooks"],
    },
    "TBP": {
        "name": "Notebook",
        "repos": ["anaconda-mcp"],
        "rp_projects": ["anaconda-notebooks"],
    },
    "CASH": {
        "name": "Auth & Payments",
        "repos": ["auth-ui", "auth-mfe"],
        "rp_projects": ["anaconda-unified-auth", "auth-cli"],
    },
    "AQUA": {
        "name": "Aqua",
        "repos": ["ui"],
        "rp_projects": ["anaconda-cloud-ui", "dot-org"],
    },
    "CLOUD": {
        "name": "Cloud",
        "repos": ["ui", "ai-platform-ui"],
        "rp_projects": ["anaconda-cloud-ui", "anaconda-cloud-api", "dot-org"],
    },
    "SHP": {
        "name": "Self-Hosted Platform",
        "repos": ["ui"],
        "rp_projects": ["anaconda-cloud-ui"],
    },
    "HUB": {
        "name": "Hub / Telemetry",
        "repos": ["distribution-installer-attribution", "installer-attribution-bootstrap", "anaconda-otel-ts-testing", "anaconda-otel-python-testing", "bigbend-platform"],
        "rp_projects": [],
    },
    "CLI": {
        "name": "Anaconda CLI",
        "repos": ["anaconda-cli", "anaconda-cli-testing"],
        "rp_projects": ["auth-cli"],
    },
}


class Settings(BaseSettings):
    jira_base_url: str = "https://anaconda.atlassian.net"
    jira_api_token: str = ""
    jira_user_email: str = ""
    jira_cloud_id: str = "3f60a703-06c7-4861-85ce-efa25ba6bc03"

    reportportal_base_url: str = ""
    reportportal_api_token: str = ""
    reportportal_project: str = "anaconda-qa"
    reportportal_projects: str = ""  # Comma-separated list for aggregate metrics
    cf_access_client_id: str = ""
    cf_access_client_secret: str = ""

    github_token: str = ""
    github_org: str = "anaconda"

    backend_port: int = 8000
    cache_ttl_seconds: int = 300

    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    def repos_for_filter(self, squad: str | None, project: str | None) -> list[str]:
        # Project takes priority over squad
        if project and project != "ALL":
            cfg = PROJECT_CONFIG.get(project)
            return cfg["repos"] if cfg else ALL_REPOS
        if squad and squad != "ALL":
            cfg = SQUAD_CONFIG.get(squad)
            return cfg["repos"] if cfg else []
        return ALL_REPOS

    def jira_projects_for_filter(self, squad: str | None, project: str | None) -> list[str]:
        # Project takes priority over squad
        if project and project != "ALL":
            return [project]
        if squad and squad != "ALL":
            cfg = SQUAD_CONFIG.get(squad)
            return cfg["jira_projects"] if cfg else ALL_JIRA_PROJECTS
        return ALL_JIRA_PROJECTS

    def members_for_filter(self, squad: str | None = None, project: str | None = None) -> list[str]:
        # Always return all QA members - filtering by project happens via repos
        # This ensures any QA member's work appears under whichever project they contributed to
        if squad and squad != "ALL":
            cfg = SQUAD_CONFIG.get(squad)
            return cfg["members"] if cfg else ALL_QA_MEMBERS
        return ALL_QA_MEMBERS


@lru_cache
def get_settings() -> Settings:
    return Settings()
