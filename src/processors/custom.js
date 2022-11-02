module.exports = {
    helloWorld,
    helloWorld2,
    myFlowFunc,
    beforeTest,
    afterTest
}

/* Functions without callback */

async function myFlowFunc(context, ee) {
    console.log("FLOW FUNCTION!!!!!!!!!!")
    context.vars.initalValue = 7
    context.vars.testData = JSON.stringify({test: "foo bar"})
}

async function helloWorld2(context, ee) {
    context.vars.initalValue1 = Math.floor(Math.random()*100)
    console.log(`HELLO SAVVA!!!!!!!!!! ${context.vars.initalValue} ${context.vars.initalValue1}`)
    //throw Error("Test")
}

/* Functions with callback */

async function helloWorld(context, ee, next) {
    context.initalValue1 = Math.floor(Math.random()*100)
    console.log(`HELLO SAVVA!!!!!!!!!! ${context.initalValue} ${context.initalValue1}`)
    //return next(new Error("Function Error"))
    next()
}

function beforeTest(context, ee, next){
    context.vars.testData = JSON.stringify({ message: "My test data" })
    context.vars.testDataMessage = "My test data"
    console.log("Before Test Fun")
    next()
}

function afterTest(context, ee, next){
    if (context.vars.testDataMessage !== "My test data" ) {
        return next(new Error("Data Matches Error"))
    }
    console.log("After Test Fun")
    return  next()
}



