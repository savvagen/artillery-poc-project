/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const {stats} = require("artillery/core");
const debug = require('debug')('plugin:datadog-advanced-metrics');

let StatsD = require('node-statsd')


module.exports.Plugin = ArtilleryDatadogAdvancedMetricsPlugin;
//module.exports = { Plugin: ArtilleryDatadogAdvancedMetricsPlugin }


function ArtilleryDatadogAdvancedMetricsPlugin(script, events) {

    // If running in Artillery v2, the plugin should only load in workers
    // if (global.artillery && Number(global.artillery.version.slice(0, 1)) > 1 && typeof process.env.LOCAL_WORKER_ID === 'undefined') {
    //     debug('Not running in a worker, exiting');
    //     return;
    // }

    // This is the entirety of the test script - config and
    // scenarios
    this.script = script;
    // This is an EventEmitter, we can subscribe to:
    // 'stats' - fired when a new batch of metrics is available
    // 'done' - fired when all VUs are done
    this.events = events;

    // We can read our plugin's configuration:
    const pluginConfig = script.config.plugins['datadog-advanced-metrics'];
    this.statsdHost = pluginConfig.host || 'localhost';
    this.statsdPort = pluginConfig.port || '8125';
    this.statsdPrefix = pluginConfig.prefix || 'artillery'

    const self = this;

    if (script.config.plugins['metrics-by-endpoint'] === undefined){
        const message = "WARN: Plugin metrics-by-endpoint NOT_FOUND. Please connect 'metrics-by-endpoint' to artillery."
        console.warn(message)
        debug(message)
    }

    // Initialize statsd client
    debug("Initializing plugin:datadog-advanced-metrics")
    const statsd = new StatsD(this.statsdHost, this.statsdPort, `${this.statsdPrefix}.plugins.datadog_advanced_metrics.`)
    script.config.variables['statsdPrefix'] = this.statsdPrefix
    //debug("Connected to statsd server: \n" + "host:" + this.statsdHost + "\nport:" + this.statsdPort)

    // Set event handlers
    debug('Setting event handlers...')
    //events.on('stats', printStats)
    this.events.on('stats', (statsObject) => {
        printStats(statsObject)
        sendStatsDetailedMetrics(statsObject, statsd)
    })


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
    script.config.processor['pluginDatadogAdvancedMetricsAfterRespHook'] = function (req, res, context, events, next) {
        statsd.timing("response_time", res.timings.phases.firstByte, [`url:${req.name}`])
        statsd.timing(`response_time.${req.name}`, res.timings.phases.firstByte,[`url:${req.name}`])
        statsd.increment(`codes`,1,[`url:${req.name}`, `code:${res.statusCode}`])
        statsd.increment(`codes.${res.statusCode}`, 1,[`url:${req.name}`])
        next()
    }

    script.config.processor.printEndpointMetrics = printEndpointMetrics

    // Attach the function to every scenario as a scenario-level hook:
    // script.scenarios.forEach((scenario) => {
    //     scenario.afterResponse = scenario.afterResponse || [];
    //     scenario.afterResponse.push('pluginDatadogAdvancedMetricsAfterRespHook');
    // });

    script.scenarios.forEach((scenario) => {
        scenario.afterResponse = scenario.afterResponse || [];
        scenario.afterResponse.push('printEndpointMetrics');
    });

    return this;
}

// Artillery will call this before it exits to give plugins
// a chance to clean up, e.g. by flushing any in-flight data,
// writing something to disk etc.
ArtilleryDatadogAdvancedMetricsPlugin.prototype.cleanup = function(done) {
    debug('cleaning up');
    done(null);
};


function printStats(statsObject) {
    const stats = statsObject.report()
    debug("Stats\n" + JSON.stringify(stats))
}

function sendStatsDetailedMetrics(statsObject, statsd) {
    const stats = statsObject.report()
    debug("Stats\n" + JSON.stringify(stats))
    // Handle Response Time Stats
    let endpointNames = Object.keys(stats.customStats).map(k => k.match(/plugins.metrics-by-endpoint.response_time.(.*)/)[1])
    let endpointValues = Object.values(stats.customStats)
    debug("Sending response time metrics:")
    debug(endpointNames)
    debug(endpointValues)
    for (let i = 0; i < endpointNames.length; i++) {
        statsd.timing("response_time_min", endpointValues[i].min,[`url:${endpointNames[i]}`])
        statsd.timing("response_time_max", endpointValues[i].max,[`url:${endpointNames[i]}`])
        statsd.timing("response_time_median", endpointValues[i].median,[`url:${endpointNames[i]}`])
        statsd.timing("response_time_p95", endpointValues[i].p95,[`url:${endpointNames[i]}`])
        statsd.timing("response_time_p99", endpointValues[i].p99, [`url:${endpointNames[i]}`])
    }
    // Handle Status Code Stats
    let codeUrls = Object.keys(stats.counters).map(k => k.match(/plugins.metrics-by-endpoint.(.*).codes.(.*)/)[1])
    let codeNames = Object.keys(stats.counters).map(k => k.match(/plugins.metrics-by-endpoint.(.*).codes.(.*)/)[2])
    let codeValues = Object.values(stats.counters)
    debug("Sending status code metrics:")
    debug(codeUrls)
    debug(codeNames)
    for (let i = 0; i < codeUrls.length; i++) {
        statsd.increment("codes", codeValues[i], [`url:${codeUrls[i]}`, `code:${codeNames[i]}`])
    }
    // Handle Errors Stats
    let errorNames = Object.keys(stats.errors)
    let errorCounts = Object.values(stats.errors)
    errorNames.forEach(function (value, i) {
        statsd.increment("errors", errorCounts[i], [`error:${value}`])
    })
}


function printEndpointMetrics(req, res, userContext, events, next) {
    const metricName = `${userContext.vars.statsdPrefix}.plugins.datadog_advanced_metrics.${req.name}`
    debug(metricName)
    debug(req.url)
    debug(req.name)
    return next();
}



