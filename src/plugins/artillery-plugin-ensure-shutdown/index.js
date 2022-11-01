
'use strict';

const debug = require('debug')('plugin:ensure-shutdown');
const filtrex = require('filtrex').compileExpression;

class EnsureShutdownPlugin {
    constructor(script, events) {
        if (!global.artillery) {
            debug('Running in an unsupported Artillery version, nothing to do');
            return;
        }
        if (global.artillery && Number(global.artillery.version.slice(0, 1)) === 1) {
            debug('Running in Artillery v1, nothing to do')
            return;
        }

        if (global.artillery && Number(global.artillery.version.slice(0, 1)) > 1 && typeof process.env.LOCAL_WORKER_ID !== 'undefined') {
            debug('Running in a worker, nothing to do')
            return;
        }

        debug('ensure-shutdown plugin loaded');

        this.script = script;
        this.events = events;

        // Deprecated!!!
        //.......
        //const pluginConfig = script.config.plugins['ensure-shutdown'];
        //this.maxErrors = pluginConfig.maxErrors !== undefined ? Number(pluginConfig.maxErrors) : 0
        //this.errorCounter = 0
        //.......

        this.vars = {}
        events.on('stats', (stats)=> {
            // Deprecated!!!
            //.......
            //this.countErrors(stats)
            //.......

            if (typeof this.script?.config?.ensure === 'undefined' || typeof process.env.ARTILLERY_DISABLE_ENSURE !== 'undefined') {
                return;
            }
            const report = stats.report()
            debug(JSON.stringify(report, null, 2))
            const vars = EnsureShutdownPlugin.reportToVars(report, this)
            debug({vars})

            const checks = this.script.config.ensure;
            const checkTests = EnsureShutdownPlugin.runChecks(checks, vars);

            checkTests.forEach(check => {
                if(!check.result) { // if(check.result !== 1)
                    global.artillery.log(`❌ fail: ${check.original}${check.strict ? '': ' (optional)'}`);
                    if(check.strict) {
                        global.artillery.suggestedExitCode = 1
                        if (check.shutdown){
                            global.artillery.log("Ensure condition failed. Shutting down.")
                            global.artillery.shutdown()
                        }
                    }
                } else {
                    global.artillery.log(`✅ ok: ${check.original}`)
                }
            })

        });
    }

    // This method transforms stats.report object into a flat key->value object, and saves the intermediate stats results to plugin object
    static reportToVars(stats, plClass) {
        for(const [name, value] of Object.entries(stats.latency) || {}){
            plClass.vars[`http.response_time.${name}`] = value
        }

        for(const [name, value] of Object.entries(stats.codes) || {}){
            plClass.vars[`http.codes.${name}`] = (plClass.vars[`http.codes.${name}`] || 0) + value
        }

        plClass.vars[`http.requests`] = (plClass.vars[`http.requests`] || 0) + stats.requestsCompleted
        plClass.vars[`http.request_rate`] = stats.rps.count / 10

        for(const [name, values] of Object.entries(stats.scenarioDuration) || {}){
            plClass.vars[`vusers.session_length.${name}`] = values
        }

        plClass.vars['vusers.created'] = (plClass.vars['vusers.created'] || 0) + stats.scenariosCreated
        plClass.vars['vusers.completed'] = (plClass.vars['vusers.completed'] || 0) + stats.scenariosCompleted
        plClass.vars['vusers.skipped'] = (plClass.vars['vusers.skipped'] || 0) + stats.scenariosAvoided

        const errorCount = Object.values(stats.errors).length > 0 ? Object.values(stats.errors).reduce((a, b) => a + b) : 0
        plClass.vars['vusers.failed'] = (plClass.vars['vusers.failed'] || 0) + errorCount

        for(const [name, value] of Object.entries(stats.scenarioCounts) || {}){
            plClass.vars[`vusers.created_by_name.${name}`] = (plClass.vars[`vusers.created_by_name.${name}`] || 0) + value
        }

        // handle errors
        for(const [name, value] of Object.entries(stats.errors) || {}){
            plClass.vars[`errors.${name}`] = (plClass.vars[`errors.${name}`] || 0) + value
        }
        // handle custom stats
        for(const [name, value] of Object.entries(stats.customStats) || {}){
            plClass.vars[`${name}`] = (plClass.vars[`${name}`] || 0) + value
        }
        return plClass.vars;
    }

    static runChecks(checks, vars) {
        const LEGACY_CONDITIONS = ['min', 'max', 'median', 'p95', 'p99'];
        const checkTests = [];

        if (Array.isArray(checks.thresholds)) {
            checks.thresholds.forEach((o) => {
                if (typeof o === 'object') {
                    const metricName = Object.keys(o)[0]; // only one metric check per array entry
                    const maxValue = o[metricName];
                    const expr = `${metricName} < ${maxValue}`;
                    let f = () => {};
                    try {
                        f = filtrex(expr);
                    } catch (err) {
                        global.artillery.log(err);
                    }
                    // set shutdown flag (default = false):
                    const shutdown = o.shutdown !== undefined ? o.shutdown : false
                    // all threshold checks are strict:
                    checkTests.push({ f, strict: true, shutdown: shutdown, original: expr });
                }
            });
        }

        if (Array.isArray(checks.conditions)) {
            checks.conditions.forEach((o) => {
                if (typeof o === 'object') {
                    const expression = o.expression;
                    const strict = typeof o.strict === 'boolean' ? o.strict : true;

                    let f = () => {};
                    try {
                        f = filtrex(expression);
                    } catch (err) {
                        global.artillery.log(err);
                    }
                    // set shutdown flag (default = false):
                    const shutdown = o.shutdown !== undefined ? o.shutdown : false
                    checkTests.push({ f, strict, shutdown: shutdown, original: expression });
                }
            });
        }

        Object.keys(checks)
            .filter(k => LEGACY_CONDITIONS.indexOf(k) > -1)
            .forEach(k => {
                const metricName = `http.response_time.${k}`;
                const maxValue = parseInt(checks[k]);
                let f = () => {};
                try {
                    f = filtrex(`${metricName} < ${maxValue}`);
                } catch (err) {
                    global.artillery.log(err);
                }

                // all legacy threshold checks are strict:
                checkTests.push({ f, strict: true, original: `${k} < ${maxValue}` });
            });

        if(typeof checks.maxErrorRate !== 'undefined') {
            const maxValue = Number(checks.maxErrorRate);
            const expression = `((vusers.created - vusers.completed)/vusers.created * 100) <= ${maxValue}`;
            let f = () => {};
            try {
                f = filtrex(expression);
            } catch (err) {
                global.artillery.log(err);
            }

            checkTests.push({ f, strict: true, original: `maxErrorRate < ${maxValue}` });
        }

        if(checkTests.length > 0) {
            global.artillery.log('\nChecks:');
        }

        checkTests.forEach(check => {
            const result = check.f(vars);
            check.result = result;
            debug(`check ${check.original} -> ${result}`);
        });
        return checkTests;
    }

    // countErrors(statsObj) {
    //     const stats = statsObj.report()
    //     //debug("Stats JSON:\n" + JSON.stringify(stats, null, 2))
    //     // Count errors number
    //     Object.values(stats.errors).forEach(value => this.errorCounter += value)
    //
    //     if (this.errorCounter >= this.maxErrors){
    //         debug(`❌ found ${this.errorCounter} errors from ${this.maxErrors}`)
    //         global.artillery.suggestedExitCode = 1
    //         global.artillery.log(`Exit Plugin: Shooting down Artillery.\nExpected maxErrors -> ${this.maxErrors}; Found -> ${this.errorCounter}`)
    //         global.artillery.shutdown()
    //     } else {
    //         debug(`✅ found ${this.errorCounter} errors from ${this.maxErrors}`)
    //     }
    // }

}

module.exports = {
    Plugin: EnsureShutdownPlugin,
};
