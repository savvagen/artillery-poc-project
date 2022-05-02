const faker = require('@faker-js/faker/locale/en_US')

dateTimeNow = () => new Date().toISOString().slice(0, 19) + "Z"
let categories = ["cats", "dogs", "test"]


randomUser = () => {
    return {
        name: `${faker.name.findName()}`,
        username: `${faker.internet.userName()}`,
        email: `${faker.internet.email()}`,
        createdAt: dateTimeNow()
    }
}

randomPost = (userId) => {
    return {
        title: `Test Post ${faker.datatype.number(100000, 999999)}`,
        subject: `Performance Testing`,
        body: `${faker.lorem.sentences()}`,
        category: categories[Math.floor(Math.random() * categories.length)],
        user: userId,
        comments: [],
        createdAt: dateTimeNow()
    }
}

function randomComment(postId, userEmail){
    return {
        "post": postId,
        "name": `Test comment - ${faker.datatype.number(100000, 999999)}`,
        "email": userEmail,
        "likes": [
            1
        ],
        "dislikes": [
            1
        ],
        "body": "Greeting from " + userEmail,
        "createdAt": dateTimeNow()
    }
}



module.exports = {
    dateTimeNow,
    randomUser,
    randomPost,
    randomComment
}
