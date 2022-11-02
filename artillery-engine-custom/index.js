const A = require('async');
const debug = require('debug')('engine:custom')
const _ = require("lodash")

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

class CustomEngine {

    constructor(script, ee, helpers) {
        debug('constructor');
        this.target = script.config.target;
        this.config = script.config?.engines?.custom || {};
        this.processor = script.config.processor || {}
        this.helpers = helpers
        return this;
    }

    static getThrowableCallback(fn, callback, context, event){
        return fn(context, event, (err)=>{
            if (err && err instanceof Error){
                event.emit('error', err.message)
                return callback(err, context)
            }
            return callback(err, context);
        })
    }

    beforeStep(step, event){
        const self = this;
        if (step.test){
            if (step.test.before){
                return function (context, callback) {
                    const fn = self.processor[step.test.before];
                    //fn(context, event)
                    //return callback(null, context);
                    //___________________________________
                    // return fn(context, event, (err)=>{
                    //     if (err && err instanceof Error){
                    //         event.emit('error', err.message)
                    //         return callback(err, context)
                    //     }
                    //     return callback(err, context);
                    // })
                    //___________________________________
                    return CustomEngine.getThrowableCallback(fn, callback, context, event)
                }
            }
        }
        return function (context, callback) {
            return callback(null, context);
        }
    }

    afterStep(step, event){
        const self = this;
        if (step.test){
            if (step.test.before){
                return function (context, callback) {
                    const fn = self.processor[step.test.after];
                    return CustomEngine.getThrowableCallback(fn, callback, context, event)
                }
            }
        }
        return function (context, callback) {
            return callback(null, context);
        }
    }

    step(step, event){
        const self = this;

        if (step.function){
            return function (context, callback) {
                const fn = self.processor[step.function];
                //fn(context, event)
                //return callback(null, context);
                //___________________________________
                // return fn(context, event, (err)=>{
                //     if (err && err instanceof Error){
                //         event.emit('error', err.message)
                //         return callback(err, context)
                //     }
                //     return callback(err, context);
                // })
                //___________________________________
                return CustomEngine.getThrowableCallback(fn, callback, context, event)
            }
        }

        if (step.think) {
            return this.helpers.createThink(step, _.get(self.config, 'defaults.think', {}));
        }

        if (step.loop) {
            const steps = step.loop.map(loopStep => this.step(loopStep, event));
            return this.helpers.createLoopWithCount(step.count || -1, steps, {});
        }

        if (step.log) {
            return function log (context, callback) {
                return process.nextTick(function () {
                    if (step.log.match(/.*{{.*}}.*/g))
                        console.log(CustomEngine.transformTextWithVariable(step.log, context))
                    else
                        console.log(step.log)
                    callback(null, context);
                });
            };
        }

        if (step.test){
            return function (context, callback) {
                try {
                    //throw new Error("hello_world")
                    let data = step.test.data
                    if (data.match(/.*{{.*}}.*/g)){
                        const text = CustomEngine.transformTextWithVariable(data, context)
                        console.log(`Testing Data: '${text}'`)
                    } else {
                        console.log(`Testing Data: '${data}'`)
                    }
                    event.emit('counter', "tests", 1)

                    return callback(null, context);
                } catch (err){
                    event.emit('error', err)
                    if(callback) {
                        return callback(err, context);
                    } else {
                        throw err;
                    }
                }

            }

        }

        return function (context, callback) {
            console.error(`STEP NOT FOUND: ${JSON.stringify(step)}`)
            return callback(null, context);
        }
    }

    createScenario(spec, events){
        debug('createScenario');
        debug(spec);

        const self = this;

        //const tasks = spec.flow.map(st => this.step(st, events)) // adding just 'step' functions to the tasks
        const tasks = []
        spec.flow.forEach(step => {  // adding  'before' , 'step' , 'after' - functions to the tasks
            tasks.push(this.beforeStep(step, events))
            tasks.push(this.step(step, events))
            tasks.push(this.afterStep(step, events))
        })

        return async function scenario(initialContext, callback) {
            /*
            *****************************
            * 1. Running Tasks sequentally in the loop:
            *****************************
             */

            /*
            events.emit('started');

            try {

                // execute flowFunction
                const fn = self.processor[spec.flowFunction];
                await fn(initialContext, events);

                // execute flow steps
                for (const step of spec.flow) {
                    if (step.function){
                        const stepFunc = self.processor[step.function]
                        await stepFunc(initialContext, events)
                    }

                    if (step.think){
                        await pause(step.think * 1000)
                    }

                    if (step.test){
                        //throw new Error("hello_world")
                        console.log("Testing Data: " + CustomEngine.transformTextWithVariable(step.test.data, initialContext))
                        events.emit('counter', "tests", 1)
                    }
                }

                if(callback) {
                   return  callback(null, initialContext)
                }
                return initialContext
            } catch(err) {
                debug(err);
                events.emit('error', err)
                if(callback) {
                    callback(err, initialContext);
                } else {
                    throw err;
                }
            } finally {
                debug("Finish!")
            }
            */


            /*
            *****************************
            * 2. Running Tasks as list with ASYNC lib:
            *****************************
            * ---------
            * Example: A.waterfall(taskList)
            * ---------
            * 1. Create an array with task functions:
            *  Each task function should return callback(null, initialContext)
            * 2. Create 'init' function and join it with tasks array
            * 3. Execute all tasks one after another in the async 'waterfall()' method
             */

            /*
            const tasks = [
                ()=> {
                    console.log("TASK-1 !!!")
                    return callback(null, initialContext)
                },
                ()=> {
                    console.log("TASK-2 !!!")
                    return callback(null, initialContext)
                }
                ]

            debug(tasks)
            */

            const init = function init (callback) {
                events.emit('started');
                console.log(`INIT USER: ${initialContext._uid} !!!!!`)
                initialContext.initalValue = 'hello'
                return callback(null, initialContext);
            }

            let steps = [init].concat(tasks);

            A.waterfall(
                steps,
                function done (err, context) {
                    if (err && err instanceof Error) {
                        debug(err)
                        //events.emit('error', err.message)
                    }
                    return callback(err, context);
                })

        }
    }


    static getVarNameFromText(text){
        const start = text.indexOf("{{")
        const end = text.indexOf("}}")
        const varText = text.slice(start, end+2).split(' ').join('')
        return varText.substr(varText.indexOf("{{")+2, varText.indexOf("}}")-2)
    }

    static transformTextWithVariable(text, context){
        const variableName = this.getVarNameFromText(text)
        const startText = text.substring(0, text.indexOf("{{"))
        const endText =  text.substring(text.indexOf("}}")+2, text.length)
        return `${startText}${context.vars[`${variableName}`]}${endText}`
    }
}

module.exports = CustomEngine;
