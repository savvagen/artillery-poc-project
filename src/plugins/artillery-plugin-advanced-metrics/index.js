/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// https://www.artillery.io/blog/extend-artillery-by-creating-your-own-plugins

'use strict';

const debug = require('debug')('plugin:advanced-metrics');

let StatsD = require('node-statsd')

//module.exports = { Plugin: ArtilleryAdvancedMetricsPlugin }
module.exports.Plugin = ArtilleryAdvancedMetricsPlugin;


function ArtilleryAdvancedMetricsPlugin(script, events) {
    // This is the entirety of the test script - config and
    // scenarios
    this.script = script;
    // This is an EventEmitter, we can subscribe to:
    // 'stats' - fired when a new batch of metrics is available
    // 'done' - fired when all VUs are done
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

    // script.config.processor.getEndpointMetrics = getEndpointMetrics
    //
    // script.scenarios.forEach((scenario) => {
    //     scenario.afterResponse = scenario.afterResponse || [];
    //     scenario.afterResponse.push('getEndpointMetrics');
    // });

    // Set event handlers
    // debug('Setting event handlers...')
    //this.events.on('stats', printStats)
    this.events.on('stats', (stats) => {
        //sendEndpointMetrics(stats, statsd)
        sendErrorMetrics(stats, statsd)
    })

    return this;
}

// Artillery will call this before it exits to give plugins
// a chance to clean up, e.g. by flushing any in-flight data,
// writing something to disk etc.
ArtilleryAdvancedMetricsPlugin.prototype.cleanup = function(done) {
    debug('cleaning up');
    done(null);
};


function printStats(statsObject) {
    const stats = statsObject.report()
    debug("Stats\n" + JSON.stringify(stats, null, 2))

}

function sendErrorMetrics(statsObject, statsd) {
    const stats = statsObject.report()
    debug("🖥️ Sending endpoint stats to Datadog.")
    debug("Stats JSON:\n" + JSON.stringify(stats, null, 2))
    // Handle Errors Stats
    let errorNames = Object.keys(stats.errors)
    let errorCounts = Object.values(stats.errors)
    errorNames.forEach(function (value, i) {
        statsd.increment("errors", errorCounts[i], [`error:${value}`])
    })
}

function sendEndpointMetrics(statsObject, statsd) {
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
    endpointNames.forEach((endpoint, i) => {
        const respTimeObj = stats.customStats[`plugins.metrics-by-endpoint.response_time.${endpoint}`]
        //debug(respTimeObj)
        statsd.timing("response_time_min", respTimeObj.min,[`url:${endpoint}`])
        statsd.timing("response_time_max", respTimeObj.max,[`url:${endpoint}`])
        statsd.timing("response_time_median", respTimeObj.median,[`url:${endpoint}`])
        statsd.timing("response_time_p95", respTimeObj.p95,[`url:${endpoint}`])
        statsd.timing("response_time_p99", respTimeObj.p99, [`url:${endpoint}`])
    })
    // Handle Status Code Stats
    let codeUrls = Object.keys(stats.counters).map(k => k.match(/plugins.metrics-by-endpoint.(.*).codes.(.*)/)[1])
    let codeNames = Object.keys(stats.counters).map(k => k.match(/plugins.metrics-by-endpoint.(.*).codes.(.*)/)[2])
    let codeValues = Object.values(stats.counters)
    debug("Sending status code metrics:")
    debug(codeUrls)
    codeUrls.forEach((url, i) =>
        statsd.increment("codes", codeValues[i], [`url:${codeUrls[i]}`, `code:${codeNames[i]}`])
    )
    // Handle Errors Stats
    let errorNames = Object.keys(stats.errors)
    let errorCounts = Object.values(stats.errors)
    errorNames.forEach(function (value, i) {
        statsd.increment("errors", errorCounts[i], [`error:${value}`])
    })
}

function getEndpointMetrics(req, res, context, events, next) {
    //debug(req.url)
    //debug(req.name)
    //debug(JSON.stringify(res.timings, null, 4))
    // Create Your own metrics
    events.emit('histogram', `plugins.advanced_metrics.response_time.${req.name}`, res.timings.phases.firstByte)
    events.emit('counter', `plugins.advanced_metrics.${req.name}.codes.${res.statusCode}`, 1)
    return next();
}

