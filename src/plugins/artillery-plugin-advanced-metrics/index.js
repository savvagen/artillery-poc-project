'use strict';

const debug = require('debug')('plugin:advanced-metrics');
let StatsD = require('node-statsd')

module.exports = {
    Plugin: ArtilleryAdvancedMetricsPlugin,
    LEGACY_METRICS_FORMAT: false
}

function ArtilleryAdvancedMetricsPlugin(script, events) {
    // This is the entirety of the test script - config and
    // scenarios
    this.script = script;
    // This is an EventEmitter, we can subscribe to:
    // 'stats' - fired when a new batch of metrics is available
    // 'done' - fired when all VUs finished running their scenarios.
    // 'phaseStarted' - fired when new arrival phase has started.
    // 'phaseCompleted' -  fired when sn arrival phase has finished.
    this.events = events;

    // If running in Artillery v2, the plugin should only load in workers
    if (global.artillery && Number(global.artillery.version.slice(0, 1)) > 1 && typeof process.env.LOCAL_WORKER_ID !== 'undefined') {
        debug('Running in a worker, nothing to do')
        return;
    }

    // Read plugin's configuration:
    const pluginConfig = script.config.plugins['advanced-metrics'];
    this.statsdHost = pluginConfig.host || 'localhost';
    this.statsdPort = pluginConfig.port || '8125';
    this.statsdPrefix = pluginConfig.prefix || 'artillery'

    // Initialize statsd client
    debug("Initializing plugin:advanced-metrics")
    const statsd = new StatsD(this.statsdHost, this.statsdPort, `${this.statsdPrefix}.plugins.advanced_metrics.`)
    script.config.variables['statsdPrefix'] = this.statsdPrefix

    // But we could also read anything else defined in the test
    // script, e.g.:
    // debug('Sending Endpoint Stats. to Datadog:', pluginConfig.host);
    // debug('prefix is:', script.config.plugins.statsd.prefix);

    //
    // Let's attach a beforeRequest hook to all scenarios
    // which will send metrics after each http response
    //
    // Create processor object if needed to hold our custom function:
    script.config.processor = script.config.processor || {};

    // Add our custom function:
    // script.config.processor['pluginDatadogAdvancedMetricsAfterRespHook'] = function (req, res, context, events, next) {
    //     statsd.timing("response_time", res.timings.phases.firstByte, [`url:${req.name}`])
    //     statsd.timing(`response_time.${req.name}`, res.timings.phases.firstByte,[`url:${req.name}`])
    //     statsd.increment(`codes`,1,[`url:${req.name}`, `code:${res.statusCode}`])
    //     statsd.increment(`codes.${res.statusCode}`, 1,[`url:${req.name}`])
    //     next()
    // }
    //
    // Attach the function to every scenario as a scenario-level hook:
    // script.scenarios.forEach((scenario) => {
    //     scenario.afterResponse = scenario.afterResponse || [];
    //     scenario.afterResponse.push('pluginDatadogAdvancedMetricsAfterRespHook');
    // });

    // script.config.processor.printEndpoint = printEndpoint
    //
    // script.scenarios.forEach((scenario) => {
    //     scenario.afterResponse = scenario.afterResponse || [];
    //     scenario.afterResponse.push('printEndpoint');
    // });

    // Set event handlers
    this.events.on('stats', (stats) => {
        //printStats(stats)
        //sendErrorMetrics(stats, statsd)
        sendAdvancedMetrics(stats, statsd, this, this.events)
    })

    return this;
}

// Artillery will call this before it exits to give plugins
// a chance to clean up, e.g. by flushing any in-flight data,
// writing something to disk etc.
ArtilleryAdvancedMetricsPlugin.prototype.cleanup = function(done) {
    debug('cleaning up');
    done(null);
}

function sendAdvancedMetrics(stats, statsd) {
    debug("🖥️ Sending endpoint stats to Datadog.")
    //debug(JSON.stringify(stats))
    //debug("Sending response time metrics:")
    sendResponseTimeStats(stats, statsd)
    //debug("Sending status code metrics:")
    sendStatusCodeStats(stats, statsd)
    //debug("Sending error metrics:")
    sendErrorStats(stats, statsd)
    //debug("Sending scenario count metrics:")
    sendScenarioStats(stats, statsd)
}

function sendErrorMetrics(stats, statsd) {
    debug("🖥️ Sending error stats to Datadog.")
    sendErrorStats(stats, statsd)
}

function sendResponseTimeStats(stats, statsd){
    let endpoints = Object.keys(stats.summaries).map(k => {
        if (k.match(/plugins.metrics-by-endpoint.response_time.(.*)/) !== null){
            return k.match(/plugins.metrics-by-endpoint.response_time.(.*)/)[1]
        }
    }).filter(url => url !== undefined)
    //debug(endpoints)
    endpoints.forEach((endpoint, i) => {
        const respTimeObj = stats.summaries[`plugins.metrics-by-endpoint.response_time.${endpoint}`]
        //debug(respTimeObj)
        statsd.timing("response_time_min", respTimeObj.min,[`url:${endpoint}`])
        statsd.timing("response_time_max", respTimeObj.max,[`url:${endpoint}`])
        statsd.timing("response_time_median", respTimeObj.median,[`url:${endpoint}`])
        statsd.timing("response_time_p75", respTimeObj.p75,[`url:${endpoint}`])
        statsd.timing("response_time_p95", respTimeObj.p95,[`url:${endpoint}`])
        statsd.timing("response_time_p99", respTimeObj.p99, [`url:${endpoint}`])
    })
}

function sendStatusCodeStats(stats, statsd){
    let codeKeys = Object.keys(stats.counters)
        .filter(k => k.match(/plugins.metrics-by-endpoint.(.*).codes.(.*)/) !== null)
        .filter(k => k !== undefined)

    let codeUrls = Object.keys(stats.counters).map(k => {
        if (k.match(/plugins.metrics-by-endpoint.(.*).codes.(.*)/) !== null){
            return k.match(/plugins.metrics-by-endpoint.(.*).codes.(.*)/)[1]
        }
    }).filter(k => k !== undefined)

    let codeNames = Object.keys(stats.counters).map(k => {
        if (k.match(/plugins.metrics-by-endpoint.(.*).codes.(.*)/) !== null){
            return k.match(/plugins.metrics-by-endpoint.(.*).codes.(.*)/)[2]
        }
    }).filter(k => k !== undefined)
    //debug(codeUrls)
    //debug(codeNames)
    //debug(codeKeys)
    codeKeys.forEach((key, i) => {
        statsd.increment("codes", stats.counters[`${key}`], [`url:${codeUrls[i]}`, `code:${codeNames[i]}`])
    })
}

function sendErrorStats(stats, statsd) {
    const errorKeys = Object.keys(stats.counters).filter(k => k.includes("errors."))
    //debug(errorKeys)
    errorKeys.forEach((error) => {
        statsd.increment("errors", stats.counters[`${error}`], [`error:${error}`])
    })
}

function sendScenarioStats(stats, statsd){
    const scenarioNames = Object.keys(stats.counters).map(k => {
        if (k.match(/vusers.created_by_name.(.*)/) !== null){
            return k.match(/vusers.created_by_name.(.*)/)[1]
        }
    }).filter(k => k !== undefined)
    // scenarioNames.forEach(scn => {
    //     debug(`${scn}: ${stats.counters[`vusers.created_by_name.${scn}`]}`)
    // })
    scenarioNames.forEach(scn => {
        statsd.increment("scenarios", stats.counters[`vusers.created_by_name.${scn}`], [`scn:${scn}`])
    })
}

function printStats(stats) {
    for(const [name, value] of Object.entries(stats.counters || {})) {
        debug(`${name}: ${value}`)
    }
    debug(JSON.stringify(stats.summaries, null, 2))
    // for(const [name, values] of Object.entries(stats.summaries || {})) {
    //     for (const [aggregation, value] of Object.entries(values)) {
    //         debug(`${aggregation}: ${value}`)
    //     }
    // }
    debug(JSON.stringify(stats.rates, null, 2))
    // for (const [name, value] of Object.entries(stats.rates || {})) {
    //     debug(`${name}: ${value}`)
    // }
}


function printEndpoint(req, res, context, events, next) {
    debug(req.url)
    debug(req.name)
}

