# Artillery POC project

![Build Status](https://github.com/savvagen/artillery-poc-project/actions/workflows/build.yml/badge.svg)

### Running Artillery scenario with plugins:
Run command:
``` 
 ARTILLERY_PLUGIN_PATH=`pwd`/src/plugins/ DEBUG=plugin:advanced-metrics artillery run src/scenarios/system.yaml
```

Running your custom `engine` scenario:
```
1. adding ur plugin directory to the package.json file:

"devDependencies": {
    "artillery-engine-custom": "file:artillery-engine-custom",
}

2. Installing deps and moving plugin to the node_modules
 
 npm install

3. Running the test:
 
 DEBUG=engine:custom ./node_modules/.bin/artillery run src/scenarios/engine.yaml
```
