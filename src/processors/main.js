const { faker } = require("@faker-js/faker/locale/en_US")
const {
    dateTimeNow,
    randomPost,
    randomUser,
    randomComment
} = require('../data/data_genrator')
const fs = require("fs");
const path = require("path");
const csv = require("fast-csv")
const events = require("events");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

Array.prototype.randomIndex = function (){
    return this[Math.floor(Math.random() * this.length)]
}

function createPeopleCsv(context, ee, next){
    const path = `${__dirname}/../data/people.csv`;
    const csvWriter = createCsvWriter({
        path: path,
        header: [
            {id: 'userId', title: 'userId'},
            {id: 'userName', title: 'userName'},
            {id: 'userEmail', title: 'userEmail'}
        ]
    })
    // Create empty record
    csvWriter.writeRecords([]).then(() => true)
    context.vars.csvWriter = csvWriter
    context.vars.usersData = []
    next()
}

function saveUsersData(context, ee, next){
    context.vars.usersData.push({
        userId: context.vars.userId,
        userName: context.vars.userName,
        userEmail: context.vars.userEmail
    })
    context.vars.usersDataCount = context.vars.usersData.length
    next();
}

function writeUsersDataToCsv(context, ee, next){
    context.vars.csvWriter.writeRecords(context.vars.usersData).then(() => { console.log('...Done writing.') })
    next();
}

function readUsersDataFromCsv(context, ee, next) {
    context.vars.usersData = []
    fs.createReadStream(path.resolve(__dirname, '../data', 'people.csv'))
        .pipe(csv.parse({ headers: true, ignoreEmpty: true }))
        .on('error', error => console.error(error))
        .on('data', row => {
            context.vars.usersData.push(row)
        })
        .on('end', rowCount => {
            console.log(`Parsed ${rowCount} rows from file: people.csv`)
            context.vars.usersData = context.vars.usersData.filter(user => user.id !== '')
        })
    next();
}

function getRandomUserFromData(context, ee, next) {
    let usersList = context.vars.usersData.filter((user) => { return user.id !== context.vars.userId })
    let randomUser = usersList.randomIndex()
    context.vars.targetUserId = randomUser.id
    context.vars.targetUserName = randomUser.userName
    context.vars.targetUserEmail = randomUser.email
    next();
}


function userBody(req, context, ee, next) {
    req.json = randomUser()
    next()
}

function saveUserId(req, res, context, ee, next) {
    const userJson = JSON.parse(res.body)
    context.vars.userId = userJson.id
    context.vars.userEmail = userJson.email
    context.vars.userName = userJson.username
    ee.emit('counter', 'users_registered', 1)
    next();
}

function postBody(req, context, ee, next) {
    req.json = randomPost(context.vars.userId)
    next()
}

function savePost(req, res, context, ee, next) {
    context.vars.post = JSON.parse(res.body)
    next();
}

function commentBody(req, context, ee, next) {
    req.json = randomComment(context.vars.postId, context.vars.userEmail)
    next()
}

function commentsUpdateBody(req, context, ee, next) {
    const post = context.vars.post
    post.comments.push(context.vars.commentId)
    req.json = post
    next()
}

function getPosts(req, res, context, ee, next) {
    const posts = JSON.parse(res.body)
    const postList = posts.slice(0, 6).map(post => { return post.id }) // get first 6 post ids
    context.vars.postIds = postList
    context.vars.postId = postList.randomIndex()
    next();
}

function getRandomEmail(context, ee, done) {
    context.vars.userEmail = faker.internet.email()
    done()
}

function getComments(req, res, context, ee, next) {
    const post = JSON.parse(res.body)
    if (post.comments.length > 5)
        context.vars.commentIds = post.comments.slice(0, 4).filter(id => id !== 0)
    else context.vars.commentIds = post.comments.filter(id => id !== 0)
    next();
}

function randomFailure(context, ee, next) {
    let randomCode = faker.random.numeric()
    if (randomCode % 2 === 0){
        return next(new Error("Failed Scenario"))
    } else return next()
}

module.exports = {
    createPeopleCsv: createPeopleCsv,
    saveUsersData: saveUsersData,
    writeUsersDataToCsv: writeUsersDataToCsv,
    userBody: userBody,
    saveUserId: saveUserId,
    postBody: postBody,
    savePost: savePost,
    commentBody: commentBody,
    commentsUpdateBody: commentsUpdateBody,
    getPosts: getPosts,
    getRandomEmail: getRandomEmail,
    getComments: getComments,
    randomFailure: randomFailure
}
