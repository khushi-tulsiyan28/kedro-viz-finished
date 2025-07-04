from kedro.config import ConfigLoader
from kedro.framework.project import settings as _settings

conf_loader = ConfigLoader(conf_source=str(_settings.CONF_SOURCE))

conf_catalog = conf_loader["catalog"]
conf_params = conf_loader["parameters"]

