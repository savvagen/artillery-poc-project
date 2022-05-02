/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// https://www.artillery.io/blog/extend-artillery-by-creating-your-own-plugins

'use strict';

const debug = require('debug')('plugin:datadog-advanced-metrics');

let StatsD = require('node-statsd')

module.exports = { Plugin: ArtilleryDatadogAdvancedMetricsPlugin }
//module.exports.Plugin = ArtilleryDatadogAdvancedMetricsPlugin;


function ArtilleryDatadogAdvancedMetricsPlugin(script, events) {
    // This is the entirety of the test script - config and
    // scenarios
    this.script = script;
    // This is an EventEmitter, we can subscribe to:
    // 'stats' - fired when a new batch of metrics is available
    // 'done' - fired when all VUs are done
    this.events = events;

    // If running in Artillery v2, the plugin should only load in workers
    // if (global.artillery && Number(global.artillery.version.slice(0, 1)) > 1 && typeof process.env.LOCAL_WORKER_ID === 'undefined') {
    //     debug('Not running in a worker, exiting');
    //     return;
    // }

    if (script.config.plugins['metrics-by-endpoint'] === undefined){
        debug("Not running. Cause: plugin metrics-by-endpoint is not installed.")
        return;
    }

    // Read plugin's configuration:
    const pluginConfig = script.config.plugins['datadog-advanced-metrics'];
    this.statsdHost = pluginConfig.host || 'localhost';
    this.statsdPort = pluginConfig.port || '8125';
    this.statsdPrefix = pluginConfig.prefix || 'artillery'

    // Initialize statsd client
    debug("Initializing plugin:datadog-advanced-metrics")
    const statsd = new StatsD(this.statsdHost, this.statsdPort, `${this.statsdPrefix}.plugins.datadog_advanced_metrics.`)
    script.config.variables['statsdPrefix'] = this.statsdPrefix
    //debug("Connected to statsd server: \n" + "host:" + this.statsdHost + "\nport:" + this.statsdPort)


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
    // script.config.processor.printEndpointMetrics = printEndpointMetrics

    // Attach the function to every scenario as a scenario-level hook:
    // script.scenarios.forEach((scenario) => {
    //     scenario.afterResponse = scenario.afterResponse || [];
    //     scenario.afterResponse.push('pluginDatadogAdvancedMetricsAfterRespHook');
    // });

    // script.scenarios.forEach((scenario) => {
    //     scenario.afterResponse = scenario.afterResponse || [];
    //     scenario.afterResponse.push('printEndpointMetrics');
    // });

    // Set event handlers
    debug('Setting event handlers...')
    //events.on('stats', printStats)
    this.events.on('stats', (stats) => {
        sendStatsDetailedMetrics(stats, statsd)
    })

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
    debug("Stats\n" + JSON.stringify(stats, null, 2))
}

function printEndpointMetrics(req, res, context, events, next) {
    const metricName = `${context.vars.statsdPrefix}.plugins.datadog_advanced_metrics.${req.name}`
    debug(metricName)
    debug(req.url)
    debug(req.name)
    return next();
}



function sendStatsDetailedMetrics(statsObject, statsd) {
    const stats = statsObject.report()
    debug("🖥️ Sending endpoint stats to Datadog.")
    debug("Stats JSON:\n" + JSON.stringify(stats))
    // Handle Response Time Stats
    let endpointNames = Object.keys(stats.customStats)
        .map(k => {
            if (k.match(/plugins.metrics-by-endpoint.response_time.(.*)/) !== null){
                return k.match(/plugins.metrics-by-endpoint.response_time.(.*)/)[1]
            }
        })
        .filter(url => url !== undefined)
    debug("Sending response time metrics:")
    debug(endpointNames)
    for (let i = 0; i < endpointNames.length; i++) {
        const respTimeObj = stats.customStats[`plugins.metrics-by-endpoint.response_time.${endpointNames[i]}`]
        //debug(respTimeObj)
        statsd.timing("response_time_min", respTimeObj.min,[`url:${endpointNames[i]}`])
        statsd.timing("response_time_max", respTimeObj.max,[`url:${endpointNames[i]}`])
        statsd.timing("response_time_median", respTimeObj.median,[`url:${endpointNames[i]}`])
        statsd.timing("response_time_p95", respTimeObj.p95,[`url:${endpointNames[i]}`])
        statsd.timing("response_time_p99", respTimeObj.p99, [`url:${endpointNames[i]}`])
    }
    // Handle Status Code Stats
    let codeUrls = Object.keys(stats.counters).map(k => k.match(/plugins.metrics-by-endpoint.(.*).codes.(.*)/)[1])
    let codeNames = Object.keys(stats.counters).map(k => k.match(/plugins.metrics-by-endpoint.(.*).codes.(.*)/)[2])
    let codeValues = Object.values(stats.counters)
    debug("Sending status code metrics:")
    debug(codeUrls)
    //debug(codeNames)
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


