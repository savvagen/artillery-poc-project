

function test(data){

    console.log(data.match(/.*{{.*}}.*/g))

    if (data.includes("{{") && data.includes("}}")){
        const variable = data.split(' ').join(''); // data.replaceAll(" ", "")
        const start = variable.indexOf("{{")
        const end = variable.indexOf("}}")
        const final = variable.substr(start+2, end-2)
        console.log(`'${final}'`)
    }
}


function stringToLog(text = "Found Test Data {{ testData }} asdasas"){
    if (text.match(/.*{{.*}}.*/g).length > 0){
        const start = text.indexOf("{{")
        const end = text.indexOf("}}")
        const varText = text.slice(start, end+2).split(' ').join('')
        const variable = varText.substr(varText.indexOf("{{")+2, varText.indexOf("}}")-2)
        console.log(`'${variable}'`)
        const startText = text.substring(0, text.indexOf("{{"))
        const endText =  text.substring(text.indexOf("}}")+2, text.length)
        // console.log(`'${startText}'`)
        // console.log(`'${endText}'`)
        console.log(`${startText}${variable}${endText}`)

    }
}

stringToLog()
