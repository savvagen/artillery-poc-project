# Artillery POC project

![Build Status](https://github.com/savvagen/artillery-poc-project/actions/workflows/build.yml/badge.svg)

### Running Artillery scenario with plugins:
Run command:
``` 
 ARTILLERY_PLUGIN_PATH=`pwd`/src/plugins/ DEBUG=plugin:advanced-metrics artillery run src/scenarios/system.yaml
```
