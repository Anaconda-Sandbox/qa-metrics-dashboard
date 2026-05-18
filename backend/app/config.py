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


class Settings(BaseSettings):
    jira_base_url: str = "https://anaconda.atlassian.net"
    jira_api_token: str = ""
    jira_user_email: str = ""
    jira_cloud_id: str = "3f60a703-06c7-4861-85ce-efa25ba6bc03"

    reportportal_base_url: str = ""
    reportportal_api_token: str = ""
    reportportal_project: str = "anaconda-qa"

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
        if squad and squad != "ALL":
            cfg = SQUAD_CONFIG.get(squad)
            return cfg["repos"] if cfg else []
        if project and project != "ALL":
            return [
                repo for sq in SQUAD_CONFIG.values()
                for repo in sq["repos"]
                if project in sq["jira_projects"]
            ] or ALL_REPOS
        return ALL_REPOS

    def jira_projects_for_filter(self, squad: str | None, project: str | None) -> list[str]:
        if squad and squad != "ALL":
            cfg = SQUAD_CONFIG.get(squad)
            return cfg["jira_projects"] if cfg else ALL_JIRA_PROJECTS
        if project and project != "ALL":
            return [project]
        return ALL_JIRA_PROJECTS

    def members_for_filter(self, squad: str | None) -> list[str]:
        if squad and squad != "ALL":
            cfg = SQUAD_CONFIG.get(squad)
            return cfg["members"] if cfg else ALL_QA_MEMBERS
        return ALL_QA_MEMBERS


@lru_cache
def get_settings() -> Settings:
    return Settings()
