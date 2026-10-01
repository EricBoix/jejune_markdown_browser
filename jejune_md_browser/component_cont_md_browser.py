"""md-browser containerized component."""
from jejune_cli.component_containerized import cont_comp


class comp_md_browser(cont_comp):
    def __init__(self) -> None:
        super().__init__(
            name="md-browser",
            image_name="jejune:markdown-browser",
            service_name="markdown-browser",
            hint="run `jejune build`",
        )
        self.repos = [("DockerContext", "MARKDOWN_BROWSER_CONTEXT")]
        if self._context.ecosystem is not None:
            self.conditional_dependencies = [(lambda: not self.is_available(), self._context.ecosystem)]

    def is_available(self) -> bool:
        return self.is_built()

    def is_running(self) -> tuple[bool, str]:
        from pathlib import Path
        deploy_name = Path(".").resolve().name.lower()
        return super().is_running(f"jejune-{deploy_name}-{self.service_name}-1")
